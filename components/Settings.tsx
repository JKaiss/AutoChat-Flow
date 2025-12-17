
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Key, Shield, Info, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import axios from 'axios';

export const Settings: React.FC = () => {
  const [form, setForm] = useState({
    metaAppId: '',
    metaAppSecret: ''
  });
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/config/status');
      setStatus(res.data);
      if (res.data.metaAppId) setForm(f => ({ ...f, metaAppId: res.data.metaAppId }));
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

  if (loading) return <div className="p-8 text-slate-500">Loading Configuration...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <SettingsIcon className="text-slate-400" /> Platform Settings
        </h2>
        <p className="text-slate-400 mt-2">Manage your API credentials and platform configuration.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Key size={20} className="text-blue-400" /> Meta App Credentials
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
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
                {saving ? 'Saving...' : <><Save size={18} /> Save Credentials</>}
              </button>
            </form>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">System Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
                <span className="text-slate-400 text-sm">Meta OAuth</span>
                {status?.metaConfigured ? 
                  <span className="text-green-400 font-bold flex items-center gap-1 text-xs"><CheckCircle size={14}/> Configured</span> : 
                  <span className="text-amber-400 font-bold flex items-center gap-1 text-xs"><AlertCircle size={14}/> Not Ready</span>
                }
              </div>
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
                <span className="text-slate-400 text-sm">Gemini AI</span>
                {status?.aiConfigured ? 
                  <span className="text-green-400 font-bold flex items-center gap-1 text-xs"><CheckCircle size={14}/> Active</span> : 
                  <span className="text-red-400 font-bold flex items-center gap-1 text-xs"><AlertCircle size={14}/> Missing API Key</span>
                }
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-900/20 border border-blue-800 rounded-2xl p-6">
            <h3 className="text-blue-200 font-bold mb-4 flex items-center gap-2">
              <Info size={18} /> Why this matters?
            </h3>
            <p className="text-blue-100/70 text-sm leading-relaxed mb-4">
              To test real Instagram or Messenger accounts, our server needs to communicate with the Meta Graph API.
            </p>
            <p className="text-blue-100/70 text-sm leading-relaxed mb-4">
              Providing these credentials here bypasses the need for an <code>.env</code> file, allowing real-world testing in containerized environments.
            </p>
            <a 
              href="https://developers.facebook.com/apps" 
              target="_blank" 
              className="text-blue-400 hover:text-blue-300 font-bold text-sm flex items-center gap-2"
            >
              Go to Meta Developers <ExternalLink size={14} />
            </a>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Shield size={18} className="text-slate-400" /> Security
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              These credentials are saved in a local <code>db.json</code> on your server. Ensure your server instance is secure and not accessible by unauthorized users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
