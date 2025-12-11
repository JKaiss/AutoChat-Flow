import { TriggerType, NodeType } from "./types";

export const TRIGGER_TYPES: { type: TriggerType; label: string; icon: string; channel: 'ig' | 'wa' | 'fb' | 'all' }[] = [
  { type: 'keyword', label: 'Keyword Match', icon: 'Type', channel: 'all' },
  
  // Instagram
  { type: 'instagram_comment', label: 'IG Comment', icon: 'MessageCircle', channel: 'ig' },
  { type: 'instagram_dm', label: 'IG DM', icon: 'Send', channel: 'ig' },
  { type: 'instagram_story_mention', label: 'IG Story Mention', icon: 'Instagram', channel: 'ig' },
  
  // WhatsApp
  { type: 'whatsapp_message', label: 'WA Message', icon: 'MessageSquare', channel: 'wa' },
  { type: 'whatsapp_button_reply', label: 'WA Button Reply', icon: 'MousePointerClick', channel: 'wa' },
  { type: 'whatsapp_list_reply', label: 'WA List Reply', icon: 'List', channel: 'wa' },
  { type: 'whatsapp_media', label: 'WA Media', icon: 'Image', channel: 'wa' },

  // Messenger
  { type: 'messenger_text', label: 'FB Message', icon: 'Facebook', channel: 'fb' },
  { type: 'messenger_postback', label: 'FB Postback', icon: 'MousePointer', channel: 'fb' },
  { type: 'messenger_quick_reply', label: 'FB Quick Reply', icon: 'Zap', channel: 'fb' },
  { type: 'messenger_attachment', label: 'FB Attachment', icon: 'Paperclip', channel: 'fb' },
];

export const NODE_TYPES: { type: NodeType; label: string; color: string; description: string }[] = [
  { type: 'message', label: 'Send Message', color: 'bg-blue-600', description: 'Send a text reply' },
  { type: 'delay', label: 'Delay', color: 'bg-orange-500', description: 'Wait for a duration' },
  { type: 'question', label: 'Collect Input', color: 'bg-purple-600', description: 'Save user reply to variable' },
  { type: 'condition', label: 'Check Condition', color: 'bg-yellow-600', description: 'Branch logic' },
  { type: 'ai_generate', label: 'AI Reply', color: 'bg-emerald-600', description: 'Generate text with Gemini' },
];

export const MOCK_DELAY = 500; // Simulated network delay
