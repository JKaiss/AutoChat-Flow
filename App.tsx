
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Loader } from 'lucide-react';
import { db } from './services/db';
import { engine } from './services/engine';
import axios from 'axios';

// Lazy load heavy components to improve TBT and FCP
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const FlowBuilder = lazy(() => import('./components/FlowBuilder').then(m => ({ default: m.FlowBuilder })));
const Simulator = lazy(() => import('./components/Simulator').then(m => ({ default: m.Simulator })));
const Logs = lazy(() => import('./components/Logs').then(m => ({ default: m.Logs })));
const ConnectInstagram = lazy(() => import('./components/ConnectInstagram').then(m => ({ default: m.ConnectInstagram })));
const ConnectWhatsApp = lazy(() => import('./components/ConnectWhatsApp').then(m => ({ default: m.ConnectWhatsApp })));
const ConnectFacebook = lazy(() => import('./components/ConnectFacebook').then(m => ({ default: m.ConnectFacebook })));
const ConnectedAccounts = lazy(() => import('./components/ConnectedAccounts').then(m => ({ default: m.ConnectedAccounts })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const PrivacyPolicy = lazy(() => import('./components/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const AuthScreen = lazy(() => import('./components/Auth').then(m => ({ default: m.AuthScreen })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const UpgradeModal = lazy(() => import('./components/UpgradeModal').then(m => ({ default: m.UpgradeModal })));

const TabLoader = () => (
  <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 gap-4">
    <Loader className="animate-spin text-blue-500" size={32} />
    <span className="text-sm font-medium animate-pulse">Loading Module...</span>
  </div>
);

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLanding, setShowLanding] = useState(true);

  const path = window.location.pathname;

  useEffect(() => {
    if (path === '/connect-fb') setActiveTab('connect-fb');
    else if (path === '/connect-ig') setActiveTab('connect-ig');
    else if (path === '/settings') setActiveTab('settings');
    else if (path === '/connections') setActiveTab('connections');
    else if (path === '/flows') setActiveTab('flows');
    else if (path === '/simulator') setActiveTab('simulator');
    else if (path === '/logs') setActiveTab('logs');
  }, [path]);

  if (path === '/privacy') {
    return <Suspense fallback={<div className="h-screen bg-slate-950" />}><PrivacyPolicy /></Suspense>;
  }

  useEffect(() => {
    const syncAccounts = async () => {
        const accounts = db.getAllAccounts();
        for (const acc of accounts) {
            try {
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
    if (user && user.id !== 'offline_user') {
        syncAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
        engine.startPolling();
    } else {
        engine.stopPolling();
    }
  }, [user?.id]);

  if (isLoading) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-blue-500"><Loader className="animate-spin" size={32} /></div>;
  }

  if (!user) {
    return (
      <Suspense fallback={<div className="h-screen w-screen bg-slate-950" />}>
        {showLanding ? (
          <LandingPage onGetStarted={() => setShowLanding(false)} />
        ) : (
          <AuthScreen onBack={() => setShowLanding(true)} />
        )}
      </Suspense>
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <Suspense fallback={<TabLoader />}>
        <UpgradeModal />
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'flows' && <FlowBuilder />}
        {activeTab === 'simulator' && <Simulator />}
        {activeTab === 'logs' && <Logs />}
        {activeTab === 'connections' && <ConnectedAccounts />}
        {activeTab === 'connect-ig' && <ConnectInstagram />}
        {activeTab === 'connect-wa' && <ConnectWhatsApp />}
        {activeTab === 'connect-fb' && <ConnectFacebook />}
        {activeTab === 'settings' && <Settings />}
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}