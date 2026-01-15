
import { Flow, Subscriber, ExecutionLog, Account, Platform } from "../types";

const DB_KEYS = {
  SUBSCRIBERS: 'autochat_subscribers',
  LOGS: 'autochat_logs',
};

// This class now only handles data not critical to Phase 1, like ephemeral logs and subscribers.
// All critical data (flows, accounts, settings) is now managed by the backend API.
class MockDatabase {
  constructor() {}

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
}

export const db = new MockDatabase();
