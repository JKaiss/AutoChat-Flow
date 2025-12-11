
import { Flow, Subscriber, ExecutionLog, Account, Platform } from "../types";

const DB_KEYS = {
  FLOWS: 'autochat_flows',
  SUBSCRIBERS: 'autochat_subscribers',
  LOGS: 'autochat_logs',
  ACCOUNTS: 'autochat_accounts_v2', // Unified storage
};

// Initial Seed Data
const SEED_FLOWS: Flow[] = [
  {
    id: 'flow_1',
    name: 'Welcome & Discount',
    triggerType: 'instagram_dm', 
    triggerKeyword: 'hello', 
    active: true,
    createdAt: Date.now(),
    nodes: [
      {
        id: 'node_1',
        type: 'message',
        position: { x: 100, y: 50 },
        data: { content: 'Hey there! 👋 Welcome to our store.' },
        nextId: 'node_2'
      },
      {
        id: 'node_2',
        type: 'delay',
        position: { x: 100, y: 150 },
        data: { delayMs: 1500 },
        nextId: 'node_3'
      },
      {
        id: 'node_3',
        type: 'question',
        position: { x: 100, y: 250 },
        data: { content: 'Would you like a 20% discount code? (Reply "yes")', variable: 'wants_discount' },
        nextId: 'node_4'
      },
      {
        id: 'node_4',
        type: 'condition',
        position: { x: 100, y: 350 },
        data: { conditionVar: 'wants_discount', conditionValue: 'yes' },
        nextId: 'node_5',
        falseNextId: 'node_6'
      },
      {
        id: 'node_5',
        type: 'message',
        position: { x: 250, y: 450 },
        data: { content: 'Awesome! Use code: AUTO20 at checkout. 🚀' },
      },
      {
        id: 'node_6',
        type: 'message',
        position: { x: -50, y: 450 },
        data: { content: 'No problem! Let us know if you change your mind.' },
      }
    ]
  }
];

class MockDatabase {
  constructor() {
    if (!localStorage.getItem(DB_KEYS.FLOWS)) {
      this.saveFlows(SEED_FLOWS);
    }
  }

  // --- FLOWS ---
  getFlows(): Flow[] {
    return JSON.parse(localStorage.getItem(DB_KEYS.FLOWS) || '[]');
  }

  getFlow(id: string): Flow | undefined {
    return this.getFlows().find(f => f.id === id);
  }

  saveFlow(flow: Flow) {
    const flows = this.getFlows();
    const index = flows.findIndex(f => f.id === flow.id);
    if (index >= 0) {
      flows[index] = flow;
    } else {
      flows.push(flow);
    }
    this.saveFlows(flows);
  }

  saveFlows(flows: Flow[]) {
    localStorage.setItem(DB_KEYS.FLOWS, JSON.stringify(flows));
  }

  deleteFlow(id: string) {
    const flows = this.getFlows().filter(f => f.id !== id);
    this.saveFlows(flows);
  }

  // --- SUBSCRIBERS ---
  getSubscribers(): Subscriber[] {
    return JSON.parse(localStorage.getItem(DB_KEYS.SUBSCRIBERS) || '[]');
  }

  saveSubscriber(sub: Subscriber) {
    const subs = this.getSubscribers();
    const index = subs.findIndex(s => s.id === sub.id);
    if (index >= 0) {
      subs[index] = sub;
    } else {
      subs.push(sub);
    }
    localStorage.setItem(DB_KEYS.SUBSCRIBERS, JSON.stringify(subs));
  }

  // --- LOGS ---
  getLogs(): ExecutionLog[] {
    return JSON.parse(localStorage.getItem(DB_KEYS.LOGS) || '[]');
  }

  addLog(log: ExecutionLog) {
    const logs = this.getLogs();
    logs.unshift(log);
    if (logs.length > 500) logs.pop();
    localStorage.setItem(DB_KEYS.LOGS, JSON.stringify(logs));
  }

  // --- UNIFIED ACCOUNTS ---
  getAllAccounts(): Account[] {
    return JSON.parse(localStorage.getItem(DB_KEYS.ACCOUNTS) || '[]');
  }

  getAccountsByPlatform(platform: Platform): Account[] {
    return this.getAllAccounts().filter(a => a.platform === platform);
  }

  getAccountByExternalId(externalId: string): Account | undefined {
    return this.getAllAccounts().find(a => a.externalId === externalId);
  }

  saveAccount(account: Account) {
    const accounts = this.getAllAccounts();
    const index = accounts.findIndex(a => a.id === account.id || a.externalId === account.externalId);
    if (index >= 0) {
      accounts[index] = account; // Update
    } else {
      accounts.push(account); // Insert
    }
    localStorage.setItem(DB_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }

  deleteAccount(id: string) {
    const accounts = this.getAllAccounts().filter(a => a.id !== id);
    localStorage.setItem(DB_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }

  // --- LEGACY ADAPTERS (For partial compatibility during refactor) ---
  // These map the old get/save calls to the new unified structure
  
  getAccounts() { return this.getAccountsByPlatform('instagram').map(this.mapToLegacyIG); }
  getWhatsAppAccounts() { return this.getAccountsByPlatform('whatsapp').map(this.mapToLegacyWA); }
  getFacebookPages() { return this.getAccountsByPlatform('facebook').map(this.mapToLegacyFB); }

  private mapToLegacyIG(a: Account) {
      return { ...a, userId: a.externalId, expiresAt: Date.now() + 99999999 };
  }
  private mapToLegacyWA(a: Account) {
      return { ...a, phoneNumberId: a.externalId, businessAccountId: a.businessAccountId || '' };
  }
  private mapToLegacyFB(a: Account) {
      return { ...a, pageId: a.externalId, pictureUrl: a.profilePictureUrl };
  }
}

export const db = new MockDatabase();
