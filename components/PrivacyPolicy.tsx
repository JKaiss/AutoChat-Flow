
import React from 'react';
import { Shield, ArrowLeft, Lock, Eye, Database, Mail } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 md:p-12 font-sans selection:bg-blue-500/30">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 border-b border-slate-800 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Shield className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
          </div>
          <p className="text-slate-400">Last Updated: {new Date().toLocaleDateString()}</p>
        </header>

        <div className="space-y-10 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Eye size={20} className="text-blue-400" /> 1. Overview
            </h2>
            <p className="text-slate-400">
              AutoChat Flow ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our multi-channel chatbot automation platform, specifically regarding our integration with Meta (Facebook/Instagram) and WhatsApp APIs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database size={20} className="text-indigo-400" /> 2. Information We Collect
            </h2>
            <p className="mb-4">When you connect your social media accounts via our platform, we access the following data via official APIs:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-400">
              <li><strong>Account Information:</strong> Name, ID, and profile picture of your connected Pages or Instagram Business accounts.</li>
              <li><strong>Messages & Comments:</strong> To provide automation services, our system reads incoming messages and comments to trigger your configured flows.</li>
              <li><strong>Contact Information:</strong> We store your account email for login and billing purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Lock size={20} className="text-green-400" /> 3. Data Usage & Security
            </h2>
            <p className="text-slate-400 mb-4">
              Your data is used strictly to provide the chatbot automation services you configure. We do not sell your personal data or your customers' data to third parties.
            </p>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <p className="text-sm italic text-slate-300">
                <strong>Meta Data Compliance:</strong> We strictly adhere to Meta's Developer Policies. Data retrieved via the Graph API is only cached for the minimum time necessary to execute your automation logic.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield size={20} className="text-purple-400" /> 4. User Rights
            </h2>
            <p className="text-slate-400">
              You can disconnect your accounts at any time via the "Manage Connections" settings. Disconnecting an account immediately revokes our access tokens and stops all data processing for that specific channel.
            </p>
          </section>

          <section className="border-t border-slate-800 pt-10">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail size={20} className="text-slate-400" /> 5. Contact Us
            </h2>
            <p className="text-slate-400">
              If you have questions about this Privacy Policy, please contact us at support@autochat-flow-mvp.com.
            </p>
          </section>
        </div>

        <footer className="mt-20 pt-8 border-t border-slate-900 text-center">
          <button 
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} /> Back to Application
          </button>
        </footer>
      </div>
    </div>
  );
};
