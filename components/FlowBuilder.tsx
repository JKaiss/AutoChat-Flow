
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { Flow, FlowNode, NodeType, TriggerType, Account, Platform } from '../types';
import { NODE_TYPES, TRIGGER_TYPES } from '../constants';
import { Plus, Save, Trash2, X, Lock, Sparkles, Loader, Wand2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleGenAI } from "@google/genai";

export const FlowBuilder: React.FC = () => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  // AI State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { user, triggerUpgrade } = useAuth();
  
  useEffect(() => {
    setFlows(db.getFlows());
    setAccounts(db.getAllAccounts());
  }, []);

  const activeFlow = flows.find(f => f.id === activeFlowId);

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

  const createFlow = () => {
    const newFlow: Flow = {
      id: `flow_${Date.now()}`,
      name: 'Untitled Flow',
      triggerType: 'instagram_comment',
      active: true,
      createdAt: Date.now(),
      nodes: []
    };
    db.saveFlow(newFlow);
    setFlows([...flows, newFlow]);
    setActiveFlowId(newFlow.id);
  };

  const updateFlow = (updatedFlow: Flow) => {
    db.saveFlow(updatedFlow);
    setFlows(flows.map(f => f.id === updatedFlow.id ? updatedFlow : f));
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
      nextId: undefined
    };
    const lastNode = activeFlow.nodes[activeFlow.nodes.length - 1];
    if (lastNode && !lastNode.nextId && lastNode.type !== 'condition') {
        lastNode.nextId = newNode.id;
    }
    const updatedNodes = [...activeFlow.nodes, newNode];
    updateFlow({ ...activeFlow, nodes: updatedNodes });
    setSelectedNodeId(newNode.id);
  };

  const deleteNode = (nodeId: string) => {
    if (!activeFlow) return;
    const updatedNodes = activeFlow.nodes.filter(n => n.id !== nodeId);
    updatedNodes.forEach(n => {
        if (n.nextId === nodeId) n.nextId = undefined;
        if (n.falseNextId === nodeId) n.falseNextId = undefined;
    });
    updateFlow({ ...activeFlow, nodes: updatedNodes });
    setSelectedNodeId(null);
  };

  const updateNodeData = (nodeId: string, data: any) => {
    if (!activeFlow) return;
    const updatedNodes = activeFlow.nodes.map(n => 
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
    );
    updateFlow({ ...activeFlow, nodes: updatedNodes });
  };

  // --- AI GENERATION LOGIC ---

  const handleAiClick = () => {
      if (user?.plan === 'free') {
          triggerUpgrade('AI Flow Generation is a Pro Feature');
      } else {
          setShowAiModal(true);
      }
  };

  const generateFlowWithAi = async () => {
      if (!aiPrompt.trim()) return;
      setIsGenerating(true);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          const systemPrompt = `
            You are an expert chatbot automation architect.
            Create a JSON array of nodes based on the user's description.
            
            RULES:
            1. Return ONLY valid JSON. No markdown, no text.
            2. Available Node Types: 'message', 'question', 'delay', 'condition', 'ai_generate'.
            3. Structure per node: { "id": "string", "type": "string", "data": { "content"?: "string", "variable"?: "string", "delayMs"?: number, "conditionVar"?: "string", "conditionValue"?: "string" }, "nextId"?: "string", "falseNextId"?: "string" }
            4. Layout: Calculate "position": { "x": number, "y": number } for each node. Start at x:100, y:100. Space them vertically by 150px.
            5. Ensure nodes are logically connected via 'nextId'.
            6. For 'condition' nodes, use 'nextId' for True and 'falseNextId' for False path.
            
            Example Request: "Ask for email"
            Example Output: [
                { "id": "n1", "type": "question", "position": {"x":100,"y":100}, "data": {"content": "What is your email?", "variable": "email"}, "nextId": "n2" },
                { "id": "n2", "type": "message", "position": {"x":100,"y":250}, "data": {"content": "Thanks!"} }
            ]
          `;

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `User Request: ${aiPrompt}`,
              config: {
                  systemInstruction: systemPrompt,
                  responseMimeType: 'application/json'
              }
          });

          const jsonText = response.text || '[]';
          // Clean potential markdown blocks if the model ignores instruction (rare with json mode but possible)
          const cleanJson = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
          const nodes = JSON.parse(cleanJson);

          const newFlow: Flow = {
              id: `flow_ai_${Date.now()}`,
              name: `AI: ${aiPrompt.slice(0, 20)}...`,
              triggerType: 'instagram_dm',
              active: true,
              createdAt: Date.now(),
              nodes: nodes
          };

          db.saveFlow(newFlow);
          setFlows([...flows, newFlow]);
          setActiveFlowId(newFlow.id);
          setShowAiModal(false);
          setAiPrompt('');

      } catch (e) {
          console.error("AI Gen Failed", e);
          alert("Failed to generate flow. Please try again.");
      } finally {
          setIsGenerating(false);
      }
  };


  // --- VIEW RENDERING ---

  if (!activeFlowId) {
    return (
      <div className="p-8 h-full relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Automation Flows</h2>
          <div className="flex gap-3">
              <button 
                onClick={handleAiClick}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 border border-purple-400/30 shadow-lg shadow-purple-900/20"
              >
                <Sparkles size={18} /> AI Generate
              </button>
              <button onClick={createFlow} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Plus size={18} /> New Flow
              </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map(flow => (
            <div key={flow.id} onClick={() => setActiveFlowId(flow.id)} className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500 cursor-pointer transition-all">
              <h3 className="font-bold text-lg mb-2">{flow.name}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className={`px-2 py-1 rounded text-xs uppercase ${flow.triggerType.includes('whatsapp') ? 'bg-green-900 text-green-300' : flow.triggerType.includes('messenger') ? 'bg-blue-900 text-blue-300' : 'bg-pink-900 text-pink-300'}`}>
                    {flow.triggerType.split('_')[0]}
                </span>
                <span>{flow.nodes.length} nodes</span>
              </div>
            </div>
          ))}
          {flows.length === 0 && <div className="col-span-3 text-center py-20 text-slate-500">No flows yet. Create one to get started.</div>}
        </div>

        {/* AI MODAL */}
        {showAiModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 relative shadow-2xl">
                    <button onClick={() => setShowAiModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X size={20} /></button>
                    
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                        <Wand2 className="text-purple-400" /> AI Flow Generator
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Describe what you want the bot to do, and AI will build the flow structure for you.
                    </p>

                    <textarea 
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="e.g. Create a flow for a clothing store. Greet the user, ask if they want to see 'Men' or 'Women' collections. If they say Men, show a link. If Women, show a link."
                        className="w-full h-32 bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-purple-500 outline-none resize-none mb-4"
                    />

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setShowAiModal(false)}
                            className="text-slate-400 hover:text-white px-4 py-2 text-sm font-bold"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={generateFlowWithAi}
                            disabled={isGenerating || !aiPrompt.trim()}
                            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                        >
                            {isGenerating ? <Loader className="animate-spin" size={16} /> : <Sparkles size={16} />}
                            {isGenerating ? 'Generating...' : 'Generate Flow'}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  const selectedNode = activeFlow?.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-28 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button onClick={() => setActiveFlowId(null)} className="text-slate-400 hover:text-white">← Back</button>
          <div className="w-full">
            <input 
                value={activeFlow?.name} 
                onChange={(e) => activeFlow && updateFlow({ ...activeFlow, name: e.target.value })}
                className="bg-transparent border-none text-white font-bold text-lg focus:ring-0 block w-full p-0 mb-2" 
            />
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-bold">TRIGGER:</span>
                    <select 
                        value={activeFlow?.triggerType}
                        onChange={(e) => activeFlow && updateFlow({ ...activeFlow, triggerType: e.target.value as TriggerType, triggerAccountId: undefined })}
                        className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1 outline-none"
                    >
                        <optgroup label="General"><option value="keyword">Keyword Match</option></optgroup>
                        <optgroup label="Instagram">
                            <option value="instagram_comment">User Comments on Post</option>
                            <option value="instagram_dm">User Sends DM</option>
                            <option value="instagram_story_mention">User Mentions in Story</option>
                        </optgroup>
                        <optgroup label="WhatsApp">
                            <option value="whatsapp_message">User Sends Message</option>
                            <option value="whatsapp_button_reply">Button Reply</option>
                        </optgroup>
                        <optgroup label="Messenger">
                            <option value="messenger_text">User Sends Message</option>
                            <option value="messenger_postback">Button Click (Postback)</option>
                        </optgroup>
                    </select>
                </div>
                
                {filteredAccounts.length > 0 && (
                    <div className="flex items-center gap-2">
                         <span className="text-xs text-slate-500 font-bold">ACCOUNT:</span>
                         <select
                            value={activeFlow?.triggerAccountId || ''}
                            onChange={(e) => activeFlow && updateFlow({ ...activeFlow, triggerAccountId: e.target.value || undefined })}
                            className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1 outline-none"
                         >
                            <option value="">Any {getPlatformFromTrigger(activeFlow!.triggerType)} Account</option>
                            {filteredAccounts.map(acc => (
                                <option key={acc.id} value={acc.externalId}>{acc.name}</option>
                            ))}
                         </select>
                    </div>
                )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Save size={16} /> Saved</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Components Panel */}
        <div className="w-48 bg-slate-800 border-r border-slate-700 p-4 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Components</h4>
            {NODE_TYPES.map(type => (
                <button 
                  key={type.type} 
                  onClick={() => addNode(type.type)} 
                  className="flex items-center justify-between p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors text-left group"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${type.color}`} /> {type.label}
                    </div>
                    {type.type === 'ai_generate' && user?.plan === 'free' && (
                        <Lock size={12} className="text-slate-500" />
                    )}
                </button>
            ))}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-slate-900 overflow-y-auto p-8 relative">
            <div className="max-w-xl mx-auto space-y-4 pb-20">
                <div className="flex justify-center">
                    <div className={`px-4 py-2 rounded-lg text-xs font-bold border flex flex-col items-center ${activeFlow?.triggerType.startsWith('whatsapp') ? 'bg-green-900/50 text-green-200 border-green-700' : activeFlow?.triggerType.startsWith('messenger') ? 'bg-blue-900/50 text-blue-200 border-blue-700' : 'bg-indigo-900/50 text-indigo-200 border-indigo-700'}`}>
                        <span className="text-[10px] uppercase tracking-wider mb-1 opacity-70">TRIGGER</span>
                        {TRIGGER_TYPES.find(t => t.type === activeFlow?.triggerType)?.label || activeFlow?.triggerType}
                        {activeFlow?.triggerAccountId ? (
                            <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded mt-1">
                                🎯 {accounts.find(a => a.externalId === activeFlow.triggerAccountId)?.name || activeFlow.triggerAccountId}
                            </span>
                        ) : (
                            <span className="text-[10px] opacity-50 mt-1">All Accounts</span>
                        )}
                        {activeFlow?.triggerKeyword && <span className="text-white mt-1">"{activeFlow.triggerKeyword}"</span>}
                    </div>
                </div>
                <div className="w-0.5 h-6 bg-slate-700 mx-auto"></div>

                {activeFlow?.nodes.map((node, index) => (
                    <div key={node.id} className="relative group">
                         <div onClick={() => setSelectedNodeId(node.id)} className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all bg-slate-800 ${selectedNodeId === node.id ? 'border-blue-500 shadow-lg shadow-blue-900/20' : 'border-slate-700 hover:border-slate-600'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${NODE_TYPES.find(t => t.type === node.type)?.color}`} />
                                    <span className="font-bold text-sm">{NODE_TYPES.find(t => t.type === node.type)?.label}</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} className="text-slate-600 hover:text-red-500"><Trash2 size={14} /></button>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2">
                                {node.type === 'message' && (node.data.content || 'Empty message')}
                                {node.type === 'question' && `Ask: ${node.data.content}`}
                                {node.type === 'delay' && `Wait ${node.data.delayMs}ms`}
                                {node.type === 'condition' && `If ${node.data.conditionVar} == ${node.data.conditionValue}`}
                                {node.type === 'ai_generate' && `Prompt: ${node.data.aiPrompt}`}
                            </p>
                        </div>
                        {index < (activeFlow.nodes.length - 1) && <div className="w-0.5 h-6 bg-slate-700 mx-auto my-1"></div>}
                    </div>
                ))}
            </div>
        </div>

        {/* Properties Panel */}
        {selectedNode && (
            <div className="w-72 bg-slate-800 border-l border-slate-700 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold">Edit Node</h3>
                    <button onClick={() => setSelectedNodeId(null)}><X size={16} /></button>
                </div>
                <div className="space-y-4">
                    {(selectedNode.type === 'message' || selectedNode.type === 'question' || selectedNode.type === 'ai_generate') && (
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 mb-2">
                            <label className="block text-xs font-bold text-slate-400 mb-2">Send From (Optional)</label>
                            <select
                                value={selectedNode.data.accountId || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { accountId: e.target.value || undefined })}
                                className="w-full bg-slate-800 border border-slate-600 text-xs text-white rounded p-2 outline-none"
                            >
                                <option value="">Auto-detect (Same as trigger)</option>
                                {filteredAccounts.map(acc => (
                                    <option key={acc.id} value={acc.externalId}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    {selectedNode.type === 'message' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2">Message Text</label>
                            <textarea
                                value={selectedNode.data.content || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { content: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm min-h-[100px] focus:border-blue-500 outline-none text-white"
                                placeholder="Enter message..."
                            />
                        </div>
                    )}

                    {selectedNode.type === 'question' && (
                         <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Question Text</label>
                                <textarea
                                    value={selectedNode.data.content || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { content: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none text-white"
                                    placeholder="What is your email?"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Save Answer To Variable</label>
                                <input
                                    value={selectedNode.data.variable || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { variable: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    placeholder="email"
                                />
                            </div>
                         </div>
                    )}

                    {selectedNode.type === 'delay' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2">Delay (Milliseconds)</label>
                            <input
                                type="number"
                                value={selectedNode.data.delayMs || 1000}
                                onChange={(e) => updateNodeData(selectedNode.id, { delayMs: parseInt(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                            />
                        </div>
                    )}

                    {selectedNode.type === 'condition' && (
                        <div className="space-y-4">
                            <div className="bg-yellow-900/20 p-3 rounded border border-yellow-700/50 text-xs text-yellow-200">
                                Checks if a user variable matches a value.
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Variable Name</label>
                                <input
                                    value={selectedNode.data.conditionVar || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { conditionVar: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    placeholder="email"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Value to Match</label>
                                <input
                                    value={selectedNode.data.conditionValue || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { conditionValue: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                                    placeholder="yes"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
