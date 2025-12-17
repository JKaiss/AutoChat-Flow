
export type TriggerType = 
  | 'keyword' 
  | 'instagram_comment' 
  | 'instagram_dm' 
  | 'instagram_story_mention'
  | 'instagram_reel_comment'
  | 'whatsapp_message'
  | 'whatsapp_button_reply'
  | 'whatsapp_list_reply'
  | 'whatsapp_media'
  | 'messenger_text'
  | 'messenger_postback'
  | 'messenger_quick_reply'
  | 'messenger_attachment';

export type NodeType = 'message' | 'delay' | 'question' | 'condition' | 'ai_generate';
export type Platform = 'instagram' | 'facebook' | 'whatsapp';
export type PlanTier = 'free' | 'pro' | 'business';

export interface Position {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  position: Position;
  data: {
    label?: string;
    content?: string; 
    variable?: string; 
    delayMs?: number;
    conditionVar?: string;
    conditionValue?: string;
    aiPrompt?: string; 
    accountId?: string; 
  };
  nextId?: string; 
  falseNextId?: string; 
}

export interface Flow {
  id: string;
  name: string;
  triggerType: TriggerType;
  triggerKeyword?: string; 
  triggerAccountId?: string; 
  triggerConditions?: Record<string, any>; 
  nodes: FlowNode[];
  active: boolean;
  createdAt: number;
}

export interface Subscriber {
  id: string;
  username: string;
  channel: Platform;
  phoneNumber?: string; 
  instagram_id?: string;
  messenger_id?: string; 
  profilePictureUrl?: string;
  data: Record<string, any>; 
  lastInteraction: number;
}

export interface Account {
  id: string; 
  platform: Platform;
  externalId: string; 
  name: string;
  accessToken: string;
  connectedAt: number;
  profilePictureUrl?: string;
  status: 'active' | 'error';
  lastError?: string; // New: Stores the last API error message
  lastChecked?: number; // New: Timestamp of last successful/failed check
  businessAccountId?: string; 
  pageId?: string; 
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: number;
  type?: 'text' | 'image';
  channel?: Platform;
  accountId?: string; 
}

export interface ExecutionLog {
  id: string;
  flowId: string;
  subscriberId: string;
  nodeId: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: number;
  output?: string;
}

export interface AppSettings {
  metaAppId?: string;
  metaAppSecret?: string;
  publicUrl?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  plan: PlanTier;
  createdAt: number;
}

export interface UsageStats {
  transactions: number;
  limit: number;
  aiEnabled: boolean;
  maxAccounts: number;
  currentAccounts: number;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  usage: UsageStats;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  refreshUsage: () => Promise<void>;
  triggerUpgrade: (reason?: string) => void;
  isLoading: boolean;
}

export const PLANS: Record<PlanTier, { 
  priceId: string; 
  name: string; 
  limit: number; 
  ai: boolean; 
  accounts: number 
}> = {
  free: { priceId: '', name: 'Free', limit: 100, ai: false, accounts: 1 },
  pro: { priceId: 'price_pro_dummy', name: 'Pro', limit: 5000, ai: true, accounts: 5 },
  business: { priceId: 'price_biz_dummy', name: 'Business', limit: 25000, ai: true, accounts: 999 },
};
