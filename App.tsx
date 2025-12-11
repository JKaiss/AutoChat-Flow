import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { FlowBuilder } from './components/FlowBuilder';
import { Simulator } from './components/Simulator';
import { Logs } from './components/Logs';
import { ConnectInstagram } from './components/ConnectInstagram';
import { ConnectWhatsApp } from './components/ConnectWhatsApp';
import { ConnectFacebook } from './components/ConnectFacebook';
import { ConnectedAccounts } from './components/ConnectedAccounts';
import { AuthScreen } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { UpgradeModal } from './components/UpgradeModal';
import { Loader } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLanding, setShowLanding] = useState(true);

  if (isLoading) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-blue-500"><Loader className="animate-spin" size={32} /></div>;
  }

  if (!user) {
    if (showLanding) {
      return <LandingPage onGetStarted={() => setShowLanding(false)} />;
    }
    return <AuthScreen onBack={() => setShowLanding(true)} />;
  }

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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}