
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Phone, Trash2, Send, Save, Globe, HelpCircle, ExternalLink, Key, Sparkles } from 'lucide-react';
import axios from 'axios';

export const ConnectWhatsApp: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: ''
  });
  const [testNumber, setTestNumber] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    setAccounts(db.getAccountsByPlatform('whatsapp'));
  }, []);

  const fillTestData = () => {
      setForm({
          phoneNumberId: '100555' + Math.floor(Math.random() * 9000),
          businessAccountId: '200888' + Math.floor(Math.random() * 9000),
          accessToken: 'mock_wa_token_' + Date.now()
      });
  };

  const handleSave = async () => {
    if (!form.phoneNumberId || !form.accessToken) return;

    try {
        const payload = {
            externalId: form.phoneNumberId,
            platform: 'whatsapp',
            name: `WhatsApp ${form.phoneNumberId.slice(-4)}`,
            accessToken: form.accessToken,
            businessAccountId: form.businessAccountId,
        };
        await axios.post('/api/register-account', payload);
        
        const newAccount: Account = {
            id: `wa_${form.phoneNumberId}`,
            platform: 'whatsapp',
            externalId: form.phoneNumberId,
            name: `WhatsApp ${form.phoneNumberId.slice(-4)}`,
            accessToken: form.accessToken,
            businessAccountId: form.businessAccountId,
            connectedAt: Date.now(),
            status: 'active'
        };
        db.saveAccount(newAccount);
        setAccounts(db.getAccountsByPlatform('whatsapp'));
        setForm({ phoneNumberId: '', businessAccountId: '', accessToken: '' });
    } catch (e) {
        alert("Failed to save to backend. Is server running?");
    }
  };

  const handleDelete = (id: string) => {
    db.deleteAccount(id);
    setAccounts(db.getAccountsByPlatform('whatsapp'));
  };

  const handleTestSend = async (account: Account) => {
    if (!testNumber) return;
    setTestStatus('sending');
    try {
        await axios.post('/api/whatsapp/send', {
            to: testNumber,
            text: "Hello from AutoChat Flow! 🚀 This is a test message.",
            accountId: account.externalId
        });
        setTestStatus('success');
    } catch (e: any) {
        console.error(e);
        setTestStatus('error: ' + (e.response?.data?.error?.message || e.message));
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Phone className="text-green-500" /> Connect WhatsApp Cloud API
        </h2>
        <p className="text-slate-400 mt-2">Configure your official Meta WhatsApp Business API integration.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Form & List */}
        <div className="space-y-6">
            
            {/* Connection Form */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-white">Add New Connection</h3>
                    <button 
                        onClick={fillTestData}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-blue-300 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                    >
                        <Sparkles size={12} /> Fill Test Data
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Phone Number ID</label>
                        <input 
                            value={form.phoneNumberId}
                            onChange={e => setForm({...form, phoneNumberId: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-green-500 outline-none"
                            placeholder="e.g. 100555823..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Business Account ID</label>
                        <input 
                            value={form.businessAccountId}
                            onChange={e => setForm({...form, businessAccountId: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-green-500 outline-none"
                            placeholder="e.g. 234905823..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Permanent Access Token</label>
                        <input 
                            value={form.accessToken}
                            onChange={e => setForm({...form, accessToken: e.target.value})}
                            type="password"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-green-500 outline-none"
                            placeholder="EAAG..."
                        />
                    </div>
                    <button 
                        onClick={handleSave}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4 transition-all"
                    >
                        <Save size={18} /> Save Connection
                    </button>
                </div>
            </div>

            {/* Existing Accounts & Testing */}
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

                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                            <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Test Connection</h5>
                            <div className="flex gap-2">
                                <input 
                                    value={testNumber}
                                    onChange={e => setTestNumber(e.target.value)}
                                    placeholder="Recipient Phone (e.g. 15551234567)"
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white"
                                />
                                <button 
                                    onClick={() => handleTestSend(acc)}
                                    className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-white text-sm font-bold flex items-center gap-2"
                                >
                                    <Send size={14} /> Send
                                </button>
                            </div>
                            {testStatus && (
                                <p className={`text-xs mt-2 ${testStatus.startsWith('error') ? 'text-red-400' : 'text-green-400'}`}>
                                    Status: {testStatus}
                                </p>
                            )}
                         </div>
                     </div>
                 ))}
            </div>
        </div>

        {/* Right Column: Setup Instructions */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 h-fit">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <HelpCircle size={20} className="text-green-500" /> Setup Instructions
            </h3>
            
            <div className="space-y-6 text-sm text-slate-400">
                <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800/50 flex items-start gap-3">
                     <Sparkles className="text-blue-400 shrink-0 mt-0.5" size={16} />
                     <div className="text-xs text-blue-100/80">
                         <strong>Test Mode Active:</strong> You can click "Fill Test Data" above to instantly generate valid mock credentials for testing the app locally.
                     </div>
                 </div>

                <div>
                    <h4 className="font-bold text-slate-200 mb-2">Step 1: Create Meta App</h4>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" className="text-blue-400 hover:underline">Meta Developers</a>.</li>
                        <li>Create a new app. Select <strong>"Other"</strong> &gt; <strong>"Business"</strong>.</li>
                        <li>Add the <strong>WhatsApp</strong> product to your app.</li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-slate-200 mb-2">Step 2: Get Credentials</h4>
                    <p className="mb-2">In the app sidebar, go to <strong>WhatsApp &gt; API Setup</strong>.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
