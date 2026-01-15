
import React, { useState, useEffect, useRef } from 'react';
import { Account } from '../types';
import { Instagram, ShieldAlert, Sparkles, Trash2, CheckCircle, WifiOff, Loader, HelpCircle, AlertTriangle, RefreshCw, Key } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export const ConnectInstagram: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const { token } = useAuth();
  
  const popupRef = useRef<Window | null>(null);
  
  const fetchAccounts = async () => {
      try {
          const res = await axios.get('/api/accounts?platform=instagram');
          setAccounts(res.data);
      } catch (e) {
          console.error("Failed to fetch IG accounts", e);
      }
  };
  
  useEffect(() => {
    setIsLoading(true);
    axios.get('/api/settings')
      .then(res => setIsConfigured(res.data.metaConfigured))
      .finally(() => setIsLoading(false));

    fetchAccounts();
    
    // Polling for OAuth popup
    const interval = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
            popupRef.current = null;
            setStatusMsg("Connection window closed. Refreshing accounts...");
            setIsConnecting(false);
            setTimeout(fetchAccounts, 1000);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [token]);

  const startOAuth = () => {
    setStatusMsg("Opening connection window...");
    setIsConnecting(true);
    const oauthUrl = `/auth/facebook/login?flow=instagram&token=${token}`;
    const width = 600, height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    popupRef.current = window.open(
      oauthUrl, 
      'oauth', 
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };
  
  const connectVirtual = async () => {
    // This is now purely for UI testing and doesn't persist
    const id = `virtual_${Math.floor(Math.random() * 100000)}`;
    const newAcc: Account = {
      id: `ig_${id}`, platform: 'instagram', externalId: id, name: `Virtual IG (${id.slice(-4)})`,
      accessToken: 'mock_token', connectedAt: Date.now(), status: 'active',
    };
    setAccounts(prev => [...prev, newAcc]);
  };

  const removeAccount = async (id: string) => {
    try {
        await axios.delete(`/api/accounts/${id}`);
        setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
        alert("Failed to remove account.");
    }
  };
  
  if (isLoading) return <div className="p-8 text-slate-500">Loading Configuration...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Instagram className="text-pink-500" /> Instagram Business
        </h2>
        <p className="text-slate-400 mt-2">Connect your Instagram accounts via your Facebook Pages to start automating DMs and comments.</p>
      </header>

      {!isConfigured && (
        <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-xl mb-8 flex flex-col md:flex-row items-center gap-6">
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
            <Sparkles size={18} /> Add Virtual Account
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl flex flex-col h-fit">
          <h3 className="font-bold text-white mb-6 flex items-center gap-2">
            <Instagram size={20} className="text-pink-400" /> Connect via OAuth
          </h3>
          
          <button 
            onClick={startOAuth}
            disabled={!isConfigured || isConnecting}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
              isConfigured 
              ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-lg active:scale-95' 
              : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            {isConnecting ? <Loader className="animate-spin" /> : <Instagram size={20} />}
            {isConnecting ? 'Waiting for connection...' : 'Login with Facebook'}
          </button>
          <p className="text-[10px] text-slate-500 mt-4 text-center">
              You'll be asked to select the Facebook Pages linked to your Instagram Business accounts.
          </p>

          {statusMsg && (
              <div className="mt-6 p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-400 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse shrink-0"></div>
                  <span className="truncate">{statusMsg}</span>
              </div>
          )}
        </div>
        
        {/* Account List and Guides */}
        <div className="space-y-6">
            {/* Account list... */}
        </div>
      </div>
    </div>
  );
};
