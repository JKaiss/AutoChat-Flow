
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Zap } from 'lucide-react';

export const UsageBar: React.FC = () => {
  const { usage, user } = useAuth();
  
  if (!user) return null;

  const percent = Math.min((usage.transactions / usage.limit) * 100, 100);
  let color = 'bg-blue-500';
  if (percent > 75) color = 'bg-yellow-500';
  if (percent >= 100) color = 'bg-red-500';

  return (
    <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
            <Zap size={12} /> Monthly Usage
        </span>
        <span className={`text-xs font-bold ${percent >= 100 ? 'text-red-400' : 'text-slate-300'}`}>
            {usage.transactions} / {usage.limit}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
            className={`h-full ${color} transition-all duration-500 ease-out`} 
            style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= 100 && (
          <p className="text-[10px] text-red-400 mt-2 font-medium">Limit reached. Upgrade to continue.</p>
      )}
    </div>
  );
};
