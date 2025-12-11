
import React, { useState, useEffect, useRef } from 'react';
import { AutomationEngine } from '../services/engine';
import { ChatMessage, TriggerType, Account, Platform } from '../types';
import { db } from '../services/db';
import { Send, Instagram, Phone, Facebook, WifiOff, MessageSquare, AtSign, MessageCircle } from 'lucide-react';

export const Simulator: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [manualPayload, setManualPayload] = useState('');
  const [activeChannel, setActiveChannel] = useState<Platform>('instagram');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const engineRef = useRef<AutomationEngine | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const allAccounts = db.getAllAccounts();
    setAccounts(allAccounts);
    
    // Default account selection logic
    const relevant = allAccounts.filter(a => a.platform === activeChannel);
    if (relevant.length > 0) {
        setSelectedAccountId(relevant[0].externalId);
    } else {
        setSelectedAccountId('virtual_test_account');
    }

    engineRef.current = new AutomationEngine((msg) => {
      setMessages(prev => [...prev, msg]);
    });
    setMessages([{ id: 'init', sender: 'bot', text: 'Simulator Ready. Select an event type to test.', timestamp: Date.now() }]);
  }, []);

  // Update selected account when channel changes
  useEffect(() => {
    const relevant = accounts.filter(a => a.platform === activeChannel);
    if (relevant.length > 0) {
        setSelectedAccountId(relevant[0].externalId);
    } else {
        setSelectedAccountId('virtual_test_account');
    }
  }, [activeChannel, accounts]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleTrigger = (type: TriggerType, content: string) => {
    if (!content.trim()) return;

    const targetAccount = selectedAccountId || 'virtual_test_account';
    
    // Visual feedback in chat for user actions
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: `[${type.replace('instagram_', '').replace('whatsapp_', '').replace('messenger_', '').toUpperCase()}] ${content}`,
      timestamp: Date.now(),
      channel: activeChannel,
      accountId: targetAccount
    };
    setMessages(prev => [...prev, userMsg]);

    engineRef.current?.triggerEvent(type, { 
        text: content, 
        subscriberId: `test_user_${activeChannel}`, 
        username: 'test_user',
        targetAccountId: targetAccount
    });
  };

  const handlePhoneSend = () => {
      let trigger: TriggerType = 'instagram_dm';
      if (activeChannel === 'whatsapp') trigger = 'whatsapp_message';
      if (activeChannel === 'facebook') trigger = 'messenger_text';
      
      handleTrigger(trigger, inputValue);
      setInputValue('');
  };

  const activeAccountName = selectedAccountId === 'virtual_test_account' 
    ? 'Virtual Account' 
    : (accounts.find(a => a.externalId === selectedAccountId)?.name || 'Unknown');

  return (
    <div className="flex h-full bg-slate-900 p-8 gap-8 justify-center overflow-y-auto">
      {/* Controls Panel */}
      <div className="w-80 flex flex-col gap-6 shrink-0">
        
        {/* Channel Switcher */}
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
            {(['instagram', 'whatsapp', 'facebook'] as Platform[]).map(ch => (
                <button 
                    key={ch}
                    onClick={() => setActiveChannel(ch)}
                    className={`flex-1 py-2 rounded font-bold text-xs flex justify-center items-center gap-1 uppercase ${activeChannel === ch ? 'bg-slate-700 text-white shadow' : 'text-slate-500'}`}
                >
                    {ch === 'instagram' && <Instagram size={14} />}
                    {ch === 'whatsapp' && <Phone size={14} />}
                    {ch === 'facebook' && <Facebook size={14} />}
                    {ch.slice(0, 2)}
                </button>
            ))}
        </div>

        {/* Account Switcher */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">Simulate Event On:</label>
            <select 
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-slate-900 text-white text-sm p-2 rounded border border-slate-600 outline-none"
            >
                {accounts.filter(a => a.platform === activeChannel).map(acc => (
                    <option key={acc.id} value={acc.externalId}>{acc.name} ({acc.externalId})</option>
                ))}
                <option value="virtual_test_account">Virtual Test Account (Offline)</option>
            </select>
        </div>

        {/* Manual Triggers Panel */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex-1 flex flex-col">
             <h3 className="font-bold text-white mb-4">Event Trigger Simulator</h3>
             
             <div className="mb-4">
                 <label className="text-xs font-bold text-slate-500 mb-2 block">EVENT PAYLOAD</label>
                 <textarea 
                    value={manualPayload}
                    onChange={(e) => setManualPayload(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white h-24 resize-none focus:border-blue-500 outline-none"
                    placeholder="Type the text content here (e.g. 'price', 'hello')..."
                 />
             </div>

             <div className="grid grid-cols-1 gap-2">
                 {activeChannel === 'instagram' && (
                     <>
                        <button 
                            onClick={() => handleTrigger('instagram_dm', manualPayload)}
                            className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded text-xs font-bold flex items-center justify-center gap-2"
                        >
                            <Send size={14} /> Simulate DM
                        </button>
                        <button 
                            onClick={() => handleTrigger('instagram_comment', manualPayload)}
                            className="bg-pink-600 hover:bg-pink-500 text-white py-2 px-4 rounded text-xs font-bold flex items-center justify-center gap-2"
                        >
                            <MessageSquare size={14} /> Simulate Comment
                        </button>
                        <button 
                            onClick={() => handleTrigger('instagram_story_mention', manualPayload)}
                            className="bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded text-xs font-bold flex items-center justify-center gap-2"
                        >
                            <AtSign size={14} /> Simulate Story Mention
                        </button>
                     </>
                 )}
                 {activeChannel === 'whatsapp' && (
                     <button 
                        onClick={() => handleTrigger('whatsapp_message', manualPayload)}
                        className="bg-green-600 hover:bg-green-500 text-white py-2 px-4 rounded text-xs font-bold flex items-center justify-center gap-2"
                    >
                        <MessageCircle size={14} /> Simulate Message
                    </button>
                 )}
                 {activeChannel === 'facebook' && (
                     <button 
                        onClick={() => handleTrigger('messenger_text', manualPayload)}
                        className="bg-blue-600 hover:bg-blue-500 text-white py-2 px-4 rounded text-xs font-bold flex items-center justify-center gap-2"
                    >
                        <MessageCircle size={14} /> Simulate Messenger
                    </button>
                 )}
             </div>
             
             <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-[10px] text-slate-400">
                    <strong>Tip:</strong> Use "Comment" or "Story Mention" buttons to test flows triggered by those specific events. The chat log will show the event type.
                </p>
             </div>
        </div>
      </div>

      {/* Phone Frame */}
      <div className="w-[380px] h-[600px] shrink-0 bg-black rounded-[3rem] border-8 border-slate-800 relative shadow-2xl flex flex-col overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-slate-800 rounded-b-xl z-20"></div>
        <div className="h-12 bg-slate-950 flex items-center justify-between px-6 pt-2 z-10 text-xs text-white"><span>9:41</span></div>
        
        <div className="border-b border-slate-800 p-4 flex items-center gap-3 pt-2 bg-slate-900">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${activeChannel === 'whatsapp' ? 'bg-green-600' : activeChannel === 'facebook' ? 'bg-blue-600' : 'bg-pink-600'}`}>
               {activeAccountName.charAt(0)}
            </div>
            <div>
                <h4 className="font-bold text-sm text-white">{activeAccountName}</h4>
                <p className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
                   {selectedAccountId === 'virtual_test_account' && <WifiOff size={8} />}
                   {selectedAccountId === 'virtual_test_account' ? 'Offline Mode' : `${activeChannel} Bot`}
                </p>
            </div>
        </div>

        <div 
            className={`flex-1 overflow-y-auto p-4 space-y-3 ${activeChannel === 'whatsapp' ? 'bg-[#0b141a]' : 'bg-black'}`} 
            ref={scrollRef}
        >
            {messages.filter(m => m.id !== 'init').map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm break-words ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                        {msg.text}
                    </div>
                </div>
            ))}
        </div>

        <div className="bg-slate-900 p-4 pb-8">
            <div className="flex items-center gap-2 bg-slate-800 rounded-full px-4 py-2 border border-slate-700">
                <input 
                    className="bg-transparent border-none outline-none text-white text-sm flex-1"
                    placeholder="Quick Reply..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePhoneSend()}
                />
                <button onClick={handlePhoneSend} className="text-blue-500 font-bold text-xs"><Send size={16}/></button>
            </div>
        </div>
      </div>
    </div>
  );
};
