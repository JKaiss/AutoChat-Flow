
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Instagram, Check, Trash2, Server, Facebook, RefreshCw, HelpCircle, AlertCircle, Key, Play, Activity, Search, Copy, Sparkles, ExternalLink } from 'lucide-react';
import axios from 'axios';

export const ConnectInstagram: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000');
  const [statusMsg, setStatusMsg] = useState('');
  
  // Developer Mode States
  const [isDevMode, setIsDevMode] = useState(false);
  const [manualForm, setManualForm] = useState({ id: '', token: '', name: 'Dev Account' });
  const [testRecipient, setTestRecipient] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  
  // ID Finder State
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

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

  // Manual Connection Logic
  const handleAutoDetect = async () => {
    // CRITICAL: Strip all whitespace/newlines
    const token = manualForm.token.replace(/\s/g, '');
    if (!token) {
        setStatusMsg("Paste a token first to auto-detect ID");
        return;
    }
    setStatusMsg("Detecting Account ID...");
    try {
        const verify = await axios.post(`${backendUrl}/api/instagram/verify`, { accessToken: token });
        if (verify.data.valid) {
            const igId = verify.data.data.instagram_business_account?.id;
            if (igId) {
                setManualForm(prev => ({ 
                    ...prev, 
                    id: igId,
                    token: token, // Ensure state uses the cleaned version
                    name: prev.name === 'Dev Account' ? verify.data.data.name : prev.name
                }));
                setStatusMsg("ID Found! Click Connect to finish.");
            } else {
                setStatusMsg("Token valid, but NO Instagram Business Account found linked to this Page/User.");
            }
        }
    } catch (e: any) {
        setStatusMsg("Detection Failed: " + (e.response?.data?.error || e.message));
    }
  };

  const handleManualConnect = async () => {
      const token = manualForm.token.replace(/\s/g, '');
      const id = manualForm.id.trim();

      if (!id || !token) {
          setStatusMsg("ID and Token are required");
          return;
      }

      setStatusMsg("Verifying Token with Graph API...");
      try {
          const verify = await axios.post(`${backendUrl}/api/instagram/verify`, { accessToken: token });
          if (verify.data.valid) {
              const acc = {
                  ig_id: id,
                  page_id: 'manual_page',
                  name: manualForm.name,
                  access_token: token,
                  picture: null
              };
              await connectAccount(acc);
              setStatusMsg("Manual Connection Successful!");
              setManualForm({ id: '', token: '', name: 'Dev Account' });
          }
      } catch (e: any) {
          setStatusMsg("Verification Failed: " + (e.response?.data?.error || e.message));
      }
  };

  const handleScanConversations = async (account: Account) => {
      setIsScanning(true);
      setFoundUsers([]);
      try {
          const res = await axios.post(`${backendUrl}/api/instagram/conversations`, {
              accessToken: account.accessToken,
              igId: account.externalId
          });
          setFoundUsers(res.data.participants || []);
      } catch (e: any) {
          console.error(e);
          setStatusMsg("Scan Failed: " + (e.response?.data?.error || e.message));
      } finally {
          setIsScanning(false);
      }
  };

  const handleTestSend = async (account: Account) => {
      if (!testRecipient) {
          setTestResult("Error: Enter a recipient IG User ID (Scoped ID)");
          return;
      }
      setTestResult("Sending...");
      try {
          const res = await axios.post(`${backendUrl}/api/instagram/send`, {
              to: testRecipient.trim(),
              text: "Hello from AutoChat Flow! 🚀 (Graph API Test)",
              accountId: account.externalId
          });
          setTestResult(`Success: ${JSON.stringify(res.data)}`);
      } catch (e: any) {
          console.error(e);
          setTestResult(`Failed: ${e.response?.data?.error || e.message}`);
      }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8 flex justify-between items-start">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Instagram className="text-pink-500" /> Connect Instagram
            </h2>
            <p className="text-slate-400 mt-2">Connect Instagram Business accounts linked to your Facebook Pages.</p>
        </div>
        <button 
            onClick={() => setIsDevMode(!isDevMode)}
            className={`text-xs px-3 py-1.5 rounded border flex items-center gap-2 ${isDevMode ? 'bg-purple-900/50 border-purple-500 text-purple-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
        >
            <Key size={12} /> {isDevMode ? 'Disable Developer Mode' : 'Enable Developer Mode'}
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-6">
              
              {/* Manual Connection Panel (Dev Mode) */}
              {isDevMode && (
                  <div className="bg-purple-900/10 border border-purple-500/30 rounded-xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 bg-purple-500 text-white text-[10px] font-bold rounded-bl-lg">DEV ONLY</div>
                      <h4 className="font-bold text-white mb-4 flex items-center gap-2"><Server size={16} /> Manual Access Token</h4>
                      
                      <div className="mb-4 text-xs bg-purple-900/50 p-3 rounded text-purple-200 border border-purple-500/30">
                          <p className="flex items-start gap-2">
                             <ExternalLink size={14} className="mt-0.5" />
                             <span>
                                Generate a token from the <a href="https://developers.facebook.com/tools/explorer/" target="_blank" className="underline font-bold hover:text-white">Graph API Explorer</a>. 
                                <br/>Select "Get User Access Token" &rarr; Check <code>pages_show_list</code>, <code>instagram_basic</code>, <code>instagram_manage_messages</code>.
                             </span>
                          </p>
                      </div>

                      <div className="space-y-3">
                          <div className="relative">
                            <input 
                                value={manualForm.token}
                                onChange={e => setManualForm({...manualForm, token: e.target.value})}
                                type="password"
                                placeholder="Access Token (Page Token)"
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white font-mono"
                            />
                            {manualForm.token && (
                                <div className="absolute right-2 top-2 text-[10px] text-slate-400 bg-black/50 px-1 rounded">
                                    Len: {manualForm.token.length}
                                </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                             <input 
                                value={manualForm.id}
                                onChange={e => setManualForm({...manualForm, id: e.target.value})}
                                placeholder="Instagram Business Account ID"
                                className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                             />
                             <button 
                                onClick={handleAutoDetect}
                                className="bg-slate-700 hover:bg-slate-600 px-3 rounded text-xs text-white font-bold whitespace-nowrap flex items-center gap-1"
                                title="Use Token to find ID"
                             >
                                <Sparkles size={12} /> Auto-Fill ID
                             </button>
                          </div>
                          <input 
                              value={manualForm.name}
                              onChange={e => setManualForm({...manualForm, name: e.target.value})}
                              placeholder="Account Name Label"
                              className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                          />
                          <button 
                              onClick={handleManualConnect}
                              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded text-sm"
                          >
                              Verify & Connect
                          </button>
                      </div>
                  </div>
              )}

              {/* Standard Connection Panel */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                  <h4 className="font-bold text-white mb-4">Connect New Account (OAuth)</h4>
                  
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
                          <div key={account.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                              <div className="flex justify-between items-center mb-4">
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
                                          <p className="text-xs text-slate-500 font-mono mt-1">ID: {account.externalId}</p>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => handleDisconnect(account.id)}
                                    className="text-red-400 hover:text-red-300 p-2 border border-slate-700 rounded-lg hover:bg-slate-900 transition-colors"
                                  >
                                      <Trash2 size={18} />
                                  </button>
                              </div>
                              
                              {/* Test Section */}
                              <div className="bg-slate-900/50 p-3 rounded border border-slate-700/50 space-y-3">
                                  {/* ID Finder */}
                                  {isDevMode && (
                                    <div className="border-b border-slate-700 pb-3 mb-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                <Search size={10}/> Find User IDs (IGSID)
                                            </label>
                                            <button 
                                                onClick={() => handleScanConversations(account)}
                                                className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded"
                                            >
                                                {isScanning ? 'Scanning...' : 'Scan Recent DMs'}
                                            </button>
                                        </div>
                                        {foundUsers.length > 0 ? (
                                            <div className="max-h-24 overflow-y-auto bg-black rounded p-2 space-y-1">
                                                {foundUsers.map((u, i) => (
                                                    <div key={i} className="flex justify-between items-center text-[10px] text-slate-300">
                                                        <span>@{u.username}</span>
                                                        <button 
                                                            onClick={() => { navigator.clipboard.writeText(u.id); setTestRecipient(u.id); }}
                                                            className="flex items-center gap-1 hover:text-white"
                                                            title="Copy ID"
                                                        >
                                                            <span className="font-mono">{u.id}</span> <Copy size={8} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-slate-600 italic">No recent conversations found. Send a DM to this account first.</p>
                                        )}
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1"><Activity size={10}/> Test Graph API Send</label>
                                    <div className="flex gap-2">
                                        <input 
                                            value={testRecipient}
                                            onChange={e => setTestRecipient(e.target.value)}
                                            placeholder="Recipient IG User ID"
                                            className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                                        />
                                        <button onClick={() => handleTestSend(account)} className="bg-blue-600 px-3 py-1 rounded text-xs text-white font-bold flex items-center gap-1">
                                            <Play size={10} /> Send
                                        </button>
                                    </div>
                                    {testResult && <div className="mt-2 text-[10px] font-mono p-2 bg-black rounded text-green-300 break-all">{testResult}</div>}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
              
              {statusMsg && <div className="bg-slate-800 border-l-4 border-yellow-500 p-4 rounded text-sm text-slate-300 break-words">{statusMsg}</div>}
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
