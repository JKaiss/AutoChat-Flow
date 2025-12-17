
import React, { useState, useEffect } from 'react';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { FlowBuilder } from './FlowBuilder';
import { Simulator } from './Simulator';
import { Logs } from './Logs';
import { ConnectInstagram } from './ConnectInstagram';
import { ConnectWhatsApp } from './ConnectWhatsApp';
import { ConnectFacebook } from './ConnectFacebook';
import { ConnectedAccounts } from './ConnectedAccounts';
import { AuthScreen } from './Auth';
import { LandingPage } from './LandingPage';
import { UpgradeModal } from './UpgradeModal';
import { db } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { engine } from '../services/engine';
import axios from 'axios';
import { Loader } from 'lucide-react';

export default function App() {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLanding, setShowLanding] = useState(true);

  // Sync accounts to backend on load
  useEffect(() => {
    const syncAccounts = async () => {
        const accounts = db.getAllAccounts();
        for (const acc of accounts) {
            try {
                // FIXED: Use relative path for production
                await axios.post('/api/register-account', {
                    externalId: acc.externalId,
                    accessToken: acc.accessToken,
                    platform: acc.platform,
                    name: acc.name
                });
            } catch (e) {
                console.warn(`Failed to sync account ${acc.name} to backend`, e);
            }
        }
    };
    syncAccounts();
  }, []);

  // Start polling when user is active.
  // CRITICAL: DO NOT return a cleanup function that stops polling. 
  // The engine is a global singleton and should stay alive as long as the user is logged in.
  useEffect(() => {
    console.log("[App] Auth State Check. User ID:", user?.id);
    
    if (user?.id) {
        // Start polling if not already running
        engine.startPolling();
    } else {
        // Only stop if user explicitly logs out (user becomes null)
        engine.stopPolling();
    }
  }, [user?.id]); 

  if (isLoading) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-blue-500"><Loader className="animate-spin" size={32} /></div>;
  }

  // LOGIC: 
  // 1. If user is logged in -> Show Dashboard (Layout)
  // 2. If user is NOT logged in AND showLanding is true -> Show Landing Page
  // 3. If user is NOT logged in AND showLanding is false -> Show AuthScreen

  if (!user) {
    if (showLanding) {
        return <LandingPage onGetStarted={() => setShowLanding(false)} />;
    }
    return <AuthScreen onBack={() => setShowLanding(true)} />;
  }

  // Authenticated State (Dashboard)
  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <UpgradeModal />
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'flows' && <FlowBuilder />}
      {activeTab === 'simulator' && <Simulator />}
      {activeTab === 'logs' && <Logs />}
      {activeTab === 'connections' && <ConnectedAccounts />}
      {activeTab === 'connect-ig' && <ConnectInstagram />}
      {activeTab === 'connect-wa' && <ConnectWhatsApp />}
      {activeTab === 'connect-fb' && <ConnectFacebook />}
    </Layout>
  );
}
