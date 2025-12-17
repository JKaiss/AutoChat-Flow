
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Account } from '../types';
import { Instagram, Check, Trash2, RefreshCw, Activity, Zap, ExternalLink, Key, ChevronDown, ChevronUp, ArrowRight, Sparkles, MessageSquare, Bot, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import axios from 'axios';

// Custom Meta Logo SVG for authentic branding
const MetaLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M16.924 5.924c-1.334-.002-2.395.952-3.666 2.504-1.296 1.583-2.348 2.87-4.14 2.87-1.398 0-2.02-.792-2.02-1.704 0-.825.59-1.84 1.488-1.84.444 0 .742.235.955.43.344.316.896.255 1.137-.152.196-.33.125-.845-.308-1.127-.64-.418-1.472-.65-2.378-.65C5.106 6.254 3 8.352 3 11.23c0 2.22 1.59 3.518 3.553 3.518 1.95 0 3.328-1.465 4.675-3.085 1.252-1.503 2.185-2.625 3.664-2.625 1.05 0 1.63.53 1.63 1.528 0 .97-.735 1.96-1.63 1.96-.54 0-.86-.297-1.077-.497-.343-.316-.895-.256-1.137.152-.196.33-.125.845.308 1.127.63.408 1.442.637 2.332.637 2.915 0 4.982-2.155 4.982-5.02 0-2.352-1.782-3.99-4.376-4.002z" />
  </svg>
);

export const ConnectInstagram: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const authProcessed = useRef(false);
  
  // Developer Mode States
  const [isDevMode, setIsDevMode] = useState(false);
  const [manualForm, setManualForm] = useState({ id: '', token: '', name: 'Dev Account' });
  const [testRecipient, setTestRecipient] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testResultType, setTestResultType] = useState<'success' | 'error' | 'warning' | null>(null);
  
  // ID Finder State
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    setAccounts(db.getAccountsByPlatform('instagram'));
    checkForOAuthCallback();
  }, []);

  const checkForOAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    // Ensure we only process the code once (React StrictMode fires useEffect twice)
    if (code && !authProcessed.current) {
        authProcessed.current = true;
        setIsConnecting(true);
        setStatusMsg("Connecting to Meta...");
        setIsError(false);
        setDebugInfo(null);
        
        // Use relative URL to leverage Vite proxy
        axios.get(`/auth/facebook/callback`, { params: { code, state } })
            .then(res => {
                const pages = res.data.pages || [];
                
                // Check if backend returned debug info (means 0 pages found)
                if (res.data.debug) {
                    setDebugInfo(res.data.debug);
                }

                // Filter for pages that actually have an IG Business Account linked
                const igAccounts = pages
                    .filter((p: any) => p.instagram_id)
                    .map((p: any) => ({
                        ig_id: p.instagram_id,
                        page_id: p.id,
                        name: p.name + " (IG)",
                        access_token: p.access_token,
                        picture: p.picture
                    }));
                
                if (igAccounts.length === 0) {
                    setIsError(true);
                    if (pages.length === 0) {
                        setStatusMsg("0 Facebook Pages Found.");
                    } else {
                        setStatusMsg(`Found ${pages.length} Facebook Page(s), but none have a linked Instagram Business Account.`);
                    }
                } else {
                    setAvailableAccounts(igAccounts);
                    setStatusMsg(""); // Clear status on success
                }
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            })
            .catch(err => {
                console.error("IG Auth Error", err);
                setIsError(true);
                // If it's a 500 error from our strict server, show a helpful message
                if (err.response?.status === 409) {
                    setStatusMsg("Authorization code expired. Please try connecting again.");
                } else if (err.response?.status === 500) {
                     setStatusMsg("Server Configuration Error: Missing Credentials or Invalid Setup.");
                } else {
                     setStatusMsg("Connection Failed: " + (err.response?.data?.error || err.message));
                }
            })
            .finally(() => setIsConnecting(false));
    }
  };

  const startOAuth = () => {
    // Redirect to relative path, handled by Vite proxy -> Server
    window.location.href = `/auth/facebook/login?flow=instagram`;
  };

  const connectAccount = async (acc: any) => {
    try {
        await axios.post(`/api/instagram/connect`, {
            igId: acc.ig_id,
            pageId: acc.page_id,
            accessToken: acc.access_token,
            name: acc.name
        });
        
        const newAccount: Account = {
            id: `ig_${acc.ig_id}`,
            platform: 'instagram',
            externalId: acc.ig_id,
            name: acc.name,
            accessToken: acc.access_token,
            connectedAt: Date.now(),
            status: 'active',
            pageId: acc.page_id,
            profilePictureUrl: acc.picture?.data?.url
        };
        
        db.saveAccount(newAccount);
        setAccounts([...accounts, newAccount]);
        setAvailableAccounts(availableAccounts.filter(a => a.ig_id !== acc.ig_id));
        setStatusMsg(`Connected ${acc.name}`);
        setIsError(false);
    } catch (e) {
        setIsError(true);
        setStatusMsg("Failed to register with backend");
    }
  };

  const handleDisconnect = (id: string) => {
      db.deleteAccount(id);
      setAccounts(db.getAccountsByPlatform('instagram'));
  };

  // --- Manual/Dev Logic ---
  const handleAutoDetect = async () => {
    const token = manualForm.token.replace(/\s/g, '');
    if (!token) { setStatusMsg("Paste a token first"); return; }
    setStatusMsg("Detecting...");
    try {
        const verify = await axios.post(`/api/instagram/verify`, { accessToken: token });
        if (verify.data.valid && verify.data.data.instagram_business_account?.id) {
            setManualForm(prev => ({ ...prev, id: verify.data.data.instagram_business_account.id, token: token, name: prev.name === 'Dev Account' ? verify.data.data.name : prev.name }));
            setStatusMsg("ID Found!");
            setIsError(false);
        } else { 
            setStatusMsg("No IG Business Account found."); 
            setIsError(true);
        }
    } catch (e: any) { 
        setStatusMsg("Failed: " + e.message); 
        setIsError(true);
    }
  };
  const handleManualConnect = async () => {
      const token = manualForm.token.replace(/\s/g, '');
      if (!manualForm.id || !token) return;
      try {
          await connectAccount({ ig_id: manualForm.id, page_id: 'manual', name: manualForm.name, access_token: token, picture: null });
          setStatusMsg("Connected!");
          setManualForm({ id: '', token: '', name: 'Dev Account' });
      } catch (e: any) { setStatusMsg("Error: " + e.message); }
  };
  const handleTestSend = async (account: Account) => {
      if (!testRecipient) { setTestResult("Enter IG User ID"); setTestResultType('error'); return; }
      setTestResult("Sending...");
      setTestResultType('warning');
      try {
          const res = await axios.post(`/api/instagram/send`, { to: testRecipient.trim(), text: "Hello from AutoChat Flow!", accountId: account.externalId });
          setTestResult(`Success: ${JSON.stringify(res.data)}`);
          setTestResultType('success');
      } catch (e: any) { 
          // Extract the actual error message sent by backend
          const errMsg = e.response?.data?.error || e.message;
          setTestResult(`Failed: ${errMsg}`); 
          setTestResultType('error');
      }
  };
  const handleScanConversations = async (account: Account) => {
    setIsScanning(true);
    setTestResultType(null);
    try {
        const res = await axios.post(`/api/instagram/conversations`, { 
            accessToken: account.accessToken, 
            igId: account.externalId,
            pageId: account.pageId 
        });
        
        // NEW: Check for Warning from Backend
        if (res.data.warning) {
             setTestResult(res.data.warning);
             setTestResultType('warning');
        } else {
             setFoundUsers(res.data.participants || []);
             if (res.data.participants.length === 0) {
                 setTestResult("Scan complete: 0 users found. (Bot needs messages first)");
                 setTestResultType('warning');
             } else {
                  setTestResult(`Scan complete. Found ${res.data.participants.length} users.`);
                  setTestResultType('success');
             }
        }

    } catch(e: any) { 
        const errMsg = e.response?.data?.error || e.message;
        
        // Handle Specific Meta Error (#3)
        if (errMsg.includes('(#3)')) {
            setTestResult("Error #3: You must add 'Instagram Graph API' product in Meta App Dashboard.");
        } else {
            setTestResult("Scan Error: " + errMsg);
        }
        setTestResultType('error');
    } finally { 
        setIsScanning(false); 
    }
  };

  const getTestResultColor = () => {
      if (testResultType === 'error') return 'text-red-400';
      if (testResultType === 'success') return 'text-green-400';
      if (testResultType === 'warning') return 'text-yellow-400';
      return 'text-slate-400';
  }

  // --- MAIN RENDER ---

  // 1. SPLIT SCREEN (Dark Mode) - When no accounts connected
  if (accounts.length === 0 && availableAccounts.length === 0 && !isDevMode) {
      return (
        <div className="flex h-full w-full bg-slate-900">
            {/* Left Graphic Side */}
            <div className="hidden lg:flex w-1/2 bg-slate-800 items-center justify-center relative overflow-hidden p-12 border-r border-slate-700">
                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                     <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
                     <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
                </div>

                {/* The "Chart" / Flow Visual - Landing Page Style */}
                <div className="relative w-full max-w-lg aspect-square bg-slate-950 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden transform rotate-[-2deg] hover:rotate-0 transition-all duration-500">
                    
                    {/* Header Bar of the Mock Window */}
                    <div className="h-12 border-b border-slate-800 bg-slate-900 flex items-center px-4 gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                        </div>
                        <div className="ml-4 h-6 w-32 bg-slate-800 rounded-full" />
                    </div>

                    {/* Canvas Content */}
                    <div className="relative w-full h-full p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
                        {/* SVG Connections */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                            <defs>
                                <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.6" />
                                </linearGradient>
                            </defs>
                            {/* Line 1: Trigger to AI */}
                            <path d="M110 90 C 180 90, 180 180, 250 180" stroke="url(#line-gradient)" strokeWidth="3" fill="none" />
                            {/* Line 2: AI to DM */}
                            <path d="M380 180 C 420 180, 420 120, 460 120" stroke="url(#line-gradient)" strokeWidth="3" fill="none" />
                        </svg>

                        {/* Node 1: Trigger */}
                        <div className="absolute top-[60px] left-[30px] w-[140px] z-10">
                            <div className="bg-slate-800/90 backdrop-blur border border-pink-500/30 p-3 rounded-xl shadow-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-pink-500/20 rounded-lg">
                                        <Instagram size={12} className="text-pink-500" />
                                    </div>
                                    <span className="text-[9px] font-bold text-pink-200 uppercase tracking-wide">Trigger</span>
                                </div>
                                <div className="text-[10px] font-bold text-white">Comment on Post</div>
                            </div>
                        </div>

                        {/* Node 2: AI Processing (Center Hero) */}
                        <div className="absolute top-[130px] left-[200px] w-[180px] z-20">
                             <div className="bg-slate-900/90 backdrop-blur border-2 border-purple-500/50 p-4 rounded-2xl shadow-2xl shadow-purple-900/20 relative overflow-hidden group">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-purple-500/20 rounded-lg animate-pulse">
                                            <Sparkles size={14} className="text-purple-400" />
                                        </div>
                                        <span className="text-[10px] font-bold text-purple-200">AI Agent</span>
                                    </div>
                                    <span className="text-[8px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-700/50">Gemini</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full w-2/3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                                    </div>
                                    <div className="text-[8px] text-slate-400 flex justify-between">
                                        <span>Thinking...</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Node 3: Send DM */}
                        <div className="absolute top-[90px] left-[420px] w-[130px] z-10">
                            <div className="bg-slate-800/90 backdrop-blur border border-blue-500/30 p-3 rounded-xl shadow-xl">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                        <MessageSquare size={12} className="text-blue-500" />
                                    </div>
                                    <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wide">Action</span>
                                </div>
                                <div className="text-[10px] font-bold text-white">Send DM</div>
                            </div>
                        </div>
                        
                        {/* Floating Badge */}
                        <div className="absolute bottom-6 right-6 bg-slate-800 text-white border border-slate-700 px-3 py-1.5 rounded-lg shadow-lg text-[10px] font-bold flex items-center gap-1.5 animate-bounce">
                            <CheckCircle size={10} className="text-green-500" /> 
                            <span>Connected</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Content Side */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-12 lg:px-32 bg-slate-900 relative">
                <button 
                    onClick={() => setIsDevMode(true)}
                    className="absolute top-8 right-8 text-slate-600 hover:text-slate-400 transition-colors"
                >
                    <Key size={18} />
                </button>

                <div className="max-w-[480px]">
                    <h1 className="text-[2rem] font-extrabold text-white mb-4">A few steps in</h1>
                    <p className="text-slate-400 mb-10 text-[1.1rem] leading-relaxed">
                        We'll take you to Meta to connect. Just set your permissions, and your Instagram account will be linked to AutoChat.
                    </p>
                    
                    {/* STATUS MESSAGE AREA */}
                    {statusMsg && (
                        <div className={`mb-6 p-4 rounded-lg border text-sm flex flex-col gap-3 ${isError ? 'bg-red-900/20 border-red-800 text-red-200' : 'bg-blue-900/20 border-blue-800 text-blue-200'}`}>
                            <div className="flex items-center gap-2 font-bold">
                                {isError ? <AlertTriangle className="shrink-0" size={18} /> : <Activity className="shrink-0 animate-pulse" size={18} />}
                                {statusMsg}
                            </div>
                            
                            {/* Detailed Troubleshooting for 0 pages / Dev Mode */}
                            {debugInfo && (
                                <div className="mt-2 p-3 bg-slate-900/50 rounded border border-slate-700/50 text-xs">
                                    <div className="font-bold text-yellow-400 mb-2 flex items-center gap-2">
                                        <ShieldAlert size={14} /> Troubleshooting: "0 Pages Found"
                                    </div>
                                    <p className="mb-2 text-slate-300">
                                        We authenticated you as <strong>{debugInfo.user}</strong>, but Meta returned 0 pages.
                                    </p>
                                    <p className="font-bold text-slate-400 mb-1">Most likely causes:</p>
                                    <ul className="list-disc pl-4 space-y-1 text-slate-400">
                                        <li>
                                            <strong>Development Mode:</strong> If your Facebook App is in Dev Mode, you MUST add <em>{debugInfo.user}</em> as a "Tester" or "Developer" in the Meta App Dashboard &gt; App Roles.
                                        </li>
                                        <li>
                                            <strong>Permissions Denied:</strong> Did you uncheck "Select All" in the popup?
                                        </li>
                                        <li>
                                            <strong>No Admin Role:</strong> You must be an Admin of the Facebook Page, not just an Editor.
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <button 
                        onClick={startOAuth}
                        disabled={isConnecting}
                        className="w-full bg-[#0084FF] hover:bg-[#0073E6] disabled:bg-slate-700 text-white font-bold text-[1.05rem] py-4 rounded-xl shadow-lg shadow-blue-500/10 transition-all transform hover:translate-y-[-1px] active:translate-y-[1px] flex items-center justify-center gap-3 mb-8"
                    >
                       {isConnecting ? (
                           <span className="flex items-center gap-2"><RefreshCw className="animate-spin" /> Connecting...</span>
                       ) : (
                           <>
                               <MetaLogo className="w-6 h-6" />
                               Connect Via Meta
                           </>
                       )}
                    </button>

                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex items-center justify-between mb-8">
                        <div>
                            <div className="font-bold text-slate-200 text-sm">AutoChat is a trusted</div>
                            <div className="font-bold text-slate-200 text-sm">Meta Business Partner</div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 font-bold">
                             <MetaLogo className="w-8 h-8 text-white" />
                             <span className="text-lg tracking-tight">Meta</span>
                        </div>
                    </div>

                    {/* Expandable Options */}
                    <div>
                        <button 
                            onClick={() => setShowMoreOptions(!showMoreOptions)}
                            className="flex items-center gap-2 text-[#0084FF] font-bold text-sm hover:underline mb-4 transition-all"
                        >
                            See More Options {showMoreOptions ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </button>
                        
                        {showMoreOptions && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                <button className="px-4 py-3 border border-slate-700 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-800 transition-colors">
                                    Meta Business Suite
                                </button>
                                <button className="px-4 py-3 border border-slate-700 rounded-xl text-slate-400 font-bold text-sm hover:bg-slate-800 transition-colors">
                                    Legacy Connect
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // 2. CONNECTED / MANAGED STATE
  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-900">
      <header className="mb-8 flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Instagram className="text-pink-500" /> Instagram Connected
            </h2>
            <p className="text-slate-400 mt-2">Manage your connected automation channels.</p>
        </div>
        <button 
            onClick={() => setIsDevMode(!isDevMode)}
            className={`text-xs px-3 py-1.5 rounded border ${isDevMode ? 'bg-purple-900 border-purple-500 text-white' : 'border-slate-700 text-slate-500'}`}
        >
            {isDevMode ? 'Dev Mode ON' : 'Dev Mode'}
        </button>
      </header>

      {/* Available Accounts to Connect (Post-Auth) */}
      {availableAccounts.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold text-white mb-4">Select Account to Connect</h3>
              <div className="space-y-3">
                  {availableAccounts.map(acc => (
                      <div key={acc.ig_id} className="flex items-center justify-between bg-slate-800 p-4 rounded-lg border border-slate-700">
                          <div className="flex items-center gap-4">
                              {acc.picture?.data?.url ? (
                                  <img src={acc.picture.data.url} className="w-10 h-10 rounded-full" />
                              ) : (
                                  <div className="w-10 h-10 bg-slate-700 rounded-full" />
                              )}
                              <span className="font-bold text-white">{acc.name}</span>
                          </div>
                          <button 
                              onClick={() => connectAccount(acc)}
                              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold"
                          >
                              Connect
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Connected Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
            {accounts.map(account => (
                <div key={account.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-4">
                            {account.profilePictureUrl ? (
                                <img src={account.profilePictureUrl} className="w-14 h-14 rounded-full border-2 border-slate-600" alt="Profile" />
                            ) : (
                                <div className="w-14 h-14 bg-gradient-to-tr from-yellow-400 to-pink-600 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-lg">
                                    {account.name.charAt(0)}
                                </div>
                            )}
                            <div>
                                <h3 className="font-bold text-white text-xl">{account.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded font-bold border border-green-500/30 flex items-center gap-1">
                                        <Check size={10} /> Active
                                    </span>
                                    <span className="text-slate-500 text-xs font-mono">{account.externalId}</span>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDisconnect(account.id)}
                            className="text-slate-500 hover:text-red-400 p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform shadow-lg shadow-blue-900/20 group">
                             <div>
                                 <div className="font-bold text-white flex items-center gap-2">
                                    <Zap className="text-yellow-300" size={18} /> Start Automating
                                 </div>
                                 <div className="text-blue-100 text-xs mt-1">Go to Flow Builder to create logic</div>
                             </div>
                             <ArrowRight className="text-white group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>

                    {/* Dev/Test Tools within card */}
                    <div className="mt-4 pt-4 border-t border-slate-700 bg-slate-900/30 -mx-6 -mb-6 p-4 rounded-b-xl">
                             <div className="flex gap-2 mb-2">
                                <input 
                                    value={testRecipient}
                                    onChange={e => setTestRecipient(e.target.value)}
                                    placeholder="IG User ID (IGSID)"
                                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1 text-xs text-white"
                                />
                                <button onClick={() => handleTestSend(account)} className="bg-slate-700 text-white px-3 py-1 rounded text-xs font-bold">Test Send</button>
                             </div>
                             {testResult && (
                                 <div className={`text-[10px] font-mono break-all bg-black p-2 rounded mb-2 ${getTestResultColor()}`}>
                                     {testResultType === 'warning' && <span className="block font-bold mb-1">⚠️ Warning</span>}
                                     {testResult}
                                 </div>
                             )}
                             <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Tools</span>
                                <button onClick={() => handleScanConversations(account)} className="text-[10px] text-blue-400 hover:text-white flex items-center gap-1">
                                    {isScanning ? <RefreshCw size={10} className="animate-spin"/> : null} 
                                    {isScanning ? 'Scanning...' : 'Scan IDs (Find recent users)'}
                                </button>
                             </div>
                             {foundUsers.length > 0 && (
                                 <div className="mt-2 space-y-1">
                                     <p className="text-[9px] text-green-400 mb-1">Found {foundUsers.length} users who messaged you:</p>
                                     {foundUsers.map(u => (
                                         <div key={u.id} className="flex justify-between text-[10px] text-slate-400 bg-slate-900 p-1 rounded border border-slate-700">
                                             <span>@{u.username || 'Unknown'} <span className="text-[9px] opacity-50">({u.id})</span></span>
                                             <button onClick={() => { setTestRecipient(u.id); }} className="text-blue-400 font-bold hover:text-white">Use</button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                    </div>
                </div>
            ))}

            <button 
                onClick={startOAuth} 
                className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 font-bold hover:text-white hover:border-slate-500 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
                <RefreshCw size={18} /> Connect Another Account
            </button>
        </div>

        {/* Right Info Column */}
        <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Activity size={20} className="text-blue-400" /> Automation Status
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Connection Status</span>
                        <span className="text-green-400 font-bold flex items-center gap-1"><Check size={14}/> Online</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Webhook Events</span>
                        <span className="text-green-400 font-bold flex items-center gap-1"><Check size={14}/> Listening</span>
                    </div>
                    <div className="h-px bg-slate-700 my-2" />
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Your account is ready to receive messages. Go to the <strong>Simulator</strong> to test triggers without sending real messages, or use the <strong>Flow Builder</strong> to design your bot.
                    </p>
                </div>
            </div>

            {isDevMode && (
                <div className="bg-purple-900/10 border border-purple-500/30 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-purple-200 text-sm uppercase">Manual Access</h3>
                    </div>
                    <div className="space-y-3">
                         <input 
                            value={manualForm.token}
                            onChange={e => setManualForm({...manualForm, token: e.target.value})}
                            type="password"
                            placeholder="Paste Page Access Token"
                            className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                         />
                         <div className="flex gap-2">
                             <input 
                                value={manualForm.id}
                                onChange={e => setManualForm({...manualForm, id: e.target.value})}
                                placeholder="IG Business ID"
                                className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white"
                             />
                             <button onClick={handleAutoDetect} className="bg-slate-700 text-white px-3 text-xs rounded">Auto</button>
                         </div>
                         <button onClick={handleManualConnect} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded text-xs">
                             Force Connect
                         </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
