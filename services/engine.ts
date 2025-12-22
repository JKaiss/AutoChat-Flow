
import { db } from "./db";
import { Flow, Subscriber, FlowNode, ChatMessage, TriggerType, Platform } from "../types";
import { GoogleGenAI } from "@google/genai";
import axios from 'axios';

export class AutomationEngine {
  private listeners: ((msg: ChatMessage) => void)[] = [];
  private pausedStates = new Map<string, { flowId: string, nextNodeId: string, variable: string }>();
  private processedIds = new Set<string>();
  private authToken: string | null = null;
  public isPolling = false;
  private intervalId: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
        (window as any).automationEngine = this;
    }
  }

  setToken(token: string | null) {
      this.authToken = token;
      if (token && this.isPolling) {
          this.pollMessages();
      }
  }

  addListener(fn: (msg: ChatMessage) => void) { this.listeners.push(fn); }
  removeListener(fn: (msg: ChatMessage) => void) { this.listeners = this.listeners.filter(l => l !== fn); }
  private broadcast(msg: ChatMessage) { this.listeners.forEach(l => l(msg)); }

  startPolling() {
      if (this.isPolling && this.intervalId) return;
      this.isPolling = true;
      this.broadcastStatus();
      this.pollMessages();
      this.intervalId = setInterval(() => this.pollMessages(), 8000); 
  }

  stopPolling() {
      if (this.intervalId) clearInterval(this.intervalId);
      this.intervalId = null;
      this.isPolling = false;
      this.broadcastStatus();
  }

  private broadcastStatus() {
      if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('engine-status-change', { detail: { isPolling: this.isPolling } }));
      }
  }

  public async pollMessages() {
      if (!this.authToken) return;

      try {
          const res = await axios.post('/api/instagram/check-messages', {}, {
              headers: { Authorization: `Bearer ${this.authToken}` }
          });
          
          const messages = res.data.messages || [];
          for (const msg of messages) {
              if (!this.processedIds.has(msg.id)) {
                  this.processedIds.add(msg.id);
                  this.broadcast({
                      id: msg.id, 
                      sender: 'user', 
                      text: msg.text, 
                      timestamp: new Date(msg.timestamp).getTime(),
                      channel: 'instagram', 
                      accountId: msg.accountId
                  });

                  await this.triggerEvent('instagram_dm', {
                      text: msg.text, 
                      subscriberId: msg.sender.id, 
                      username: msg.sender.username, 
                      profilePic: msg.sender.picture,
                      targetAccountId: msg.accountId
                  });
              }
          }
      } catch (e: any) {
          console.warn("[Engine] Polling failed cycle:", e.response?.data?.error || e.message);
      } finally {
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('engine-heartbeat'));
      }
  }

  private async checkLimits(usesAI: boolean): Promise<boolean> {
      if (!this.authToken) return false;
      try {
          await axios.post('/api/flow/execute-check', { usesAI }, {
              headers: { Authorization: `Bearer ${this.authToken}` }
          });
          return true;
      } catch (e: any) {
          if (e.response?.status === 403) {
              window.dispatchEvent(new CustomEvent('trigger-upgrade', { detail: { reason: e.response.data.error } }));
              return false;
          }
          return true; 
      }
  }

  async triggerEvent(type: TriggerType, rawPayload: { text?: string, subscriberId: string, username: string, profilePic?: string, targetAccountId: string }) {
    if (!(await this.checkLimits(false))) return;

    let channel: Platform = type.startsWith('whatsapp') ? 'whatsapp' : type.startsWith('messenger') ? 'facebook' : 'instagram';
    
    let subscriber = db.getSubscribers().find(s => s.id === rawPayload.subscriberId);
    if (!subscriber) {
      subscriber = { 
          id: rawPayload.subscriberId, 
          username: rawPayload.username, 
          channel, 
          data: {}, 
          profilePictureUrl: rawPayload.profilePic,
          lastInteraction: Date.now() 
      };
    } else {
        subscriber.username = rawPayload.username;
        subscriber.profilePictureUrl = rawPayload.profilePic || subscriber.profilePictureUrl;
        subscriber.lastInteraction = Date.now();
    }
    db.saveSubscriber(subscriber);

    const pausedState = this.pausedStates.get(subscriber.id);
    if (pausedState && rawPayload.text) {
        subscriber.data[pausedState.variable] = rawPayload.text;
        db.saveSubscriber(subscriber);
        this.pausedStates.delete(subscriber.id);
        const flow = db.getFlow(pausedState.flowId);
        if (flow) return this.executeFlow(flow, subscriber, rawPayload.targetAccountId, pausedState.nextNodeId, rawPayload.text);
    }

    const matchedFlow = db.getFlows().find(f => {
        if (!f.active || (f.triggerType !== type && f.triggerType !== 'keyword')) return false;
        if (f.triggerAccountId && f.triggerAccountId !== rawPayload.targetAccountId && rawPayload.targetAccountId !== 'virtual_test_account') return false;
        if ((f.triggerType === 'keyword' || f.triggerKeyword) && rawPayload.text) {
            return rawPayload.text.toLowerCase().includes((f.triggerKeyword || '').toLowerCase());
        }
        return true;
    });

    if (matchedFlow) this.executeFlow(matchedFlow, subscriber, rawPayload.targetAccountId, matchedFlow.nodes[0]?.id, rawPayload.text);
  }

  private async executeFlow(flow: Flow, subscriber: Subscriber, accountId: string, startNodeId?: string, initialInput?: string) {
    let nodeId: string | undefined = startNodeId;
    let input = initialInput;

    while (nodeId) {
      const node = flow.nodes.find(n => n.id === nodeId);
      if (!node) break;
      if (node.type === 'ai_generate' && !(await this.checkLimits(true))) break;

      db.addLog({ id: crypto.randomUUID(), flowId: flow.id, subscriberId: subscriber.id, nodeId: node.id, status: 'pending', timestamp: Date.now() });
      try {
        const nextId = await this.processNode(node, flow.id, subscriber, node.data.accountId || accountId, input);
        db.addLog({ id: crypto.randomUUID(), flowId: flow.id, subscriberId: subscriber.id, nodeId: node.id, status: 'success', timestamp: Date.now() });
        if (!nextId && node.type === 'question') break;
        nodeId = nextId;
        input = undefined;
      } catch (e) {
        nodeId = undefined;
      }
    }
  }

  private async processNode(node: FlowNode, flowId: string, subscriber: Subscriber, accountId: string, input?: string): Promise<string | undefined> {
    switch (node.type) {
      case 'message':
        this.sendBotMessage(node.data.content || '...', subscriber, accountId);
        await new Promise(r => setTimeout(r, 600));
        return node.nextId;
      case 'delay':
        await new Promise(r => setTimeout(r, node.data.delayMs || 1000));
        return node.nextId;
      case 'condition':
        const stored = node.data.conditionVar ? subscriber.data[node.data.conditionVar] : undefined;
        return stored?.toLowerCase() === node.data.conditionValue?.toLowerCase() ? node.nextId : node.falseNextId;
      case 'question':
        this.sendBotMessage(node.data.content || '?', subscriber, accountId);
        if (node.nextId && node.data.variable) this.pausedStates.set(subscriber.id, { flowId, nextNodeId: node.nextId, variable: node.data.variable });
        return undefined;
      case 'ai_generate':
         const apiKey = process.env.API_KEY;
         if (!apiKey) {
           this.sendBotMessage("[AI Disabled: Missing API Key in Settings]", subscriber, accountId);
           return node.nextId;
         }
         
         try {
           const ai = new GoogleGenAI({ apiKey });
           const prompt = `${node.data.aiPrompt || "Greet user"}\n\nContext: ${input || "User started flow"}`;
           const response = await ai.models.generateContent({
               model: 'gemini-3-flash-preview',
               contents: prompt,
               config: { systemInstruction: `Friendly assistant for ${subscriber.username}. Max 300 chars.` }
           });
           this.sendBotMessage(response.text || "...", subscriber, accountId);
         } catch (aiErr: any) {
           console.error("[Engine] AI Generation failed:", aiErr);
           this.sendBotMessage("[AI Error: Failed to generate reply]", subscriber, accountId);
         }
         return node.nextId;
      default: return node.nextId;
    }
  }

  private sendBotMessage(text: string, subscriber: Subscriber, accountId: string) {
    const msg: ChatMessage = { id: crypto.randomUUID(), sender: 'bot', text, timestamp: Date.now(), channel: subscriber.channel, accountId };
    this.broadcast(msg);
    
    if (accountId !== 'virtual_test_account' && this.authToken) {
        axios.post(`/api/${subscriber.channel}/send`, { to: subscriber.id, text, accountId }, {
            headers: { Authorization: `Bearer ${this.authToken}` }
        }).catch((err) => {
            console.error(`[Engine] ${subscriber.channel} delivery failed:`, err.response?.data?.error || err.message);
        });
    }
  }
}

export const engine = new AutomationEngine();
