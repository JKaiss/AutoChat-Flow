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
import { db } from '../services/db';
import axios from 'axios';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Sync accounts to backend on load
  useEffect(() => {
    const syncAccounts = async () => {
        const accounts = db.getAllAccounts();
        for (const acc of accounts) {
            try {
                await axios.post('http://localhost:3000/api/register-account', {
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

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
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