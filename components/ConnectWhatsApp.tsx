
import React, { useState, useEffect } from 'react';
import { Account } from '../types';
import { Phone, Trash2, Send, Save, Sparkles } from 'lucide-react';
import axios from 'axios';

export const ConnectWhatsApp: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ phoneNumberId: '', businessAccountId: '', accessToken: '' });
  const [testNumber, setTestNumber] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const fetchAccounts = async () => {
      try {
          const res = await axios.get('/api/accounts?platform=whatsapp');
          setAccounts(res.data);
      } catch (e) {
          console.error("Failed to fetch WhatsApp accounts", e);
      }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fillTestData = () => { /* ... unchanged ... */ };

  const handleSave = async () => {
    if (!form.phoneNumberId || !form.accessToken) return;
    try {
        const payload = {
            platform: 'whatsapp',
            externalId: form.phoneNumberId,
            name: `WhatsApp ${form.phoneNumberId.slice(-4)}`,
            accessToken: form.accessToken,
        };
        await axios.post('/api/accounts', payload);
        fetchAccounts();
        setForm({ phoneNumberId: '', businessAccountId: '', accessToken: '' });
    } catch (e) {
        alert("Failed to save to backend. Is server running?");
    }
  };

  const handleDelete = async (id: string) => {
    try {
        await axios.delete(`/api/accounts/${id}`);
        setAccounts(prev => prev.filter(a => a.id !== id));
    } catch(e) {
        alert("Failed to delete account");
    }
  };

  const handleTestSend = async (account: Account) => { /* ... unchanged ... */ };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Phone className="text-green-500" /> Connect WhatsApp Cloud API
        </h2>
        <p className="text-slate-400 mt-2">Configure your official Meta WhatsApp Business API integration.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                {/* ... form content unchanged ... */}
            </div>
            <div className="space-y-6">
                 {accounts.map(acc => (
                     <div key={acc.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                         <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-white flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    {acc.name}
                                </h4>
                                <p className="text-xs text-slate-500 font-mono mt-1">ID: {acc.externalId}</p>
                            </div>
                            <button onClick={() => handleDelete(acc.id)} className="text-red-400 hover:text-red-300">
                                <Trash2 size={16} />
                            </button>
                         </div>
                         {/* ... test send content ... */}
                     </div>
                 ))}
            </div>
        </div>
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 h-fit">
            {/* ... setup instructions ... */}
        </div>
      </div>
    </div>
  );
};
