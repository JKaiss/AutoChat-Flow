

import React, { useEffect, useState } from 'react';
import { Account } from '../types';
import { Instagram, Facebook, Phone, Trash2, Link2, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';

interface AccountCardProps {
  account: Account;
  onDelete: (id: string) => void;
}

// FIX: Implemented the AccountCard component to render JSX, fixing the return type error.
const AccountCard: React.FC<AccountCardProps> = ({ account, onDelete }) => {
  const ICONS: Record<Account['platform'], React.ElementType> = {
    instagram: Instagram,
    facebook: Facebook,
    whatsapp: Phone,
  };
  const COLORS: Record<Account['platform'], string> = {
    instagram: 'text-pink-500',
    facebook: 'text-blue-500',
    whatsapp: 'text-green-500',
  };
  const Icon = ICONS[account.platform];
  const color = COLORS[account.platform];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between group">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-slate-900`}>
          <Icon size={24} className={color} />
        </div>
        <div>
          <h4 className="font-bold text-white">{account.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            {account.status === 'active' ? (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <CheckCircle size={12} /> Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle size={12} /> Error
              </span>
            )}
            <span className="text-xs text-slate-500 font-mono">ID: {account.externalId}</span>
          </div>
        </div>
      </div>
      <button onClick={() => onDelete(account.id)} className="text-slate-500 hover:text-red-400 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <Trash2 size={18} />
      </button>
    </div>
  );
};

export const ConnectedAccounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccounts = async () => {
      setIsLoading(true);
      try {
          const res = await axios.get('/api/accounts');
          setAccounts(res.data);
      } catch (e) {
          console.error("Failed to fetch accounts", e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to disconnect this account? This cannot be undone.')) {
      try {
          await axios.delete(`/api/accounts/${id}`);
          setAccounts(prev => prev.filter(acc => acc.id !== id));
      } catch (e) {
          alert('Failed to delete account.');
      }
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
          {isLoading ? (
              <div className="p-8 text-center text-slate-500">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <div className="p-8 bg-slate-800/50 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
              No accounts connected. Use the sidebar to add Instagram, WhatsApp, or Facebook accounts.
            </div>
          ) : (
            accounts.map(acc => (
              <AccountCard key={acc.id} account={acc} onDelete={handleDelete} />
            ))
          )}
        </div>
        {/* ... tips section ... */}
      </div>
    </div>
  );
};