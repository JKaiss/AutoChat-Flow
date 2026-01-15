
import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Key, Shield, Info, CheckCircle, AlertCircle, ExternalLink, Globe, FileText, Copy, Terminal, Sparkles, CreditCard, RefreshCw, Activity } from 'lucide-react';
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
    fetchSettings();
    checkAiKeyStatus();
  }, []);

  const checkAiKeyStatus = async () => { /* ... unchanged ... */ };
  const handleSelectAiKey = async () => { /* ... unchanged ... */ };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/settings');
      setStatus(res.data);
      setForm({ 
        metaAppId: res.data.metaAppId || '',
        metaAppSecret: '', // Don't expose secret back to form
        publicUrl: res.data.publicUrl || '',
        webhookVerifyToken: res.data.webhookVerifyToken || 'autochat_verify_token'
      });
    } catch (e) {
      console.error(e);
      setMsg({ type: 'error', text: 'Could not load settings from server.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });
    try {
      // Create a payload that only includes non-empty fields to avoid overwriting with blanks
      const payload: Partial<typeof form> = {};
      if (form.metaAppId) payload.metaAppId = form.metaAppId;
      if (form.metaAppSecret) payload.metaAppSecret = form.metaAppSecret; // Only send if user enters a new one
      if (form.publicUrl) payload.publicUrl = form.publicUrl;
      if (form.webhookVerifyToken) payload.webhookVerifyToken = form.webhookVerifyToken;

      await axios.put('/api/settings', payload);
      setMsg({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(fetchSettings, 500);
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };
  
  const copyToClipboard = (text: string) => { /* ... unchanged ... */ };

  const privacyUrl = form.publicUrl ? `${form.publicUrl.replace(/\/$/, '')}/privacy` : `${window.location.origin}/privacy`;
  const webhookUrl = form.publicUrl ? `${form.publicUrl.replace(/\/$/, '')}/api/webhook` : `${window.location.origin}/api/webhook`;

  if (loading) return <div className="p-8 text-slate-500">Loading Configuration...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto pb-24">
      {/* ... JSX structure unchanged, but logic now uses /api/settings ... */}
      <header>...</header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
              {/* AI Section */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
                  <h3 className="text-lg font-bold">Meta App Credentials</h3>
                  <form onSubmit={handleSave} className="space-y-6">
                      <div>
                          <label>Facebook App ID</label>
                          <input 
                              type="text"
                              value={form.metaAppId}
                              onChange={e => setForm({...form, metaAppId: e.target.value})}
                              /* ... other attributes */
                          />
                      </div>
                      {/* ... other form fields ... */}
                      <button type="submit" disabled={saving}>
                          {saving ? 'Saving...' : 'Save Settings'}
                      </button>
                  </form>
              </div>
          </div>
          <div className="space-y-6">
              {/* ... Side panel content ... */}
          </div>
      </div>
    </div>
  );
};
