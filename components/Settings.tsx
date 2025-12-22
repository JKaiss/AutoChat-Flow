
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Key, Shield, Info, CheckCircle, AlertCircle, ExternalLink, Globe, FileText, Copy, Terminal, Sparkles, Bot, CreditCard } from 'lucide-react';
import axios from 'axios';

export const Settings: React.FC = () => {
  const [form, setForm] = useState({
    metaAppId: '',
    metaAppSecret: '',
    publicUrl: '',
    webhookVerifyToken: ''
  });
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [hasAiKey, setHasAiKey] = useState(false);

  useEffect(() => {
    fetchStatus();
    checkAiKeyStatus();
  }, []);

  const checkAiKeyStatus = async () => {
    try {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasAiKey(hasKey);
      }
    } catch (e) {
      console.error("Failed to check AI key status", e);
    }
  };

  const handleSelectAiKey = async () => {
    try {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        // Per instructions: assume success and proceed
        setHasAiKey(true);
        fetchStatus(); // Refresh status from backend to see if it's picked up
      }
    } catch (e) {
      console.error("Failed to open key selector", e);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/config/status');
      setStatus(res.data);
      setForm(f => ({ 
        ...f, 
        metaAppId: res.data.metaAppId || '',
        publicUrl: res.data.publicUrl || '',
        webhookVerifyToken: res.data.verifyToken || 'autochat_verify_token'
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      await axios.post('/api/config/settings', form);
      setMsg({ type: 'success', text: 'Settings saved successfully!' });
      fetchStatus();
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const privacyUrl = form.publicUrl ? `${form.publicUrl.replace(/\/$/, '')}/privacy` : `${window.location.origin}/privacy`;
  const webhookUrl = form.publicUrl ? `${form.publicUrl.replace(/\/$/, '')}/api/webhook` : `${window.location.origin}/api/webhook`;

  if (loading) return <div className="p-8 text-slate-500">Loading Configuration...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto pb-24">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <SettingsIcon className="text-slate-400" /> Platform Settings
        </h2>
        <p className="text-slate-400 mt-2">Manage your API credentials, AI engine, and platform configuration.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          
          {/* --- GEMINI AI SECTION --- */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <Sparkles size={80} className="text-purple-500" />
            </div>
            
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-purple-400" /> Gemini AI Engine
            </h3>
            
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Power your automations with Google's most capable AI models. Select a paid API key to enable Flow Generation and Intelligent Replies.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
               <button 
                  onClick={handleSelectAiKey}
                  className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 transition-all active:scale-95"
               >
                  <Key size={18} /> {hasAiKey ? 'Change Gemini API Key' : 'Select Gemini API Key'}
               </button>
               
               <div className="flex items-center gap-2 px-4 py-3 bg-slate-950/50 rounded-xl border border-slate-700/50 w-full sm:w-auto">
                  <div className={`w-2 h-2 rounded-full ${status?.aiConfigured || hasAiKey ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                     Status: {status?.aiConfigured || hasAiKey ? 'Configured' : 'Missing Key'}
                  </span>
               </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-700/50">
               <a 
                 href="https://ai.google.dev/gemini-api/docs/billing" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors font-medium"
               >
                 <CreditCard size={14} /> View Billing Requirements & Pricing <ExternalLink size={12} />
               </a>
               <p className="text-[10px] text-slate-500 mt-2">
                 Selection of a key from a paid Google Cloud project is mandatory for high-tier model access.
               </p>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Key size={20} className="text-blue-400" /> Meta App Credentials
            </h3>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Facebook App ID</label>
                  <input 
                    type="text"
                    value={form.metaAppId}
                    onChange={e => setForm({...form, metaAppId: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                    placeholder="e.g. 1029384756"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Facebook App Secret</label>
                  <input 
                    type="password"
                    value={form.metaAppSecret}
                    onChange={e => setForm({...form, metaAppSecret: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                    placeholder="••••••••••••••••"
                  />
                </div>
              </div>

              <div className="border-t border-slate-700 pt-6">
                <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Globe size={16} className="text-indigo-400" /> Network Configuration
                </h4>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                            Public App URL
                        </label>
                        <input 
                            type="url"
                            value={form.publicUrl}
                            onChange={e => setForm({...form, publicUrl: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                            placeholder="https://your-domain.com"
                        />
                        <p className="text-[10px] text-slate-500 mt-2">
                            Required for Meta Webhooks and OAuth callbacks in production.
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                            Webhook Verify Token
                        </label>
                        <input 
                            type="text"
                            value={form.webhookVerifyToken}
                            onChange={e => setForm({...form, webhookVerifyToken: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono"
                            placeholder="my_secure_verify_token"
                        />
                    </div>
                </div>
              </div>

              {msg.text && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${msg.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-800' : 'bg-red-900/20 text-red-400 border border-red-800'}`}>
                  {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {msg.text}
                </div>
              )}

              <button 
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all w-full md:w-auto"
              >
                {saving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
              </button>
            </form>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Terminal size={20} className="text-green-400" /> Webhook Setup
            </h3>
            <div className="space-y-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Callback URL</label>
                    <div className="flex gap-2">
                        <input 
                            readOnly
                            value={webhookUrl}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 font-mono outline-none"
                        />
                        <button onClick={() => copyToClipboard(webhookUrl)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-300">
                            <Copy size={16} />
                        </button>
                    </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Verify Token</label>
                    <div className="flex gap-2">
                        <input 
                            readOnly
                            value={form.webhookVerifyToken}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 font-mono outline-none"
                        />
                        <button onClick={() => copyToClipboard(form.webhookVerifyToken)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-300">
                            <Copy size={16} />
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-900/20 border border-indigo-800 rounded-2xl p-6">
            <h3 className="text-indigo-200 font-bold mb-4 flex items-center gap-2">
              <Shield size={18} /> Production Ready
            </h3>
            <p className="text-indigo-100/70 text-sm leading-relaxed">
              Meta requires HTTPS for all live webhooks. Use a tool like <strong>ngrok</strong> for local development or deploy to a secure host like Google Cloud Run.
            </p>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <FileText size={18} className="text-slate-400" /> Meta App URLs
            </h3>
            <div className="space-y-3">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Privacy Policy</div>
                <div className="flex gap-2">
                    <input readOnly value={privacyUrl} className="flex-1 bg-slate-900 p-2 rounded text-[10px] text-slate-400 font-mono outline-none" />
                    <button onClick={() => copyToClipboard(privacyUrl)} className="text-slate-400"><Copy size={12}/></button>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
