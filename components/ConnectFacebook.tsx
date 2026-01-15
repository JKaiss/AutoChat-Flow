
import React, { useState, useEffect, useRef } from 'react';
import { Account } from '../types';
import { Facebook, Trash2, Send, Loader, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export const ConnectFacebook: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const { token } = useAuth();

  const popupRef = useRef<Window | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await axios.get('/api/accounts?platform=facebook');
      setAccounts(res.data);
    } catch (e) {
      console.error("Failed to fetch FB accounts", e);
    }
  };

  useEffect(() => {
    fetchAccounts();
    
    const interval = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
            popupRef.current = null;
            setStatusMsg("Connection window closed. Refreshing accounts...");
            setIsConnecting(false);
            setTimeout(fetchAccounts, 1000); // Give backend a moment to process
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [token]);

  const startOAuth = () => {
    setStatusMsg("Opening connection window...");
    setIsConnecting(true);
    const oauthUrl = `/auth/facebook/login?flow=facebook&token=${token}`;
    const width = 600, height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    popupRef.current = window.open(oauthUrl, 'oauth', `width=${width},height=${height},left=${left},top=${top}`);
  };
  
  const removeAccount = async (id: string) => {
    try {
      await axios.delete(`/api/accounts/${id}`);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      alert("Failed to remove account.");
    }
  };

  const handleTestSend = async (page: Account) => {
      if (!testRecipient) {
          setStatusMsg("Enter a PSID (User ID) first.");
          return;
      }
      try {
          await axios.post(`/api/facebook/send`, {
              to: testRecipient,
              text: testMessage || "Hello from AutoChat Flow!",
              accountId: page.externalId
          });
          setStatusMsg("Message sent successfully!");
      } catch (e: any) {
          setStatusMsg("Error sending: " + (e.response?.data?.error?.message || e.message));
      }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Facebook className="text-blue-500" /> Facebook Messenger
        </h2>
        <p className="text-slate-400 mt-2">Connect your Facebook Pages to automate Messenger replies.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                <h4 className="font-bold text-white mb-4">Connect New Page</h4>
                
                <div className="text-center py-6">
                    <button 
                        onClick={startOAuth}
                        disabled={isConnecting}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 w-full transition-all hover:scale-[1.02] disabled:opacity-50"
                    >
                        {isConnecting ? <Loader className="animate-spin" /> : <Facebook size={20} />}
                        {isConnecting ? 'Waiting for Connection...' : 'Continue with Facebook'}
                    </button>
                </div>
                
                {statusMsg && (
                    <div className="mt-4 bg-slate-800/50 p-3 rounded text-xs text-slate-400 border border-slate-700/50 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                        {statusMsg}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Connected Pages</h3>
                {accounts.length === 0 && !isConnecting && (
                    <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-600 text-sm">
                        No pages connected yet.
                    </div>
                )}
                {accounts.map(page => (
                    <div key={page.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6 group">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                {page.profilePictureUrl ? (
                                    <img src={page.profilePictureUrl} className="w-12 h-12 rounded-full border-2 border-slate-700" />
                                ) : (
                                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                                        {page.name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-white text-lg">{page.name}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-green-800/50">
                                            <CheckCircle size={10} /> Active
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">ID: {page.externalId}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => removeAccount(page.id)} className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-slate-900 transition-all">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                <Send size={10} /> Send Test Message
                            </h5>
                            {/* ... test send form ... */}
                        </div>
                    </div>
                ))}
            </div>
        </div>
        {/* ... Guide section ... */}
      </div>
    </div>
  );
};
