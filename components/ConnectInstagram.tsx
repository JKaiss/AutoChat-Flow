
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Instagram, Check, Trash2, Server, Facebook, RefreshCw, HelpCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

export const ConnectInstagram: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    setAccounts(db.getAccountsByPlatform('instagram'));
    checkForOAuthCallback();
  }, []);

  const checkForOAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state'); // We expect this to contain { flow: 'instagram' } if we did it properly

    if (code) {
        setIsConnecting(true);
        // Call backend to exchange code
        axios.get(`${backendUrl}/auth/facebook/callback`, { params: { code, state } })
            .then(res => {
                const pages = res.data.pages || [];
                // Filter pages that have a linked instagram business account
                const igAccounts = pages
                    .filter((p: any) => p.instagram_id)
                    .map((p: any) => ({
                        ig_id: p.instagram_id,
                        page_id: p.id,
                        name: p.name + " (IG)", // Usually we'd fetch the IG handle, but for MVP we use Page Name + suffix
                        access_token: p.access_token,
                        picture: p.picture
                    }));
                
                setAvailableAccounts(igAccounts);
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(err => {
                console.error("IG Auth Error", err);
                setStatusMsg("Auth Failed: " + err.message);
            })
            .finally(() => setIsConnecting(false));
    }
  };

  const startOAuth = () => {
    // We trigger the same FB login flow, but the backend will know it's for Instagram based on context if we needed
    window.location.href = `${backendUrl}/auth/facebook/login?flow=instagram`;
  };

  const connectAccount = async (acc: any) => {
    try {
        await axios.post(`${backendUrl}/api/instagram/connect`, {
            igId: acc.ig_id,
            pageId: acc.page_id,
            accessToken: acc.access_token,
            name: acc.name
        });
        
        const newAccount: Account = {
            id: `ig_${acc.ig_id}`,
            platform: 'instagram',
            externalId: acc.ig_id,
            name: acc.name,
            accessToken: acc.access_token, // IG Graph API uses Page Token
            connectedAt: Date.now(),
            status: 'active',
            pageId: acc.page_id,
            profilePictureUrl: acc.picture?.data?.url
        };
        
        db.saveAccount(newAccount);
        setAccounts([...accounts, newAccount]);
        setAvailableAccounts(availableAccounts.filter(a => a.ig_id !== acc.ig_id));
        setStatusMsg(`Connected ${acc.name}`);
    } catch (e) {
        setStatusMsg("Failed to register with backend");
    }
  };

  const handleDisconnect = (id: string) => {
      db.deleteAccount(id);
      setAccounts(db.getAccountsByPlatform('instagram'));
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Instagram className="text-pink-500" /> Connect Instagram
        </h2>
        <p className="text-slate-400 mt-2">Connect Instagram Business accounts linked to your Facebook Pages.</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-6">
              
              {/* Connection Panel */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                  <h4 className="font-bold text-white mb-4">Connect New Account</h4>
                  
                  {!isConnecting && availableAccounts.length === 0 && (
                      <div className="text-center py-6">
                          <button 
                            onClick={startOAuth}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-3 w-full transition-all hover:scale-105"
                          >
                              <Facebook size={20} /> Login with Facebook
                          </button>
                          <p className="text-xs text-slate-500 mt-4 max-w-xs mx-auto">
                              Instagram Graph API requires login via the linked Facebook account.
                          </p>
                      </div>
                  )}

                  {availableAccounts.length > 0 && (
                      <div className="space-y-3">
                          <p className="text-sm text-green-400 mb-2">Found {availableAccounts.length} Instagram Accounts:</p>
                          {availableAccounts.map(acc => (
                              <div key={acc.ig_id} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
                                  <div className="flex items-center gap-3">
                                      <span className="font-bold text-sm">{acc.name}</span>
                                  </div>
                                  <button 
                                      onClick={() => connectAccount(acc)}
                                      className="text-xs bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded text-white font-bold"
                                  >
                                      Connect
                                  </button>
                              </div>
                          ))}
                          <button onClick={startOAuth} className="w-full mt-4 text-xs text-slate-500 hover:text-white flex items-center justify-center gap-1">
                              <RefreshCw size={12} /> Refresh List
                          </button>
                      </div>
                  )}
              </div>

              {/* Connected Accounts List */}
              {accounts.length > 0 && (
                  <div className="space-y-4">
                      <h3 className="font-bold text-white">Connected Accounts</h3>
                      {accounts.map(account => (
                          <div key={account.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex justify-between items-center">
                              <div className="flex items-center gap-4">
                                  {account.profilePictureUrl ? (
                                      <img src={account.profilePictureUrl} className="w-12 h-12 rounded-full" alt="Profile" />
                                  ) : (
                                      <div className="w-12 h-12 bg-pink-600 rounded-full flex items-center justify-center font-bold">{account.name.charAt(0)}</div>
                                  )}
                                  <div>
                                      <h3 className="font-bold text-white text-lg">{account.name}</h3>
                                      <p className="text-xs text-green-400 flex items-center gap-1">
                                          <Check size={12} /> Connected
                                      </p>
                                      <p className="text-xs text-slate-500 font-mono mt-1">IG ID: {account.externalId}</p>
                                  </div>
                              </div>
                              <button 
                                onClick={() => handleDisconnect(account.id)}
                                className="text-red-400 hover:text-red-300 p-2 border border-slate-700 rounded-lg hover:bg-slate-900 transition-colors"
                              >
                                  <Trash2 size={18} />
                              </button>
                          </div>
                      ))}
                  </div>
              )}
              
              {statusMsg && <div className="bg-slate-800 border-l-4 border-yellow-500 p-4 rounded text-sm text-slate-300">{statusMsg}</div>}
          </div>

          {/* Right Column: Help & Requirements */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 h-fit">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <HelpCircle size={20} className="text-pink-400" /> Requirements Checklist
              </h3>
              
              <div className="space-y-6 text-sm text-slate-400">
                  <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 font-bold text-slate-300">1</div>
                      <div>
                          <h4 className="font-bold text-slate-200">Switch to Professional Account</h4>
                          <p className="mt-1">
                             Your Instagram account must be a <strong>Business</strong> or <strong>Creator</strong> account. Personal profiles are not supported by the API.
                          </p>
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 font-bold text-slate-300">2</div>
                      <div>
                          <h4 className="font-bold text-slate-200">Link to a Facebook Page</h4>
                          <p className="mt-1">
                             You must link your Instagram account to a Facebook Page you manage. 
                             <br/><span className="text-xs italic opacity-70">(IG Settings &gt; Business &gt; Connect a Facebook Page)</span>
                          </p>
                      </div>
                  </div>

                  <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 font-bold text-slate-300">3</div>
                      <div>
                          <h4 className="font-bold text-slate-200">Allow Access to Messages</h4>
                          <p className="mt-1">
                             In Instagram App: Settings &gt; Privacy &gt; Messages &gt; <strong>Allow Access to Messages</strong> must be toggled ON.
                          </p>
                      </div>
                  </div>

                  <div className="bg-pink-900/20 p-4 rounded-lg border border-pink-800/50 flex items-start gap-3 mt-4">
                      <AlertCircle className="text-pink-400 shrink-0 mt-0.5" size={16} />
                      <div className="text-xs text-pink-100/80">
                          <strong>Missing Account?</strong> If you don't see your Instagram account in the list, ensure all 3 steps above are completed, then click "Refresh List" or try logging in again.
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
