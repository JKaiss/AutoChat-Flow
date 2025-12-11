import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Instagram, Facebook, Phone, Trash2, Link2, CheckCircle, AlertTriangle } from 'lucide-react';

interface AccountCardProps {
  account: Account;
  onDelete: (id: string) => void;
}

const AccountCard: React.FC<AccountCardProps> = ({ account, onDelete }) => {
  const getIcon = () => {
    switch (account.platform) {
      case 'instagram': return <Instagram size={20} className="text-pink-500" />;
      case 'facebook': return <Facebook size={20} className="text-blue-500" />;
      case 'whatsapp': return <Phone size={20} className="text-green-500" />;
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center border border-slate-600 overflow-hidden">
           {account.profilePictureUrl ? (
               <img src={account.profilePictureUrl} className="w-full h-full object-cover" />
           ) : (
               <span className="font-bold text-lg">{account.name.charAt(0)}</span>
           )}
        </div>
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            {account.name}
            {account.status === 'active' ? (
              <CheckCircle size={14} className="text-green-500" />
            ) : (
              <AlertTriangle size={14} className="text-red-500" />
            )}
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            {getIcon()}
            <span className="capitalize">{account.platform}</span>
            <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
            <span className="font-mono">{account.externalId}</span>
          </div>
        </div>
      </div>
      <button 
        onClick={() => onDelete(account.id)}
        className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};

export const ConnectedAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    setAccounts(db.getAllAccounts());
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to disconnect this account?')) {
      db.deleteAccount(id);
      setAccounts(db.getAllAccounts());
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Link2 className="text-blue-400" /> Manage Connections
        </h2>
        <p className="text-slate-400 mt-2">View and manage all your connected social accounts.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase">Active Accounts</h3>
          {accounts.length === 0 && (
            <div className="p-8 bg-slate-800/50 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
              No accounts connected. Use the sidebar to add Instagram, WhatsApp, or Facebook accounts.
            </div>
          )}
          {accounts.map(acc => (
            <AccountCard key={acc.id} account={acc} onDelete={handleDelete} />
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 h-fit">
          <h3 className="font-bold text-white mb-4">Connection Tips</h3>
          <ul className="text-sm text-slate-400 space-y-3 list-disc pl-4">
            <li>You can connect multiple accounts for each platform.</li>
            <li>Each account works independently in the Flow Builder.</li>
            <li>Ensure you have admin rights to the Facebook Pages you want to connect.</li>
            <li>WhatsApp numbers must be verified in the Meta Developer Portal.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};