import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Flow, Subscriber } from '../types';
import { Users, Zap, MessageCircle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
// FIX: Import axios to fetch data from the API.
import axios from 'axios';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    flowsCount: 0,
    subscribersCount: 0,
    interactions: 0,
  });

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // FIX: Replaced non-existent db.getFlows() with an API call to the backend to get real flow data.
    const subs = db.getSubscribers();
    const logs = db.getLogs();

    axios.get('/api/flows')
      .then(res => {
        const flows: Flow[] = res.data || [];
        setStats({
          flowsCount: flows.length,
          subscribersCount: subs.length,
          interactions: logs.length
        });
      })
      .catch(err => {
        console.error("Dashboard: Failed to fetch flows", err);
        setStats({
          flowsCount: 0, // Fallback
          subscribersCount: subs.length,
          interactions: logs.length
        });
      });


    // Mock chart data based on logs or random for MVP visuals
    const data = [
      { name: 'Mon', events: 12 },
      { name: 'Tue', events: 19 },
      { name: 'Wed', events: 3 },
      { name: 'Thu', events: 5 },
      { name: 'Fri', events: 2 },
      { name: 'Sat', events: 30 },
      { name: 'Sun', events: 45 },
    ];
    setChartData(data);

  }, []);

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color} bg-opacity-20`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-900 px-2 py-1 rounded">+12%</span>
      </div>
      <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
      <p className="text-slate-400 text-sm">{label}</p>
    </div>
  );

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white">Overview</h2>
        <p className="text-slate-400">Welcome back! Here is what's happening.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard icon={Zap} label="Active Flows" value={stats.flowsCount} color="bg-blue-500" />
        <StatCard icon={Users} label="Subscribers" value={stats.subscribersCount} color="bg-purple-500" />
        <StatCard icon={MessageCircle} label="Total Interactions" value={stats.interactions} color="bg-emerald-500" />
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 h-96">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 size={20} /> Activity Volume
          </h3>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
              cursor={{ fill: '#334155', opacity: 0.2 }}
            />
            <Bar dataKey="events" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};