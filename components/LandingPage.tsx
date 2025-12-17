
import React, { useState, useRef, useEffect } from 'react';
import { 
  GitGraph, 
  Zap, 
  MessageSquare, 
  Instagram, 
  Facebook, 
  Phone, 
  Check, 
  ChevronRight, 
  Sparkles, 
  Globe, 
  Shield, 
  Bot, 
  ArrowRight,
  Menu,
  X,
  Plus,
  Play
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  
  // Hero Animation State
  const [highlightIndex, setHighlightIndex] = useState(0);
  
  // How it Works Animation State
  const [howItWorksIndex, setHowItWorksIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hero Text Interval (3 items + All = 4 states)
    const heroInterval = setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % 4);
    }, 2000);

    // How It Works Interval (4 items + All = 5 states)
    const stepsInterval = setInterval(() => {
      setHowItWorksIndex((prev) => (prev + 1) % 5);
    }, 1500);

    return () => {
      clearInterval(heroInterval);
      clearInterval(stepsInterval);
    };
  }, []);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    const container = containerRef.current;
    
    if (element && container) {
       const offset = 100; // Header height + padding
       // Calculate position relative to the scroll container
       const containerRect = container.getBoundingClientRect();
       const elementRect = element.getBoundingClientRect();
       // Current scroll + distance from container top to element top
       const targetScroll = container.scrollTop + (elementRect.top - containerRect.top) - offset;
       
       container.scrollTo({
         top: targetScroll,
         behavior: 'smooth'
       });
    }
    setMobileMenuOpen(false);
  };

  const getHighlightClass = (index: number) => {
    if (highlightIndex === 3) return "text-white opacity-100 blur-0"; // Show all
    if (highlightIndex === index) return "text-white opacity-100 blur-0";
    return "text-slate-500 opacity-30 blur-[1px]";
  };

  const getStepClass = (index: number) => {
    // State 4 is "Show All"
    if (howItWorksIndex === 4) return "opacity-100 scale-100 blur-0 bg-slate-800/80 border-slate-700";
    
    // Active State
    if (howItWorksIndex === index) return "opacity-100 scale-105 blur-0 bg-slate-800 border-blue-500/50 shadow-lg shadow-blue-900/10";
    
    // Inactive State
    return "opacity-40 scale-95 blur-[0.5px] bg-transparent border-transparent";
  };

  return (
    <div ref={containerRef} className="h-full bg-slate-950 text-slate-50 overflow-y-auto overflow-x-hidden font-sans scroll-smooth">
      
      {/* --- VIDEO DEMO MODAL --- */}
      {showDemo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={() => setShowDemo(false)}>
          <div className="relative w-full max-w-6xl aspect-video bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700" onClick={e => e.stopPropagation()}>
             <button 
                onClick={() => setShowDemo(false)} 
                className="absolute top-4 right-4 z-20 bg-black/60 hover:bg-slate-800 text-white p-2 rounded-full backdrop-blur-md transition-all border border-white/10"
             >
                <X size={24} />
             </button>
             <iframe 
                width="100%" 
                height="100%" 
                // Using official Google Gemini Intro video which allows embedding
                src="https://www.youtube.com/embed/jV1vkHv4zq8?autoplay=1&mute=1&rel=0&modestbranding=1" 
                title="Product Demo" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowFullScreen
                className="w-full h-full"
             ></iframe>
          </div>
        </div>
      )}

      {/* --- NAVIGATION --- */}
      <nav className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 top-0 left-0 right-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <GitGraph className="text-white" size={24} />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                AutoChat Flow
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Features</a>
              <a href="#ai" onClick={(e) => scrollToSection(e, 'ai')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">AI Engine</a>
              <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Pricing</a>
              <button onClick={onGetStarted} className="text-sm font-bold text-white hover:text-blue-400">Log In</button>
              <button 
                onClick={onGetStarted}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-blue-900/20 hover:scale-105"
              >
                Get Started Free
              </button>
            </div>

            <div className="md:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-slate-300">
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-4">
            <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="block text-slate-300 font-medium">Features</a>
            <a href="#ai" onClick={(e) => scrollToSection(e, 'ai')} className="block text-slate-300 font-medium">AI Engine</a>
            <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')} className="block text-slate-300 font-medium">Pricing</a>
            <button onClick={onGetStarted} className="block w-full text-left text-blue-400 font-bold">Log In</button>
            <button onClick={onGetStarted} className="block w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Get Started Free</button>
          </div>
        )}
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/20 rounded-[100%] blur-[100px] opacity-50 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-full px-4 py-1.5 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sparkles size={14} className="text-yellow-400" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">New: AI Flow Generator</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-8 leading-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Automate Social Growth <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Without Writing Code
            </span>
          </h1>
          
          <div className="max-w-2xl mx-auto text-lg mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <span className={`transition-all duration-700 ${getHighlightClass(0)}`}>
              Connect Instagram, WhatsApp, and Messenger.{" "}
            </span>
            <span className={`transition-all duration-700 ${getHighlightClass(1)}`}>
              Build visual chatbots or let our AI generate them for you.{" "}
            </span>
            <span className={`transition-all duration-700 ${getHighlightClass(2)}`}>
              Scale your customer support and sales 24/7.
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <button 
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-4 bg-white text-slate-950 rounded-full font-bold text-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              Start For Free <ArrowRight size={20} />
            </button>
            <button 
                onClick={() => setShowDemo(true)}
                className="w-full sm:w-auto px-8 py-4 bg-slate-800 text-white border border-slate-700 rounded-full font-bold text-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <Play size={20} fill="currentColor" /> Watch Demo
            </button>
          </div>

          {/* Hero Mockup */}
          <div className="relative max-w-5xl mx-auto mt-12 animate-in fade-in zoom-in duration-1000 delay-500">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-20 h-full w-full pointer-events-none" />
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl">
              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 aspect-[16/9] relative flex">
                {/* Mock Sidebar */}
                <div className="w-64 border-r border-slate-800 bg-slate-900/50 p-4 hidden md:block z-20 relative">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg"></div>
                        <div className="h-4 w-24 bg-slate-800 rounded"></div>
                    </div>
                    <div className="space-y-3">
                        <div className="h-8 w-full bg-slate-800/50 rounded flex items-center px-2">
                           <div className="w-4 h-4 rounded-sm bg-slate-700"></div>
                           <div className="w-20 h-2 bg-slate-700 rounded ml-2"></div>
                        </div>
                        <div className="h-8 w-full bg-blue-900/20 border border-blue-900/50 rounded flex items-center px-2">
                           <div className="w-4 h-4 rounded-sm bg-blue-600"></div>
                           <div className="w-24 h-2 bg-blue-200/50 rounded ml-2"></div>
                        </div>
                        <div className="h-8 w-full bg-slate-800/50 rounded flex items-center px-2">
                           <div className="w-4 h-4 rounded-sm bg-slate-700"></div>
                           <div className="w-16 h-2 bg-slate-700 rounded ml-2"></div>
                        </div>
                    </div>
                    <div className="mt-auto absolute bottom-4 left-4 right-4">
                        <div className="h-20 w-full bg-slate-800/50 rounded-lg border border-slate-800"></div>
                    </div>
                </div>
                
                {/* Mock Canvas - Beautiful Flow */}
                <div className="flex-1 p-8 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
                    
                    {/* SVG Connections */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        <defs>
                            <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.6" />
                            </linearGradient>
                        </defs>
                        {/* Line 1: Trigger to AI */}
                        <path d="M220 100 C 300 100, 300 180, 380 180" stroke="url(#line-gradient)" strokeWidth="3" fill="none" />
                        {/* Line 2: AI to DM */}
                        <path d="M600 180 C 650 180, 650 120, 700 120" stroke="url(#line-gradient)" strokeWidth="3" fill="none" />
                        {/* Line 3: AI to Admin */}
                        <path d="M600 180 C 650 180, 650 240, 700 240" stroke="url(#line-gradient)" strokeWidth="3" fill="none" />
                    </svg>

                    {/* Node 1: Trigger */}
                    <div className="absolute top-[60px] left-[40px] w-[180px] z-10">
                        <div className="bg-slate-800/90 backdrop-blur border border-pink-500/30 p-4 rounded-xl shadow-xl hover:scale-105 transition-transform cursor-default">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-pink-500/20 rounded-lg">
                                    <Instagram size={14} className="text-pink-500" />
                                </div>
                                <span className="text-[10px] font-bold text-pink-200 uppercase tracking-wide">Trigger</span>
                            </div>
                            <div className="text-xs font-bold text-white">Comment on Post</div>
                            <div className="text-[10px] text-slate-400 mt-1">Keywords: "Price", "Cost"</div>
                        </div>
                    </div>

                    {/* Node 2: AI Processing (Center Hero) */}
                    <div className="absolute top-[130px] left-[380px] w-[220px] z-20">
                         <div className="bg-slate-900/90 backdrop-blur border-2 border-purple-500/50 p-5 rounded-2xl shadow-2xl shadow-purple-900/20 hover:scale-105 transition-transform relative overflow-hidden group cursor-default">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-purple-500/20 rounded-lg animate-pulse">
                                        <Sparkles size={16} className="text-purple-400" />
                                    </div>
                                    <span className="text-xs font-bold text-purple-200">AI Agent</span>
                                </div>
                                <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full border border-purple-700/50">Gemini</span>
                            </div>
                            <div className="space-y-2">
                                <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full w-2/3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full" />
                                </div>
                                <div className="text-[10px] text-slate-400 flex justify-between">
                                    <span>Analyzing sentiment...</span>
                                    <span className="text-green-400">Positive</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Node 3: Send DM */}
                    <div className="absolute top-[70px] left-[700px] w-[200px] z-10">
                        <div className="bg-slate-800/90 backdrop-blur border border-blue-500/30 p-4 rounded-xl shadow-xl hover:scale-105 transition-transform cursor-default">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                    <MessageSquare size={14} className="text-blue-500" />
                                </div>
                                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wide">Action</span>
                            </div>
                            <div className="text-xs font-bold text-white">Send DM</div>
                            <div className="text-[10px] text-slate-400 mt-1 bg-slate-900 p-2 rounded border border-slate-700/50">
                                "Hey! saw you asked about the price..."
                            </div>
                        </div>
                    </div>

                    {/* Node 4: Notify Team */}
                    <div className="absolute top-[200px] left-[700px] w-[200px] z-10">
                        <div className="bg-slate-800/90 backdrop-blur border border-slate-600/30 p-4 rounded-xl shadow-xl hover:scale-105 transition-transform opacity-80 cursor-default">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-slate-700 rounded-lg">
                                    <Bot size={14} className="text-slate-300" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Internal</span>
                            </div>
                            <div className="text-xs font-bold text-slate-300">Notify Sales Team</div>
                            <div className="text-[10px] text-slate-500 mt-1">Via Slack Integration</div>
                        </div>
                    </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- VALUE PROPOSITION / FEATURES --- */}
      <section id="features" className="py-24 bg-slate-950 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Everything you need to automate</h2>
                <p className="text-slate-400 max-w-2xl mx-auto">Stop replying manually. Build intelligent flows that qualify leads, support customers, and drive sales 24/7.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Feature 1 */}
                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl hover:border-slate-700 transition-all group">
                    <div className="w-14 h-14 bg-blue-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Globe className="text-blue-400" size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4">Multi-Channel Hub</h3>
                    <p className="text-slate-400 leading-relaxed mb-6">
                        Connect multiple Instagram accounts, Facebook Pages, and WhatsApp numbers in one dashboard.
                    </p>
                    <div className="flex gap-4 opacity-50">
                        <Instagram size={20} /> <Facebook size={20} /> <Phone size={20} />
                    </div>
                </div>

                 {/* Feature 2 */}
                 <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl hover:border-slate-700 transition-all group">
                    <div className="w-14 h-14 bg-purple-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <GitGraph className="text-purple-400" size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4">Visual Flow Builder</h3>
                    <p className="text-slate-400 leading-relaxed">
                        Drag-and-drop builder with conditional logic, delays, and rich media. No coding skills required.
                    </p>
                </div>

                 {/* Feature 3 */}
                 <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl hover:border-slate-700 transition-all group">
                    <div className="w-14 h-14 bg-green-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                        <Shield className="text-green-400" size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4">Smart Limits</h3>
                    <p className="text-slate-400 leading-relaxed">
                        Track monthly interactions automatically. Our system helps you scale safely without hitting platform bans.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* --- AI SECTION --- */}
      <section id="ai" className="py-24 relative overflow-hidden border-y border-slate-900">
        <div className="absolute inset-0 bg-slate-900/20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                    <div className="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-800 rounded-full px-4 py-1.5 mb-6">
                        <Sparkles size={14} className="text-purple-400" />
                        <span className="text-xs font-bold text-purple-200 uppercase tracking-wide">AI Flow Generator</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Don't build from scratch. <br/>
                        <span className="text-purple-400">Just ask.</span>
                    </h2>
                    <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                        Describe what you want: "Create a lead magnet flow that asks for email and sends a coupon if they reply yes." 
                        <br/><br/>
                        Our AI architect builds the entire node structure, logic, and copy for you in seconds.
                    </p>
                    <ul className="space-y-4 mb-8">
                        {['Instant Structure Generation', 'Context-Aware Copywriting', 'Logic & Branching Included'].map((item, i) => (
                            <li key={i} className="flex items-center gap-3 text-slate-300">
                                <div className="w-6 h-6 rounded-full bg-purple-900/50 flex items-center justify-center border border-purple-800">
                                    <Check size={14} className="text-purple-400" />
                                </div>
                                {item}
                            </li>
                        ))}
                    </ul>
                    <button onClick={onGetStarted} className="bg-white text-slate-900 px-6 py-3 rounded-lg font-bold hover:bg-slate-200 transition-colors">
                        Try AI Generator
                    </button>
                </div>

                {/* AI Visual */}
                <div className="relative">
                    <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl opacity-30 blur-2xl"></div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative">
                        {/* Prompt Input */}
                        <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-800 flex gap-4 items-start">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-slate-500">YOU</span>
                            </div>
                            <div className="text-slate-300 text-sm font-mono">
                                "Create a support bot for my clothing brand. Ask for order number, and if missing, escalate to a human."
                            </div>
                        </div>

                        {/* AI Processing Animation */}
                        <div className="flex justify-center mb-6">
                            <div className="bg-purple-900/20 border border-purple-500/30 text-purple-300 px-4 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
                                <Sparkles size={12} /> AI Generating Nodes...
                            </div>
                        </div>

                        {/* Generated Result */}
                        <div className="space-y-3 pl-8 border-l-2 border-slate-800 relative">
                            <div className="absolute top-0 left-[-5px] w-2 h-2 rounded-full bg-slate-600"></div>
                             <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 w-3/4">
                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">NODE 1: QUESTION</div>
                                <div className="text-xs text-slate-300">"Hi! What is your order #?"</div>
                            </div>
                            <div className="absolute top-1/2 left-[-5px] w-2 h-2 rounded-full bg-slate-600"></div>
                            <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 w-3/4 ml-auto border-l-4 border-l-yellow-500">
                                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">NODE 2: LOGIC</div>
                                <div className="text-xs text-slate-300">Check if Order # exists</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="py-24 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white">How it works</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {[
                    { step: '01', title: 'Create Account', desc: 'Sign up for free. No credit card required.' },
                    { step: '02', title: 'Connect Channels', desc: 'Link your IG, WhatsApp, or Facebook Page securely.' },
                    { step: '03', title: 'Build Flow', desc: 'Use the visual editor or ask AI to build it for you.' },
                    { step: '04', title: 'Launch & Scale', desc: 'Turn it on. Watch your engagement skyrocket.' }
                ].map((s, i) => (
                    <div key={i} className={`relative transition-all duration-500 p-6 rounded-xl border ${getStepClass(i)}`}>
                        <div className="text-6xl font-bold text-slate-800 mb-4 opacity-50">{s.step}</div>
                        <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                        <p className="text-slate-400 text-sm">{s.desc}</p>
                        {i < 3 && <div className="hidden md:block absolute top-10 right-0 w-12 h-0.5 bg-slate-800 -mr-9"></div>}
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* --- PRICING --- */}
      <section id="pricing" className="py-24 bg-slate-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Simple, transparent pricing</h2>
                <p className="text-slate-400">Start for free, upgrade as you grow.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {/* FREE */}
                <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 hover:border-slate-600 transition-all flex flex-col">
                    <h3 className="text-xl font-bold text-slate-300 mb-2">Free</h3>
                    <div className="text-4xl font-bold text-white mb-6">$0 <span className="text-sm font-normal text-slate-500">/mo</span></div>
                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-3 text-slate-300 text-sm"><Check size={16} className="text-slate-500"/> 100 Monthly Actions</li>
                        <li className="flex items-center gap-3 text-slate-300 text-sm"><Check size={16} className="text-slate-500"/> 1 Connected Account</li>
                        <li className="flex items-center gap-3 text-slate-300 text-sm"><Check size={16} className="text-slate-500"/> Visual Builder</li>
                        <li className="flex items-center gap-3 text-slate-500 text-sm"><X size={16} /> No AI Generator</li>
                    </ul>
                    <button onClick={onGetStarted} className="w-full py-3 rounded-lg border border-slate-700 text-white font-bold hover:bg-slate-800 transition-colors">Start Free</button>
                </div>

                {/* PRO */}
                <div className="bg-slate-950 p-8 rounded-2xl border-2 border-blue-600 relative transform md:-translate-y-4 shadow-2xl flex flex-col">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase">Most Popular</div>
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Zap size={18} className="text-blue-500"/> Pro</h3>
                    <div className="text-4xl font-bold text-white mb-6">$29 <span className="text-sm font-normal text-slate-500">/mo</span></div>
                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-3 text-white text-sm"><Check size={16} className="text-blue-500"/> 5,000 Monthly Actions</li>
                        <li className="flex items-center gap-3 text-white text-sm"><Check size={16} className="text-blue-500"/> 5 Connected Accounts</li>
                        <li className="flex items-center gap-3 text-white text-sm"><Check size={16} className="text-blue-500"/> AI Flow Generator</li>
                        <li className="flex items-center gap-3 text-white text-sm"><Check size={16} className="text-blue-500"/> Priority Support</li>
                    </ul>
                    <button onClick={onGetStarted} className="w-full py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors">Get Started</button>
                </div>

                {/* BUSINESS */}
                <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 hover:border-slate-600 transition-all flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-2">Business</h3>
                    <div className="text-4xl font-bold text-white mb-6">$99 <span className="text-sm font-normal text-slate-500">/mo</span></div>
                    <ul className="space-y-4 mb-8 flex-1">
                        <li className="flex items-center gap-3 text-slate-300 text-sm"><Check size={16} className="text-purple-500"/> 25,000+ Monthly Actions</li>
                        <li className="flex items-center gap-3 text-slate-300 text-sm"><Check size={16} className="text-purple-500"/> Unlimited Accounts</li>
                        <li className="flex items-center gap-3 text-slate-300 text-sm"><Check size={16} className="text-purple-500"/> Advanced AI Models</li>
                        <li className="flex items-center gap-3 text-slate-300 text-sm"><Check size={16} className="text-purple-500"/> Priority Routing</li>
                    </ul>
                    <button onClick={onGetStarted} className="w-full py-3 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors">Contact Sales</button>
                </div>
            </div>
        </div>
      </section>

      {/* --- TESTIMONIALS --- */}
      <section className="py-24 bg-slate-950 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white text-center mb-16">Trusted by growth leaders</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { quote: "The AI generator saved me hours. I just described my funnel and it built it perfectly.", name: "Sarah J.", role: "E-commerce Founder" },
                    { quote: "Finally, a tool that handles IG and WhatsApp in one place. My response time dropped by 80%.", name: "Mike T.", role: "Agency Owner" },
                    { quote: "The limits on the Pro plan are perfect for scaling. Highly recommended.", name: "Elena R.", role: "Digital Marketer" }
                ].map((t, i) => (
                    <div key={i} className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                        <div className="flex text-yellow-500 mb-4">
                            {[1,2,3,4,5].map(s => <Sparkles key={s} size={14} fill="currentColor" />)}
                        </div>
                        <p className="text-slate-300 mb-6 italic">"{t.quote}"</p>
                        <div>
                            <div className="font-bold text-white">{t.name}</div>
                            <div className="text-xs text-slate-500">{t.role}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section className="py-24 bg-slate-950">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-white text-center mb-12">Frequently Asked Questions</h2>
            <div className="space-y-4">
                {[
                    { q: "How do monthly limits work?", a: "Each time your bot sends a message or performs an action, it counts as 1 action. The Free plan includes 100/mo." },
                    { q: "Can I connect multiple Instagram accounts?", a: "Yes! On the Pro plan you can connect up to 5 accounts, and Unlimited on Business." },
                    { q: "Do I need coding skills?", a: "Not at all. Our Visual Flow Builder is drag-and-drop. Or just use AI to build it for you." },
                    { q: "What happens if I reach my limit?", a: "Your bots will pause until the next billing cycle or until you upgrade to a higher tier." }
                ].map((faq, i) => (
                    <div key={i} className="border border-slate-800 rounded-lg bg-slate-900/50 overflow-hidden">
                        <button 
                            onClick={() => toggleFaq(i)}
                            className="w-full flex justify-between items-center p-4 text-left font-bold text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                            {faq.q}
                            <ChevronRight className={`transform transition-transform ${activeFaq === i ? 'rotate-90' : ''}`} size={20} />
                        </button>
                        {activeFaq === i && (
                            <div className="p-4 pt-0 text-slate-400 text-sm border-t border-slate-800/50 bg-slate-900">
                                {faq.a}
                            </div>
                        )}
                    </div>
                ))}
            </div>
          </div>
      </section>

      {/* --- FINAL CTA --- */}
      <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-950 text-center px-4">
          <div className="max-w-2xl mx-auto">
              <h2 className="text-4xl font-bold text-white mb-6">Ready to automate your growth?</h2>
              <p className="text-slate-400 mb-8">Join thousands of businesses saving time and making money with AutoChat Flow.</p>
              <button 
                onClick={onGetStarted}
                className="bg-white text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-white/10"
              >
                  Start For Free Now
              </button>
          </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
                <GitGraph className="text-white" size={20} />
                <span className="font-bold text-white">AutoChat Flow</span>
              </div>
              <p className="text-slate-600 text-sm">© {new Date().getFullYear()} AutoChat Flow. All rights reserved.</p>
          </div>
      </footer>
    </div>
  );
};
