
import { Flow, Subscriber, ExecutionLog, Account, Platform } from "../types";

const DB_KEYS = {
  FLOWS: 'autochat_flows',
  SUBSCRIBERS: 'autochat_subscribers',
  LOGS: 'autochat_logs',
  ACCOUNTS: 'autochat_accounts_v2', // Unified storage
};

class MockDatabase {
  constructor() {
    // Seeding logic is now handled by the backend or migrations
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

  // --- UNIFIED ACCOUNTS (Still mock for now) ---
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
}

export const db = new MockDatabase();
