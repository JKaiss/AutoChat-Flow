
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Facebook, Check, Trash2, Send, HelpCircle, AlertTriangle, Loader, CheckCircle } from 'lucide-react';
import axios from 'axios';

export const ConnectFacebook: React.FC = () => {
  const [connectedPages, setConnectedPages] = useState<Account[]>([]);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const authProcessed = useRef(false);

  useEffect(() => {
    setConnectedPages(db.getAccountsByPlatform('facebook'));
    checkForOAuthCallback();
  }, []);

  const checkForOAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    // Server sends 'facebook' as state for FB flow
    if (code && state === 'facebook' && !authProcessed.current) {
        authProcessed.current = true;
        setIsConnecting(true);
        setStatusMsg("Exchanging code for pages...");
        
        axios.get(`/auth/facebook/callback`, { params: { code, state } })
            .then(res => {
                if (res.data.pages) {
                    setAvailablePages(res.data.pages);
                    setStatusMsg(`Found ${res.data.pages.length} pages available.`);
                } else {
                    setStatusMsg("No pages found for this account.");
                }
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(err => {
                console.error("FB Auth Error", err);
                setStatusMsg("Auth Failed: " + (err.response?.data?.error || err.message));
            })
            .finally(() => setIsConnecting(false));
    }
  };

  const startOAuth = () => {
    setStatusMsg("Redirecting to Facebook...");
    window.location.href = `/auth/facebook/login?flow=facebook`;
  };

  const connectPage = async (page: any) => {
    try {
        await axios.post(`/api/register-account`, {
            externalId: page.id,
            platform: 'facebook',
            name: page.name,
            accessToken: page.access_token
        });
        
        const newAccount: Account = {
            id: `fb_${page.id}`,
            platform: 'facebook',
            externalId: page.id,
            name: page.name,
            accessToken: page.access_token,
            connectedAt: Date.now(),
            status: 'active',
            profilePictureUrl: page.picture?.data?.url
        };
        
        db.saveAccount(newAccount);
        setConnectedPages(prev => [...prev, newAccount]);
        setAvailablePages(prev => prev.filter(p => p.id !== page.id));
        setStatusMsg(`Connected to ${page.name}`);
    } catch (e) {
        setStatusMsg("Failed to save connection to backend");
    }
  };

  const disconnectPage = (id: string) => {
      db.deleteAccount(id);
      setConnectedPages(db.getAccountsByPlatform('facebook'));
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
                
                {isConnecting ? (
                    <div className="flex flex-col items-center py-8 text-blue-400 gap-3">
                        <Loader className="animate-spin" size={32} />
                        <span className="font-medium">Fetching your pages...</span>
                    </div>
                ) : availablePages.length === 0 ? (
                    <div className="text-center py-6">
                        <button 
                            onClick={startOAuth}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 w-full transition-all hover:scale-[1.02]"
                        >
                            <Facebook size={20} /> Continue with Facebook
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center mb-4">
                             <p className="text-sm text-blue-300 font-bold">Select Pages to Connect:</p>
                             <button onClick={() => setAvailablePages([])} className="text-xs text-slate-500 hover:text-white underline">Cancel</button>
                        </div>
                        {availablePages.map(page => (
                            <div key={page.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-blue-500/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    {page.picture?.data?.url ? (
                                        <img src={page.picture.data.url} className="w-8 h-8 rounded-full border border-slate-700" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">{page.name.charAt(0)}</div>
                                    )}
                                    <span className="font-bold text-sm text-white">{page.name}</span>
                                </div>
                                <button 
                                    onClick={() => connectPage(page)}
                                    className="text-xs bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white font-bold transition-all"
                                >
                                    Connect
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                
                {statusMsg && (
                    <div className="mt-4 bg-slate-800/50 p-3 rounded text-xs text-slate-400 border border-slate-700/50 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                        {statusMsg}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Connected Pages</h3>
                {connectedPages.length === 0 && !isConnecting && (
                    <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-600 text-sm">
                        No pages connected yet.
                    </div>
                )}
                {connectedPages.map(page => (
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
                            <button onClick={() => disconnectPage(page.id)} className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-slate-900 transition-all">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                <Send size={10} /> Send Test Message
                            </h5>
                            <div className="space-y-3">
                                 <input 
                                    value={testRecipient}
                                    onChange={e => setTestRecipient(e.target.value)}
                                    placeholder="Recipient PSID (User ID)"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none"
                                />
                                <div className="flex gap-2">
                                    <input 
                                        value={testMessage}
                                        onChange={e => setTestMessage(e.target.value)}
                                        placeholder="Hello! This is a test..."
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                    <button 
                                        onClick={() => handleTestSend(page)}
                                        className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-lg text-white text-sm font-bold shadow-lg shadow-blue-900/20"
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-8 h-fit">
            <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-400" /> Connection Guide
            </h3>
            
            <div className="space-y-6 text-sm text-slate-400">
                <div>
                    <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-yellow-500" /> Admin Role Required
                    </h4>
                    <p className="leading-relaxed">
                        To connect a Facebook Page for automated messaging, you must have an <strong>Admin</strong> role on that page. Meta restricts API access for Editor and Moderator roles.
                    </p>
                </div>

                <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-800/50">
                    <h4 className="font-bold text-blue-200 mb-2 underline decoration-blue-500/50">Important Meta Settings</h4>
                    <ul className="list-disc pl-4 space-y-3 text-blue-100/70 text-xs">
                        <li>Ensure <strong>'Messages'</strong> is enabled in your Page Settings.</li>
                        <li>In your Meta App Dashboard, ensure the <strong>'Messenger'</strong> product is added.</li>
                        <li>Whitelist your domain in the <strong>'App Settings &gt; Webhooks'</strong> section if testing in production.</li>
                    </ul>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
