
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Check, Zap, Shield, Crown, AlertTriangle } from 'lucide-react';
import axios from 'axios';

interface UpgradeModalProps {
  // Controlled internally via event listener
}

export const UpgradeModal: React.FC<UpgradeModalProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const handler = (e: any) => {
      setReason(e.detail?.reason || 'Upgrade to unlock this feature');
      setIsOpen(true);
      setErrorMsg('');
    };
    window.addEventListener('trigger-upgrade', handler);
    return () => window.removeEventListener('trigger-upgrade', handler);
  }, []);

  const handleCheckout = async (priceId: string) => {
    setLoadingPriceId(priceId);
    setErrorMsg('');
    try {
      // We use the proxy path /api/billing... which forwards to localhost:3000
      const res = await axios.post('http://localhost:3000/api/billing/checkout', { priceId });
      
      if (res.data.url) {
        // Redirect to Stripe or Mock URL
        window.location.href = res.data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      console.error(e);
      const msg = e.response?.data?.error || e.message || "Unknown error";
      setErrorMsg(`Checkout failed: ${msg}`);
      setLoadingPriceId(null);
    }
  };

  if (!isOpen) return null;

  const currentPlan = user?.plan || 'free';

  const isCurrent = (plan: string) => currentPlan === plan;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative shadow-2xl">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
        >
          <X size={24} />
        </button>

        <div className="p-8 text-center border-b border-slate-800 bg-slate-800/50">
          <h2 className="text-2xl font-bold text-white mb-2">Upgrade Your Plan</h2>
          <p className="text-yellow-400 font-medium flex items-center justify-center gap-2">
            <Zap size={16} fill="currentColor" /> {reason}
          </p>
        </div>
        
        {errorMsg && (
            <div className="mx-8 mt-6 bg-red-900/30 border border-red-500/50 p-3 rounded text-red-200 text-sm flex items-center gap-2">
                <AlertTriangle size={16} /> {errorMsg}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-8">
          
          {/* FREE */}
          <div className={`bg-slate-800 rounded-xl p-6 border ${isCurrent('free') ? 'border-green-500 ring-1 ring-green-500/50' : 'border-slate-700 opacity-60'}`}>
            <h3 className="text-xl font-bold text-slate-300">Free</h3>
            <div className="text-3xl font-bold text-white my-4">$0 <span className="text-sm font-normal text-slate-500">/mo</span></div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-sm text-slate-300"><Check size={16} /> 100 Transactions</li>
              <li className="flex items-center gap-2 text-sm text-slate-300"><Check size={16} /> 1 Account</li>
              <li className="flex items-center gap-2 text-sm text-slate-500"><X size={16} /> No AI Features</li>
            </ul>
            <button 
                disabled={true} 
                className={`w-full py-2 rounded-lg text-sm font-bold ${isCurrent('free') ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-slate-700 text-slate-500'}`}
            >
                {isCurrent('free') ? 'Current Plan' : 'Basic Plan'}
            </button>
          </div>

          {/* PRO */}
          <div className={`bg-slate-800 rounded-xl p-6 border-2 relative transform transition-transform ${isCurrent('pro') ? 'border-green-500 shadow-xl shadow-green-900/20' : 'border-blue-500 scale-105 shadow-xl shadow-blue-900/20'}`}>
            {!isCurrent('pro') && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Recommended
                </div>
            )}
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Shield size={20} className={isCurrent('pro') ? "text-green-400" : "text-blue-400"} /> Pro</h3>
            <div className="text-3xl font-bold text-white my-4">$29 <span className="text-sm font-normal text-slate-500">/mo</span></div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-sm text-white"><Check size={16} className="text-blue-400" /> 5,000 Transactions</li>
              <li className="flex items-center gap-2 text-sm text-white"><Check size={16} className="text-blue-400" /> 5 Accounts</li>
              <li className="flex items-center gap-2 text-sm text-white"><Check size={16} className="text-blue-400" /> AI Automation</li>
              <li className="flex items-center gap-2 text-sm text-white"><Check size={16} className="text-blue-400" /> Priority Webhooks</li>
            </ul>
            <button 
              onClick={() => handleCheckout('price_pro_dummy')}
              disabled={isCurrent('pro') || loadingPriceId === 'price_pro_dummy'}
              className={`w-full py-3 rounded-lg font-bold transition-all ${
                  isCurrent('pro') 
                  ? 'bg-green-600 text-white cursor-default' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {loadingPriceId === 'price_pro_dummy' ? 'Processing...' : isCurrent('pro') ? 'Current Plan' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* BUSINESS */}
          <div className={`bg-slate-800 rounded-xl p-6 border ${isCurrent('business') ? 'border-green-500 ring-1 ring-green-500/50' : 'border-slate-700'}`}>
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Crown size={20} className="text-purple-400" /> Business</h3>
            <div className="text-3xl font-bold text-white my-4">$99 <span className="text-sm font-normal text-slate-500">/mo</span></div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-2 text-sm text-slate-300"><Check size={16} className="text-purple-400" /> 25,000 Transactions</li>
              <li className="flex items-center gap-2 text-sm text-slate-300"><Check size={16} className="text-purple-400" /> Unlimited Accounts</li>
              <li className="flex items-center gap-2 text-sm text-slate-300"><Check size={16} className="text-purple-400" /> Advanced AI Models</li>
            </ul>
            <button 
              onClick={() => handleCheckout('price_biz_dummy')}
              disabled={isCurrent('business') || loadingPriceId === 'price_biz_dummy'}
              className={`w-full py-2 rounded-lg font-bold transition-all ${
                  isCurrent('business')
                  ? 'bg-green-600/20 text-green-400 border border-green-600'
                  : 'bg-slate-700 hover:bg-purple-600 hover:text-white text-slate-300'
              }`}
            >
              {loadingPriceId === 'price_biz_dummy' ? 'Processing...' : isCurrent('business') ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        </div>

        <div className="p-6 text-center text-xs text-slate-500 border-t border-slate-800">
          Secure payment via Stripe. In Test/Mock mode, this won't charge you.
        </div>
      </div>
    </div>
  );
};
