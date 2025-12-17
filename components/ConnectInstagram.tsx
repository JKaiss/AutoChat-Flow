
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
        setStatusMsg("Fetching linked Instagram accounts...");
        
        axios.get(`/auth/facebook/callback`, { params: { code, state } })
            .then(res => {
                // We filter pages that have an instagram_business_account
                const pagesWithIg = (res.data.pages || []).filter((p: any) => p.instagram_business_account);
                if (pagesWithIg.length > 0) {
                    setAvailablePages(pagesWithIg);
                    setStatusMsg(`Found ${pagesWithIg.length} Instagram accounts.`);
                } else {
                    setStatusMsg("No linked Instagram Business accounts found on these pages.");
                }
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(err => {
                setStatusMsg("Failed to fetch accounts: " + (err.response?.data?.error || err.message));
            })
            .finally(() => setIsConnecting(false));
    }
  };

  const startOAuth = () => {
    setStatusMsg("Redirecting to Facebook...");
    window.location.href = '/auth/facebook/login?flow=instagram';
  };

  const connectInstagram = async (page: any) => {
    const igAccount = page.instagram_business_account;
    try {
        await axios.post(`/api/register-account`, {
            externalId: igAccount.id,
            platform: 'instagram',
            name: `${page.name} (IG)`,
            accessToken: page.access_token // Page token is used for IG Graph API
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
        setStatusMsg("Failed to connect Instagram account.");
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
        <p className="text-slate-400 mt-2">Connect your Instagram Business accounts (via Facebook Pages) to start automating.</p>
      </header>

      {!isConfigured && (
        <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-xl mb-8 flex flex-col md:flex-row items-center gap-6 animate-in fade-in slide-in-from-top-4">
          <div className="bg-amber-500/20 p-4 rounded-full">
            <ShieldAlert className="text-amber-500" size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-amber-200 font-bold text-lg">Meta API Not Configured</h3>
            <p className="text-amber-200/70 text-sm mt-1">
              You need to provide your Facebook App ID and Secret in <b>Settings</b> to connect real accounts.
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
                  <span className="text-sm font-medium text-slate-400">Loading your accounts...</span>
              </div>
          ) : availablePages.length > 0 ? (
              <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Available IG Accounts:</p>
                  {availablePages.map(page => (
                      <div key={page.id} className="bg-slate-900 border border-slate-700 p-3 rounded-xl flex items-center justify-between">
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
                            className="bg-pink-600 hover:bg-pink-500 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all"
                          >
                            Connect
                          </button>
                      </div>
                  ))}
                  <button onClick={() => setAvailablePages([])} className="w-full text-xs text-slate-500 mt-4 underline">Clear list</button>
              </div>
          ) : (
              <>
                  <button 
                    onClick={startOAuth}
                    disabled={!isConfigured}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
                      isConfigured 
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg shadow-pink-900/20' 
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Instagram size={20} /> Login with Facebook
                  </button>
                  <p className="text-[10px] text-slate-500 mt-4 text-center leading-relaxed">
                      By clicking, you will be redirected to Meta to authorize account access.
                  </p>
              </>
          )}

          {statusMsg && (
              <div className="mt-6 p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></div>
                  {statusMsg}
              </div>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Connected Accounts</h3>
          {accounts.length === 0 && (
            <div className="p-12 border-2 border-dashed border-slate-800 rounded-2xl text-center text-slate-600 text-sm">
              No Instagram accounts connected.
            </div>
          )}
          {accounts.map(acc => (
            <div key={acc.id} className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex items-center justify-between group hover:border-pink-500/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full flex items-center justify-center font-bold text-white border-2 border-slate-700 overflow-hidden">
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
                  <HelpCircle size={14} /> Quick Guide
              </h4>
              <ul className="text-[11px] text-slate-500 space-y-3 list-disc pl-4">
                  <li>Your Instagram account must be a <b>Business</b> or <b>Creator</b> account.</li>
                  <li>It must be <b>linked to a Facebook Page</b> that you manage.</li>
                  <li>Ensure "Allow Access to Messages" is enabled in Instagram App Settings.</li>
              </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
