
import React, { useEffect } from 'react';
import { LayoutDashboard, GitGraph, MessageSquare, Activity, Instagram, Phone, Facebook, Link2, LogOut, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UsageBar } from './UsageBar';
import axios from 'axios';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { user, logout, triggerUpgrade, refreshUsage } = useAuth();

  // Handle Mock Billing Success Param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing_success') === 'true') {
        const mockPlan = params.get('mock_plan');
        if (mockPlan) {
            // Call dev endpoint to set plan if it's a mock upgrade
            console.log("Mock upgrade triggered for plan:", mockPlan);
            axios.post('http://localhost:3000/api/dev/upgrade-mock', { plan: mockPlan })
                 .then(() => {
                     refreshUsage();
                     // Clean URL
                     window.history.replaceState({}, document.title, window.location.pathname);
                 })
                 .catch(err => console.error("Failed to apply mock upgrade", err));
        } else {
             // Real Stripe success usually handled via webhook, but we refresh just in case
             refreshUsage();
             window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'flows', label: 'Flows', icon: GitGraph },
    { id: 'simulator', label: 'Simulator', icon: MessageSquare },
    { id: 'logs', label: 'Live Logs', icon: Activity },
  ];

  const connectionItems = [
    { id: 'connections', label: 'Manage Connections', icon: Link2 },
    { id: 'connect-ig', label: 'Instagram', icon: Instagram },
    { id: 'connect-wa', label: 'WhatsApp', icon: Phone },
    { id: 'connect-fb', label: 'Messenger', icon: Facebook },
  ];

  const handlePortal = async () => {
     triggerUpgrade("Manage Subscription");
  };

  return (
    <div className="flex h-full w-full bg-slate-900 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            AutoChat Flow
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${user?.plan === 'free' ? 'bg-slate-700 text-slate-300' : 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-white'}`}>
                {user?.plan || 'Free'} Plan
            </span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}

          <div className="pt-6 pb-2 px-4 text-xs font-bold text-slate-500 uppercase">Channels</div>
          
          {connectionItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                activeTab === item.id 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        
        {/* Usage Bar */}
        <UsageBar />

        {/* User Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-xs font-bold text-white">{user?.email?.charAt(0).toUpperCase()}</span>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate w-24">{user?.email}</p>
                <button onClick={handlePortal} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <CreditCard size={10} /> Billing
                </button>
              </div>
            </div>
            <button onClick={logout} className="text-slate-500 hover:text-red-400 p-2">
                <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative bg-slate-900">
        {children}
      </div>
    </div>
  );
};
