
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Instagram, AlertCircle, ShieldAlert, Sparkles, Trash2, CheckCircle, WifiOff, Loader, HelpCircle } from 'lucide-react';
import axios from 'axios';

export const ConnectInstagram: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const authProcessed = useRef(false);

  useEffect(() => {
    setAccounts(db.getAccountsByPlatform('instagram'));
    axios.get('/api/config/status')
      .then(res => setIsConfigured(res.data.metaConfigured))
      .finally(() => {
          setIsLoading(false);
          checkForOAuthCallback();
      });
  }, []);

  const checkForOAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    // Server sends 'instagram' as state for IG flow
    if (code && state === 'instagram' && !authProcessed.current) {
        authProcessed.current = true;
        setIsConnecting(true);
        setStatusMsg("Exchanging code for access tokens...");
        
        axios.get(`/auth/facebook/callback`, { params: { code, state } })
            .then(res => {
                const pagesWithIg = (res.data.pages || []).filter((p: any) => p.instagram_business_account);
                if (pagesWithIg.length > 0) {
                    setAvailablePages(pagesWithIg);
                    setStatusMsg(`Found ${pagesWithIg.length} Instagram Business accounts.`);
                } else {
                    setStatusMsg("No Instagram Business accounts found on your linked Facebook Pages.");
                    console.warn("Meta Callback Success but no IG accounts found in:", res.data.pages);
                }
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(err => {
                console.error("Meta Callback Error", err);
                setStatusMsg("Failed to fetch accounts: " + (err.response?.data?.error || err.message));
            })
            .finally(() => setIsConnecting(false));
    }
  };

  const startOAuth = () => {
    setStatusMsg("Redirecting to Facebook for secure login...");
    window.location.href = '/auth/facebook/login?flow=instagram';
  };

  const connectInstagram = async (page: any) => {
    const igAccount = page.instagram_business_account;
    try {
        await axios.post(`/api/register-account`, {
            externalId: igAccount.id,
            platform: 'instagram',
            name: `${page.name} (IG)`,
            accessToken: page.access_token 
        });
        
        const newAcc: Account = {
          id: `ig_${igAccount.id}`,
          platform: 'instagram',
          externalId: igAccount.id,
          name: `${page.name} (IG)`,
          accessToken: page.access_token,
          connectedAt: Date.now(),
          status: 'active',
          profilePictureUrl: page.picture?.data?.url
        };
        db.saveAccount(newAcc);
        setAccounts(prev => [...prev, newAcc]);
        setAvailablePages(prev => prev.filter(p => p.id !== page.id));
        setStatusMsg(`Connected ${page.name} Instagram!`);
    } catch (e) {
        setStatusMsg("Failed to register account with the automation engine.");
    }
  };

  const connectVirtual = () => {
    const id = `virtual_${Math.floor(Math.random() * 100000)}`;
    const newAcc: Account = {
      id: `ig_${id}`,
      platform: 'instagram',
      externalId: id,
      name: `Virtual IG (${id.slice(-4)})`,
      accessToken: 'mock_token',
      connectedAt: Date.now(),
      status: 'active'
    };
    db.saveAccount(newAcc);
    setAccounts(db.getAccountsByPlatform('instagram'));
  };

  const removeAccount = (id: string) => {
    db.deleteAccount(id);
    setAccounts(db.getAccountsByPlatform('instagram'));
  };

  if (isLoading) return <div className="p-8 text-slate-500">Loading Configuration...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Instagram className="text-pink-500" /> Instagram Business
        </h2>
        <p className="text-slate-400 mt-2">Connect your Instagram accounts via your Facebook Pages to start automating DMs and comments.</p>
      </header>

      {!isConfigured && (
        <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-xl mb-8 flex flex-col md:flex-row items-center gap-6 animate-in fade-in slide-in-from-top-4">
          <div className="bg-amber-500/20 p-4 rounded-full">
            <ShieldAlert className="text-amber-500" size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-amber-200 font-bold text-lg">Meta API Not Configured</h3>
            <p className="text-amber-200/70 text-sm mt-1">
              Real Instagram connections require Meta App ID and Secret in <b>Settings</b>.
            </p>
          </div>
          <button 
            onClick={connectVirtual}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all shrink-0"
          >
            <Sparkles size={18} /> Use Virtual Mode
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl flex flex-col">
          <h3 className="font-bold text-white mb-6 flex items-center gap-2">
            <Instagram size={20} className="text-pink-400" /> Connect via OAuth
          </h3>
          
          {isConnecting ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 gap-4">
                  <Loader className="animate-spin text-pink-500" size={32} />
                  <div className="text-center">
                    <span className="text-sm font-medium text-slate-400 block">Exchanging tokens...</span>
                    <span className="text-[10px] text-slate-500">Communicating with Meta Graph API</span>
                  </div>
              </div>
          ) : availablePages.length > 0 ? (
              <div className="space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold text-slate-500 uppercase">Select Instagram Account:</p>
                    <button onClick={() => setAvailablePages([])} className="text-[10px] text-slate-400 underline">Cancel</button>
                  </div>
                  {availablePages.map(page => (
                      <div key={page.id} className="bg-slate-900 border border-slate-700 p-3 rounded-xl flex items-center justify-between group hover:border-pink-500/50 transition-all">
                          <div className="flex items-center gap-3">
                              {page.picture?.data?.url ? (
                                  <img src={page.picture.data.url} className="w-8 h-8 rounded-full border border-slate-700" />
                              ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">{page.name.charAt(0)}</div>
                              )}
                              <span className="text-sm font-bold text-white">{page.name}</span>
                          </div>
                          <button 
                            onClick={() => connectInstagram(page)}
                            className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all shadow-lg shadow-pink-900/10"
                          >
                            Connect
                          </button>
                      </div>
                  ))}
              </div>
          ) : (
              <>
                  <button 
                    onClick={startOAuth}
                    disabled={!isConfigured}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
                      isConfigured 
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-pink-900/20 active:scale-95' 
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Instagram size={20} /> Login with Facebook
                  </button>
                  <p className="text-[10px] text-slate-500 mt-4 text-center leading-relaxed">
                      You'll be asked to select the Facebook Pages linked to your Instagram Business accounts.
                  </p>
              </>
          )}

          {statusMsg && (
              <div className="mt-6 p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-400 flex items-center gap-2 animate-in fade-in zoom-in-95">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse shrink-0"></div>
                  <span className="truncate">{statusMsg}</span>
              </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Connected Accounts</h3>
          {accounts.length === 0 && (
            <div className="p-12 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-600 text-sm">
              No accounts linked. Start by logging in with Facebook.
            </div>
          )}
          {accounts.map(acc => (
            <div key={acc.id} className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex items-center justify-between group hover:border-pink-500/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full flex items-center justify-center font-bold text-white border-2 border-slate-700 overflow-hidden shrink-0">
                  {acc.profilePictureUrl ? <img src={acc.profilePictureUrl} className="w-full h-full object-cover" /> : acc.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-white text-base flex items-center gap-2">
                    {acc.name}
                    {acc.accessToken === 'mock_token' ? <WifiOff size={14} className="text-slate-500"/> : <CheckCircle size={14} className="text-green-500"/>}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">IGID: {acc.externalId}</p>
                </div>
              </div>
              <button 
                onClick={() => removeAccount(acc.id)}
                className="text-slate-500 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 rounded-lg"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          
          <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mt-8">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <HelpCircle size={14} /> Connection Guide
              </h4>
              <ul className="text-[11px] text-slate-500 space-y-3 list-disc pl-4">
                  <li>Your Instagram must be a <b>Business Account</b> (Personal accounts won't show up).</li>
                  <li>Ensure "Allow Access to Messages" is ON in your IG mobile app settings.</li>
                  <li>Linked Facebook Pages must be managed by your Meta account.</li>
              </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
