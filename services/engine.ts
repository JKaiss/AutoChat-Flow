
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
  private messageHandler: (msg: ChatMessage) => void;
  private ai: GoogleGenAI;
  private pausedStates = new Map<string, { flowId: string, nextNodeId: string, variable: string }>();

  constructor(onMessage: (msg: ChatMessage) => void) {
    this.messageHandler = onMessage;
    const apiKey = process.env.API_KEY || ''; 
    this.ai = new GoogleGenAI({ apiKey });
  }

  // Helper to check limits against backend
  private async checkLimits(usesAI: boolean): Promise<boolean> {
      try {
          // Use relative path for proxy
          await axios.post('/api/flow/execute-check', { usesAI });
          return true;
      } catch (e: any) {
          // If backend is offline or network error, ALLOW execution in simulation mode
          if (!e.response || e.code === 'ERR_NETWORK' || e.code === 'ECONNREFUSED') {
              console.warn("[Engine] Backend unreachable. Running in offline simulation mode.");
              return true;
          }

          if (e.response?.data?.upgrade) {
              const event = new CustomEvent('trigger-upgrade', { 
                  detail: { reason: e.response.data.error === 'AI_DISABLED' ? 'AI Feature Locked' : 'Monthly Limit Reached' } 
              });
              window.dispatchEvent(event);
              return false;
          }
          
          console.error("Limit check failed", e);
          return false;
      }
  }

  async triggerEvent(type: TriggerType, rawPayload: { text?: string, subscriberId: string, username: string, targetAccountId: string }) {
    console.log(`[Engine] Trigger: ${type}`);

    // Check generic limit first (transaction count)
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
        
        // Allow flow to run if account ID matches OR if flow is generic (no specific account) OR if target is virtual/simulated
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
    } else {
        // Optional: Feedback if no flow matched
        console.log("[Engine] No matching flow found.");
    }
  }

  private async executeFlow(flow: Flow, subscriber: Subscriber, currentAccountId: string, startNodeId?: string, initialInput?: string) {
    let currentNodeId: string | undefined = startNodeId;

    while (currentNodeId) {
      const node = flow.nodes.find(n => n.id === currentNodeId);
      if (!node) break;

      // Special check for AI nodes
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
        const nextId = await this.processNode(node, flow.id, subscriber, sendingAccountId, initialInput);
        
        if (!nextId && node.type === 'question') {
             break;
        }

        db.addLog({
          id: crypto.randomUUID(),
          flowId: flow.id,
          subscriberId: subscriber.id,
          nodeId: node.id,
          status: 'success',
          timestamp: Date.now()
        });

        currentNodeId = nextId;
        initialInput = undefined; 

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
         // Simulate AI if needed
         const reply = "[AI Reply] Hello " + subscriber.username; 
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
    this.messageHandler(msg);

    // Only attempt real API calls if not using virtual account
    if (accountId !== 'virtual_test_account') {
        if (subscriber.channel === 'whatsapp' && subscriber.phoneNumber) {
            this.sendApi('whatsapp', subscriber.phoneNumber, text, accountId);
        } else if (subscriber.channel === 'facebook' && subscriber.messenger_id) {
            this.sendApi('messenger', subscriber.messenger_id, text, accountId);
        }
    }
  }

  private async sendApi(channel: string, to: string, text: string, accountId: string) {
      try {
          await axios.post(`/api/${channel}/send`, { to, text, accountId });
      } catch (e) {
          console.warn(`Failed to send real ${channel} message (Backend might be offline)`, e);
      }
  }

  private wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
