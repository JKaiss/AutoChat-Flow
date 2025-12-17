import { db } from "./db";
import { Flow, Subscriber, FlowNode, ChatMessage, TriggerType, Platform } from "../types";
import { GoogleGenAI } from "@google/genai";
import axios from 'axios';

interface AutomationEvent {
  type: TriggerType;
  subscriberId: string;
  username: string;
  targetAccountId: string; 
  payload: {
    text?: string;
    mediaId?: string;
  };
}

export class AutomationEngine {
  private listeners: ((msg: ChatMessage) => void)[] = [];
  private ai: GoogleGenAI;
  private pausedStates = new Map<string, { flowId: string, nextNodeId: string, variable: string }>();
  private processedIds = new Set<string>();
  
  // Interval tracking
  private intervalId: any = null;
  public isPolling = false;

  constructor() {
    const apiKey = process.env.API_KEY || ''; 
    this.ai = new GoogleGenAI({ apiKey });
    
    // Expose to window for debugging
    if (typeof window !== 'undefined') {
        (window as any).automationEngine = this;
    }
  }

  // --- Listener Management ---
  addListener(fn: (msg: ChatMessage) => void) {
      this.listeners.push(fn);
  }

  removeListener(fn: (msg: ChatMessage) => void) {
      this.listeners = this.listeners.filter(l => l !== fn);
  }

  private broadcast(msg: ChatMessage) {
      this.listeners.forEach(l => l(msg));
  }

  // --- Polling Logic ---
  startPolling() {
      // If we are already polling AND have a valid interval, do nothing (idempotent)
      if (this.isPolling && this.intervalId) {
          console.log("[Engine] Already polling.");
          this.broadcastStatus();
          return;
      }

      // If we have an interval but state is weird, clear it
      if (this.intervalId) {
          clearInterval(this.intervalId);
      }

      console.warn("[Engine] 🟢 Starting Auto-Polling Service (5s interval)...");
      this.isPolling = true;
      this.broadcastStatus(); // Notify UI immediately

      // Poll immediately
      this.pollMessages();

      // Set interval
      this.intervalId = setInterval(() => {
          this.pollMessages();
      }, 5000);
  }

  stopPolling() {
      if (this.intervalId) {
          console.warn("[Engine] 🔴 Stopping Auto-Polling...");
          clearInterval(this.intervalId);
          this.intervalId = null;
      }
      this.isPolling = false;
      this.broadcastStatus(); // Notify UI immediately
  }

  private broadcastStatus() {
      if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('engine-status-change', { 
              detail: { isPolling: this.isPolling } 
          }));
      }
  }

  public async pollMessages() {
      try {
          const res = await axios.post('/api/instagram/check-messages');
          const messages = res.data.messages || [];
          
          if (messages.length > 0) {
             console.log(`[Engine] Server returned ${messages.length} messages`);
          }

          let newCount = 0;
          for (const msg of messages) {
              if (!this.processedIds.has(msg.id)) {
                  this.processedIds.add(msg.id);
                  newCount++;
                  console.info(`[Engine] 📩 NEW MESSAGE DETECTED: "${msg.text}" from ${msg.sender.username}`);
                  
                  // Broadcast to UI (Simulator)
                  this.broadcast({
                      id: msg.id,
                      sender: 'user',
                      text: msg.text,
                      timestamp: new Date(msg.timestamp).getTime(),
                      channel: 'instagram',
                      accountId: msg.accountId
                  });

                  // Trigger Automation
                  await this.triggerEvent('instagram_dm', {
                      text: msg.text,
                      subscriberId: msg.sender.id,
                      username: msg.sender.username,
                      targetAccountId: msg.accountId
                  });
              }
          }
          
          if (newCount > 0) {
              const event = new CustomEvent('engine-activity', { detail: { action: 'new-messages', count: newCount } });
              window.dispatchEvent(event);
          }

      } catch (e: any) {
          // Log errors quietly
      } finally {
          // CRITICAL: Always dispatch heartbeat so UI knows we attempted a check
          if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('engine-heartbeat'));
          }
      }
  }

  // Helper to check limits against backend
  private async checkLimits(usesAI: boolean): Promise<boolean> {
      try {
          await axios.post('/api/flow/execute-check', { usesAI });
          return true;
      } catch (e: any) {
          // FAILSAFE: If the backend is unreachable (Offline) or returns generic 500/404, we ALLOW execution
          // so the Simulator doesn't break. We only block on explicit 403.
          if (!e.response || e.code === 'ERR_NETWORK' || e.code === 'ECONNREFUSED' || e.response.status >= 500) {
              return true; // Offline/Error mode -> Allow
          }

          if (e.response?.status === 403 && e.response?.data?.upgrade) {
              const event = new CustomEvent('trigger-upgrade', { 
                  detail: { reason: e.response.data.error === 'AI_DISABLED' ? 'AI Feature Locked' : 'Monthly Limit Reached' } 
              });
              window.dispatchEvent(event);
              return false;
          }
          return true; // Default allow
      }
  }

  async triggerEvent(type: TriggerType, rawPayload: { text?: string, subscriberId: string, username: string, targetAccountId: string }) {
    console.log(`[Engine] Trigger: ${type}`);

    const canRun = await this.checkLimits(false);
    if (!canRun) return;

    const event: AutomationEvent = {
        type,
        subscriberId: rawPayload.subscriberId,
        username: rawPayload.username,
        targetAccountId: rawPayload.targetAccountId,
        payload: { text: rawPayload.text }
    };

    let channel: Platform = 'instagram';
    if (type.startsWith('whatsapp')) channel = 'whatsapp';
    if (type.startsWith('messenger')) channel = 'facebook';

    let subscriber = db.getSubscribers().find(s => s.id === event.subscriberId);
    if (!subscriber) {
      subscriber = {
        id: event.subscriberId,
        username: event.username,
        channel: channel,
        data: {},
        lastInteraction: Date.now(),
        phoneNumber: channel === 'whatsapp' ? event.subscriberId : undefined,
        messenger_id: channel === 'facebook' ? event.subscriberId : undefined
      };
      db.saveSubscriber(subscriber);
    }

    const isConversational = ['instagram_dm', 'keyword', 'whatsapp_message', 'messenger_text'].includes(type);
    const pausedState = this.pausedStates.get(subscriber.id);
    
    if (pausedState && isConversational && event.payload.text) {
        subscriber.data[pausedState.variable] = event.payload.text;
        db.saveSubscriber(subscriber);
        this.pausedStates.delete(subscriber.id);
        const flow = db.getFlow(pausedState.flowId);
        if (flow) {
            this.executeFlow(flow, subscriber, event.targetAccountId, pausedState.nextNodeId, event.payload.text);
            return;
        }
    }

    const flows = db.getFlows().filter(f => f.active);
    const matchedFlow = flows.find(f => {
        if (f.triggerType !== event.type && f.triggerType !== 'keyword') return false;
        if (f.triggerAccountId && f.triggerAccountId !== event.targetAccountId && event.targetAccountId !== 'virtual_test_account') return false;
        
        const isMsg = ['instagram_dm', 'whatsapp_message', 'messenger_text'].includes(event.type);
        if ((f.triggerType === 'keyword' || (isMsg && f.triggerKeyword)) && event.payload.text) {
            return event.payload.text.toLowerCase().includes((f.triggerKeyword || '').toLowerCase());
        }
        if (isMsg && !f.triggerKeyword && f.triggerType !== 'keyword') return true;
        if (!isMsg && f.triggerType === event.type) return true;
        return false;
    });

    if (matchedFlow) {
      this.executeFlow(matchedFlow, subscriber, event.targetAccountId, matchedFlow.nodes[0]?.id, event.payload.text);
    }
  }

  private async executeFlow(flow: Flow, subscriber: Subscriber, currentAccountId: string, startNodeId?: string, initialInput?: string) {
    let currentNodeId: string | undefined = startNodeId;
    let userInput = initialInput;

    while (currentNodeId) {
      const node = flow.nodes.find(n => n.id === currentNodeId);
      if (!node) break;

      if (node.type === 'ai_generate') {
          const canUseAI = await this.checkLimits(true);
          if (!canUseAI) break; 
      }

      const sendingAccountId = node.data.accountId || currentAccountId;

      db.addLog({
        id: crypto.randomUUID(),
        flowId: flow.id,
        subscriberId: subscriber.id,
        nodeId: node.id,
        status: 'pending',
        timestamp: Date.now()
      });

      try {
        const nextId = await this.processNode(node, flow.id, subscriber, sendingAccountId, userInput);
        
        db.addLog({
          id: crypto.randomUUID(),
          flowId: flow.id,
          subscriberId: subscriber.id,
          nodeId: node.id,
          status: 'success',
          timestamp: Date.now()
        });

        if (!nextId && node.type === 'question') break;
        currentNodeId = nextId;
        userInput = undefined; // Clear input after processing logic

      } catch (e) {
        console.error("Execution error", e);
        currentNodeId = undefined;
      }
    }
  }

  private async processNode(node: FlowNode, flowId: string, subscriber: Subscriber, accountId: string, userInput?: string): Promise<string | undefined> {
    switch (node.type) {
      case 'message':
        this.sendBotMessage(node.data.content || '...', subscriber, accountId);
        await this.wait(600); 
        return node.nextId;

      case 'delay':
        await this.wait(node.data.delayMs || 1000);
        return node.nextId;

      case 'condition':
        const storedValue = node.data.conditionVar ? subscriber.data[node.data.conditionVar] : undefined;
        const matches = storedValue && storedValue.toLowerCase() === node.data.conditionValue?.toLowerCase();
        return matches ? node.nextId : node.falseNextId;

      case 'question':
        this.sendBotMessage(node.data.content || '?', subscriber, accountId);
        if (node.nextId && node.data.variable) {
            this.pausedStates.set(subscriber.id, {
                flowId, nextNodeId: node.nextId, variable: node.data.variable
            });
        }
        return undefined;

      case 'ai_generate':
         let prompt = node.data.aiPrompt || "Say hello";
         if (userInput) {
             prompt += `\n\nContext - The user just said: "${userInput}"`;
         }
         
         let reply = "";
         try {
             // Use Gemini API to generate response
             const result = await this.ai.models.generateContent({
                 model: 'gemini-2.5-flash',
                 contents: prompt,
                 config: {
                    systemInstruction: `You are a helpful automated assistant talking to ${subscriber.username}. Keep responses concise and friendly (under 300 chars usually).`
                 }
             });
             reply = result.text || "";
         } catch(e) {
             console.error("AI Gen Error", e);
             reply = "I'm having a bit of trouble thinking right now. Please try again later.";
         }

         this.sendBotMessage(reply, subscriber, accountId);
         return node.nextId;
        
      default:
        return node.nextId;
    }
  }

  private sendBotMessage(text: string, subscriber: Subscriber, accountId: string) {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'bot',
      text,
      timestamp: Date.now(),
      channel: subscriber.channel,
      accountId 
    };
    this.broadcast(msg);

    if (accountId !== 'virtual_test_account') {
        if (subscriber.channel === 'whatsapp' && subscriber.phoneNumber) {
            this.sendApi('whatsapp', subscriber.phoneNumber, text, accountId);
        } else if (subscriber.channel === 'facebook' && subscriber.messenger_id) {
            this.sendApi('messenger', subscriber.messenger_id, text, accountId);
        } else if (subscriber.channel === 'instagram') {
             this.sendApi('instagram', subscriber.id, text, accountId);
        }
    }
  }

  private async sendApi(channel: string, to: string, text: string, accountId: string) {
      try {
          await axios.post(`/api/${channel}/send`, { to, text, accountId });
      } catch (e) {
          console.warn(`Failed to send real ${channel} message`, e);
      }
  }

  private wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const engine = new AutomationEngine();
