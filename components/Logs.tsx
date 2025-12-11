import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { ExecutionLog } from '../types';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

export const Logs: React.FC = () => {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);

  const fetchLogs = () => {
    setLogs(db.getLogs());
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">System Logs</h2>
        <button onClick={fetchLogs} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm">
            <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-y-auto flex-1">
            <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-900 text-slate-300 uppercase text-xs font-bold sticky top-0">
                    <tr>
                        <th className="p-4">Status</th>
                        <th className="p-4">Time</th>
                        <th className="p-4">Flow ID</th>
                        <th className="p-4">Node ID</th>
                        <th className="p-4">User</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {logs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-700/50">
                            <td className="p-4">
                                {log.status === 'success' && <span className="flex items-center gap-2 text-emerald-400"><CheckCircle size={14} /> Success</span>}
                                {log.status === 'failed' && <span className="flex items-center gap-2 text-red-400"><XCircle size={14} /> Failed</span>}
                                {log.status === 'pending' && <span className="flex items-center gap-2 text-yellow-400"><Clock size={14} /> Pending</span>}
                            </td>
                            <td className="p-4 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                            <td className="p-4 font-mono text-xs">{log.flowId}</td>
                            <td className="p-4 font-mono text-xs">{log.nodeId}</td>
                            <td className="p-4">{log.subscriberId}</td>
                        </tr>
                    ))}
                    {logs.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500">No logs generated yet. Run a flow in the Simulator.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};
