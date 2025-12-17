
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Facebook, Check, Trash2, Send, HelpCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';

export const ConnectFacebook: React.FC = () => {
  const [connectedPages, setConnectedPages] = useState<Account[]>([]);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  // FIXED: Removed backendUrl state (it was hardcoded to localhost:3000)
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

    if (code && state === 'fb_connect' && !authProcessed.current) {
        authProcessed.current = true;
        setIsConnecting(true);
        // FIXED: Use relative path
        axios.get(`/auth/facebook/callback`, { params: { code } })
            .then(res => {
                setAvailablePages(res.data.pages);
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(err => {
                console.error("FB Auth Error", err);
                setStatusMsg("Auth Failed: " + err.message);
            })
            .finally(() => setIsConnecting(false));
    }
  };

  const startOAuth = () => {
    // FIXED: Use relative path, let server middleware handle redirect
    window.location.href = `/auth/facebook/login?flow=facebook`;
  };

  const connectPage = async (page: any) => {
    try {
        // FIXED: Use relative path
        await axios.post(`/api/facebook/connect`, {
            pageId: page.id,
            accessToken: page.access_token,
            name: page.name
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
        setConnectedPages([...connectedPages, newAccount]);
        setAvailablePages(availablePages.filter(p => p.id !== page.id));
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
          // FIXED: Use relative path
          await axios.post(`/api/messenger/send`, {
              to: testRecipient,
              text: testMessage || "Hello from AutoChat Flow!",
              pageId: page.externalId
          });
          setStatusMsg("Message sent!");
      } catch (e: any) {
          setStatusMsg("Error sending: " + (e.response?.data?.error?.message || e.message));
      }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Facebook className="text-blue-500" /> Connect Facebook Pages (Messenger)
        </h2>
        <p className="text-slate-400 mt-2">Connect your Facebook Pages to automate Messenger replies.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* Left Column: Connected Pages & List */}
        <div className="space-y-6">
            
            {/* Connection Panel */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                <h4 className="font-bold text-white mb-4">Connect New Page</h4>
                
                {!isConnecting && availablePages.length === 0 && (
                    <div className="text-center py-6">
                        <button 
                            onClick={startOAuth}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 w-full transition-all hover:scale-105"
                        >
                            <Facebook size={20} /> Continue with Facebook
                        </button>
                        <p className="text-xs text-slate-500 mt-4">
                            You will be redirected to Facebook to authorize permissions.
                        </p>
                    </div>
                )}

                {/* List of fetched pages */}
                {availablePages.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-sm text-green-400 mb-2">Found {availablePages.length} Pages. Select to connect:</p>
                        {availablePages.map(page => (
                            <div key={page.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-3">
                                    {page.picture?.data?.url && <img src={page.picture.data.url} className="w-8 h-8 rounded-full" />}
                                    <span className="font-bold text-sm">{page.name}</span>
                                </div>
                                <button 
                                    onClick={() => connectPage(page)}
                                    className="text-xs bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded text-white font-bold"
                                >
                                    Connect
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Connected Pages List */}
            {connectedPages.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-bold text-white">Connected Pages</h3>
                    {connectedPages.map(page => (
                        <div key={page.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    {page.profilePictureUrl ? (
                                        <img src={page.profilePictureUrl} className="w-12 h-12 rounded-full" />
                                    ) : (
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                                            {page.name.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-bold text-white">{page.name}</h4>
                                        <p className="text-xs text-green-400 flex items-center gap-1">
                                            <Check size={12} /> Active
                                        </p>
                                        <p className="text-xs text-slate-500 font-mono mt-1">ID: {page.externalId}</p>
                                    </div>
                                </div>
                                <button onClick={() => disconnectPage(page.id)} className="text-red-400 hover:text-red-300">
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Test Messenger</h5>
                                <div className="space-y-2">
                                     <input 
                                        value={testRecipient}
                                        onChange={e => setTestRecipient(e.target.value)}
                                        placeholder="Recipient PSID (User ID)"
                                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                    />
                                    <div className="flex gap-2">
                                        <input 
                                            value={testMessage}
                                            onChange={e => setTestMessage(e.target.value)}
                                            placeholder="Message Text..."
                                            className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                        />
                                        <button 
                                            onClick={() => handleTestSend(page)}
                                            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white text-sm font-bold flex items-center gap-2"
                                        >
                                            <Send size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {statusMsg && <div className="bg-slate-800 border-l-4 border-yellow-500 p-4 rounded text-sm text-slate-300">{statusMsg}</div>}
        </div>

        {/* Right Column: Help & Troubleshooting */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 h-fit">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-400" /> Connection Guide
            </h3>
            
            <div className="space-y-6 text-sm text-slate-400">
                <div>
                    <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-yellow-500" /> Prerequisite: Admin Role
                    </h4>
                    <p className="leading-relaxed">
                        You must be an <strong>Admin</strong> of the Facebook Page you want to connect. 
                        Editor or Moderator roles may not have sufficient permissions to manage webhooks and automated messaging.
                    </p>
                </div>

                <div>
                    <h4 className="font-bold text-slate-200 mb-2">How to Connect</h4>
                    <ol className="list-decimal pl-4 space-y-2">
                        <li>Click the <strong>"Continue with Facebook"</strong> button.</li>
                        <li>A popup will appear. Login to your Facebook account.</li>
                        <li>Select <strong>all</strong> the Pages you want to use with this bot.</li>
                        <li>Ensure all permissions (Manage Pages, Manage Messages) are checked.</li>
                        <li>Click "Done". The available pages will appear in the list on the left.</li>
                    </ol>
                </div>

                <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800/50">
                    <h4 className="font-bold text-blue-200 mb-2">Troubleshooting</h4>
                    <ul className="list-disc pl-4 space-y-2 text-blue-100/70">
                        <li>If a Page is missing, you may have unchecked it during a previous login.</li>
                        <li>To fix, remove this app from your <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" className="underline hover:text-white">Facebook Business Integrations</a> and try again.</li>
                        <li>Ensure your Page is published and visible to the public.</li>
                    </ul>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
