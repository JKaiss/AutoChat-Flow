
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Instagram, AlertCircle, ShieldAlert, Sparkles, Trash2, CheckCircle, WifiOff } from 'lucide-react';
import axios from 'axios';

export const ConnectInstagram: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAccounts(db.getAccountsByPlatform('instagram'));
    axios.get('/api/config/status')
      .then(res => setIsConfigured(res.data.metaConfigured))
      .finally(() => setIsLoading(false));
  }, []);

  const startOAuth = () => {
    window.location.href = '/auth/facebook/login';
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
          <Instagram className="text-pink-500" /> Instagram Automation
        </h2>
        <p className="text-slate-400 mt-2">Connect your Instagram Business accounts to start automating.</p>
      </header>

      {!isConfigured && (
        <div className="bg-amber-900/20 border border-amber-700/50 p-6 rounded-xl mb-8 flex flex-col md:flex-row items-center gap-6">
          <div className="bg-amber-500/20 p-4 rounded-full">
            <ShieldAlert className="text-amber-500" size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-amber-200 font-bold text-lg">No Meta Credentials Detected</h3>
            <p className="text-amber-200/70 text-sm mt-1">
              The server is running without FACEBOOK_APP_ID. You cannot connect real accounts, but you can use <b>Virtual Mode</b> to test everything.
            </p>
          </div>
          <button 
            onClick={connectVirtual}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all shrink-0"
          >
            <Sparkles size={18} /> Connect Virtual Account
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
          <h3 className="font-bold text-white mb-4">Add Account</h3>
          <button 
            onClick={startOAuth}
            disabled={!isConfigured}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all ${
              isConfigured 
              ? 'bg-blue-600 hover:bg-blue-500 text-white' 
              : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <Instagram size={20} /> Login with Facebook
          </button>
          {!isConfigured && (
            <p className="text-[10px] text-slate-500 mt-3 text-center uppercase tracking-widest font-bold">
              Meta OAuth is Disabled
            </p>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase">Connected Accounts</h3>
          {accounts.length === 0 && (
            <div className="p-8 border-2 border-dashed border-slate-800 rounded-xl text-center text-slate-600">
              No accounts connected.
            </div>
          )}
          {accounts.map(acc => (
            <div key={acc.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center font-bold text-white">
                  {acc.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    {acc.name}
                    {acc.accessToken === 'mock_token' ? <WifiOff size={12} className="text-slate-500"/> : <CheckCircle size={12} className="text-green-500"/>}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {acc.externalId}</p>
                </div>
              </div>
              <button 
                onClick={() => removeAccount(acc.id)}
                className="text-slate-500 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
