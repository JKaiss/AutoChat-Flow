
import React, { useState, useEffect, useMemo } from 'react';
import { Flow, FlowNode, NodeType, TriggerType, Account, Platform } from '../types';
import { NODE_TYPES, TRIGGER_TYPES } from '../constants';
import { Plus, Save, Trash2, X, Lock, Sparkles, Loader, Wand2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { db } from '../services/db'; // Keep for accounts

export const FlowBuilder: React.FC = () => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // State for saving changes
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { user, triggerUpgrade, refreshUsage } = useAuth();
  
  useEffect(() => {
    fetchFlows();
    setAccounts(db.getAllAccounts());
  }, []);

  const fetchFlows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/flows');
      setFlows(res.data);
    } catch (e) {
      setError("Failed to load flows. Is the server running?");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const activeFlow = useMemo(() => flows.find(f => f.id === activeFlowId), [flows, activeFlowId]);

  const getPlatformFromTrigger = (trigger: TriggerType): Platform | 'all' => {
      if (trigger.startsWith('instagram')) return 'instagram';
      if (trigger.startsWith('whatsapp')) return 'whatsapp';
      if (trigger.startsWith('messenger')) return 'facebook';
      return 'all';
  };

  const filteredAccounts = useMemo(() => {
      if (!activeFlow) return [];
      const platform = getPlatformFromTrigger(activeFlow.triggerType);
      if (platform === 'all') return [];
      return accounts.filter(a => a.platform === platform);
  }, [activeFlow, accounts]);

  const createFlow = async () => {
    try {
        const res = await axios.post('/api/flows', {
            name: 'Untitled Flow',
            triggerType: 'instagram_dm',
        });
        const newFlow = res.data;
        setFlows(prev => [...prev, newFlow]);
        setActiveFlowId(newFlow.id);
    } catch (e) {
        alert("Failed to create flow.");
    }
  };
  
  const handleSaveFlow = async () => {
      if (!activeFlow || !isDirty) return;
      setIsSaving(true);
      try {
          await axios.put(`/api/flows/${activeFlow.id}`, activeFlow);
          setIsDirty(false);
      } catch (e) {
          alert('Failed to save flow.');
      } finally {
          setIsSaving(false);
      }
  };

  const updateFlow = (updatedFlow: Partial<Flow>) => {
    setFlows(flows.map(f => f.id === activeFlowId ? { ...f, ...updatedFlow } as Flow : f));
    setIsDirty(true);
  };

  const handleDeleteFlow = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this flow?')) {
        try {
            await axios.delete(`/api/flows/${id}`);
            setFlows(flows.filter(f => f.id !== id));
            if (activeFlowId === id) setActiveFlowId(null);
        } catch (e) {
            alert("Failed to delete flow.");
        }
    }
  };

  const addNode = (type: NodeType) => {
    if (!activeFlow) return;

    if (type === 'ai_generate' && user?.plan === 'free') {
        triggerUpgrade('AI Nodes are locked on Free Plan');
        return;
    }

    const newNode: FlowNode = {
      id: `node_${Date.now()}`,
      type,
      position: { x: 50, y: (activeFlow.nodes.length + 1) * 120 },
      data: { content: '', delayMs: 1000 },
    };
    const updatedNodes = [...activeFlow.nodes, newNode];
    updateFlow({ nodes: updatedNodes });
    setSelectedNodeId(newNode.id);
  };

  const deleteNode = (nodeId: string) => {
    if (!activeFlow) return;
    const updatedNodes = activeFlow.nodes.filter(n => n.id !== nodeId);
    updateFlow({ nodes: updatedNodes });
    setSelectedNodeId(null);
  };

  const updateNodeData = (nodeId: string, data: any) => {
    if (!activeFlow) return;
    const updatedNodes = activeFlow.nodes.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
    );
    updateFlow({ nodes: updatedNodes });
  };

  const handleAiClick = () => { /* ... unchanged ... */ };
  const generateFlowWithAi = async () => { /* ... unchanged ... */ };
  
  if (isLoading) {
      return <div className="p-8 flex items-center justify-center h-full"><Loader className="animate-spin text-blue-500" /></div>;
  }
  if (error) {
      return <div className="p-8 text-center text-red-400 flex flex-col items-center gap-2"><AlertTriangle /> {error}</div>;
  }

  if (!activeFlowId) {
    return (
      <div className="p-8 h-full relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Automation Flows</h2>
          <div className="flex gap-3">
              <button onClick={handleAiClick} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Sparkles size={18} /> AI Generate
              </button>
              <button onClick={createFlow} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Plus size={18} /> New Flow
              </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map(flow => (
            <div key={flow.id} onClick={() => setActiveFlowId(flow.id)} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500 cursor-pointer transition-all relative group">
              <button onClick={(e) => handleDeleteFlow(e, flow.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 p-2 rounded-lg z-20">
                <Trash2 size={18} />
              </button>
              <h3 className="font-bold text-lg mb-2 pr-8 truncate">{flow.name}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className={`px-2 py-1 rounded text-xs uppercase ${flow.triggerType.includes('whatsapp') ? 'bg-green-900 text-green-300' : 'bg-pink-900 text-pink-300'}`}>
                    {flow.triggerType.split('_')[0]}
                </span>
                <span>{flow.nodes?.length || 0} nodes</span>
              </div>
            </div>
          ))}
          {flows.length === 0 && <div className="col-span-3 text-center py-20 text-slate-500">No flows yet. Create one to get started.</div>}
        </div>
        {showAiModal && ( /* ... unchanged ... */ )}
      </div>
    );
  }
  
  const selectedNode = activeFlow?.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-full flex flex-col">
      <div className="h-28 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={() => setActiveFlowId(null)} className="text-slate-400 hover:text-white">← Back</button>
          <div className="w-full">
            <input 
                value={activeFlow?.name} 
                onChange={(e) => updateFlow({ name: e.target.value })}
                className="bg-transparent border-none text-white font-bold text-lg focus:ring-0 block w-full p-0 mb-2" 
            />
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-bold">TRIGGER:</span>
                    <select 
                        value={activeFlow?.triggerType}
                        onChange={(e) => updateFlow({ triggerType: e.target.value as TriggerType, triggerAccountId: undefined })}
                        className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1 outline-none"
                    >
                       {/* ... options unchanged ... */}
                    </select>
                </div>
                {filteredAccounts.length > 0 && ( /* ... unchanged ... */ )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
             onClick={handleSaveFlow}
             disabled={!isDirty || isSaving}
             className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
                 isSaving ? 'bg-yellow-600 text-white' : 
                 isDirty ? 'bg-blue-600 text-white hover:bg-blue-500' : 
                 'bg-green-600/20 text-green-400'
             }`}
          >
            {isSaving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Components</h4>
            {NODE_TYPES.map(type => (
                <button key={type.type} onClick={() => addNode(type.type)} 
                  className="flex items-center justify-between p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${type.color}`} /> {type.label}
                    </div>
                    {type.type === 'ai_generate' && user?.plan === 'free' && (<Lock size={12} />)}
                </button>
            ))}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-slate-900 overflow-y-auto p-8 relative">
            <div className="max-w-xl mx-auto space-y-4 pb-20">
                <div className="flex justify-center">
                    {/* ... trigger display unchanged ... */}
                </div>
                <div className="w-0.5 h-6 bg-slate-700 mx-auto"></div>
                {activeFlow?.nodes.map((node, index) => (
                    <div key={node.id} className="relative group">
                         <div onClick={() => setSelectedNodeId(node.id)} className={`relative p-4 rounded-xl border-2 cursor-pointer ${selectedNodeId === node.id ? 'border-blue-500' : 'border-slate-700'}`}>
                            {/* ... node display unchanged ... */}
                         </div>
                        {index < (activeFlow.nodes.length - 1) && <div className="w-0.5 h-6 bg-slate-700 mx-auto my-1"></div>}
                    </div>
                ))}
            </div>
        </div>

        {/* Properties Panel */}
        {selectedNode && (
            <div className="w-72 bg-slate-800 border-l border-slate-700 p-6 flex flex-col h-full overflow-y-auto">
                {/* ... panel content unchanged ... */}
            </div>
        )}
      </div>
    </div>
  );
};
