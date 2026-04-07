'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { subsystemsApi, minesApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import type { Mine, EHSData } from '@/types';
import { ShieldAlert } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function EHSPage() {
  const { user } = useAuthStore();
  const [mines, setMines] = useState<Mine[]>([]);
  const [ehsData, setEhsData] = useState<EHSData[]>([]);
  const [selectedMine, setSelectedMine] = useState('');
  const [timeFilter, setTimeFilter] = useState('24H');
  const TIME_FILTERS = ['1H', '6H', '24H', '7D', '30D'];

  useEffect(() => {
    minesApi.list().then((r) => {
      setMines(r.data);
      if (r.data.length > 0) setSelectedMine(user?.assigned_mine_id || r.data[0].id);
    }).catch(() => {});
    subsystemsApi.ehs().then((r) => setEhsData(r.data)).catch(() => {});
    const interval = setInterval(() => {
      subsystemsApi.ehs().then((r) => setEhsData(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const current = ehsData.find((e) => e.mine_id === selectedMine);
  const chartData = ehsData.map((e) => ({
    name: mines.find(m => m.id === e.mine_id)?.name?.replace(' Open Cast Mine', '').replace(' Mine', '') || e.mine_id,
    safety: e.safety_score,
    incidents: e.incident_rate * 20,
    nearMisses: e.near_misses * 10,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-400" /> EHS / Safety
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Environment, Health, and Safety monitoring</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#0a1025] rounded-lg border border-[#1e2d52] p-0.5">
              {TIME_FILTERS.map(tf => (
                <button key={tf} onClick={() => setTimeFilter(tf)} className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${timeFilter === tf ? 'bg-amber-500/20 text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>{tf}</button>
              ))}
            </div>
            <select value={selectedMine} onChange={(e) => setSelectedMine(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#0c1228] border border-[#1e2d52] text-sm text-slate-300 focus:outline-none">
              {mines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        {current && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Safety Score', value: current.safety_score.toFixed(2), status: current.safety_score > 85 ? 'green' : current.safety_score > 70 ? 'amber' : 'red' },
                { label: 'Incident Rate', value: current.incident_rate.toFixed(2), status: current.incident_rate < 1 ? 'green' : current.incident_rate < 2 ? 'amber' : 'red' },
                { label: 'Near Misses', value: `${current.near_misses}`, status: current.near_misses < 3 ? 'green' : current.near_misses < 5 ? 'amber' : 'red' },
                { label: 'Hazard Alerts', value: `${current.hazard_alerts}`, status: current.hazard_alerts < 2 ? 'green' : current.hazard_alerts < 4 ? 'amber' : 'red' },
                { label: 'Days Since Incident', value: `${current.last_incident_days}`, status: current.last_incident_days > 14 ? 'green' : current.last_incident_days > 7 ? 'amber' : 'red' },
                { label: 'Open Investigations', value: `${current.open_investigations}`, status: current.open_investigations < 2 ? 'green' : 'amber' },
              ].map((kpi) => (
                <div key={kpi.label} className={`glass-card p-4 ${kpi.status === 'green' ? 'glow-green' : kpi.status === 'amber' ? 'glow-amber' : 'glow-red'}`}>
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.status === 'green' ? 'text-green-400' : kpi.status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Safety Overview — All Mines</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ bottom: 22, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Mine', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} label={{ value: 'Score / Rate', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="safety" fill="#8b5cf6" name="Safety Score" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="incidents" fill="#a78bfa" name="Incident Rate (\u00d720)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5 border-red-500/20">
              <h3 className="text-sm font-semibold text-white mb-3">EHS Scenarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: 'Gas Leak Detected', desc: 'Evacuate zone, activate ventilation systems', icon: '🔴' },
                  { title: 'Equipment Collision', desc: 'Incident reported, launch investigation', icon: '🟠' },
                  { title: 'Unsafe Zone Entry', desc: 'Warning issued, reinforce perimeter controls', icon: '⚠️' },
                ].map((s) => (
                  <div key={s.title} className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                    <p className="text-xs font-medium text-slate-300">{s.icon} {s.title}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
