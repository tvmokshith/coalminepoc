'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { subsystemsApi, minesApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import type { Mine, HRData } from '@/types';
import { Users, AlertTriangle, Clock, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function HRPage() {
  const { user } = useAuthStore();
  const [mines, setMines] = useState<Mine[]>([]);
  const [hrData, setHrData] = useState<HRData[]>([]);
  const [selectedMine, setSelectedMine] = useState('');
  const [timeFilter, setTimeFilter] = useState('24H');
  const TIME_FILTERS = ['1H', '6H', '24H', '7D', '30D'];

  useEffect(() => {
    minesApi.list().then((r) => {
      setMines(r.data);
      if (r.data.length > 0) setSelectedMine(user?.assigned_mine_id || r.data[0].id);
    }).catch(() => {});
    subsystemsApi.hr().then((r) => setHrData(r.data)).catch(() => {});
    const interval = setInterval(() => {
      subsystemsApi.hr().then((r) => setHrData(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const current = hrData.find((h) => h.mine_id === selectedMine);
  const chartData = hrData.map((h) => ({
    name: mines.find(m => m.id === h.mine_id)?.name?.replace(' Open Cast Mine', '').replace(' Mine', '') || h.mine_id,
    attendance: h.attendance_pct,
    productivity: h.productivity_index * 100,
    training: h.safety_training_pct,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-400" /> HR & Workforce
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Attendance, productivity, and safety training</p>
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
                { label: 'Total Workforce', value: current.total_workforce, unit: '', status: 'green' },
                { label: 'Attendance', value: `${current.attendance_pct.toFixed(2)}%`, unit: '', status: current.attendance_pct > 92 ? 'green' : current.attendance_pct > 80 ? 'amber' : 'red' },
                { label: 'Productivity Index', value: current.productivity_index.toFixed(2), unit: '', status: current.productivity_index > 0.85 ? 'green' : current.productivity_index > 0.7 ? 'amber' : 'red' },
                { label: 'Safety Training', value: `${current.safety_training_pct.toFixed(2)}%`, unit: '', status: current.safety_training_pct > 80 ? 'green' : 'amber' },
                { label: 'Overtime Hours', value: `${current.overtime_hours.toFixed(2)}h`, unit: '', status: current.overtime_hours < 10 ? 'green' : current.overtime_hours < 20 ? 'amber' : 'red' },
                { label: 'Fatigue Risk', value: current.fatigue_risk.toUpperCase(), unit: '', status: current.fatigue_risk === 'low' ? 'green' : current.fatigue_risk === 'medium' ? 'amber' : 'red' },
              ].map((kpi) => (
                <div key={kpi.label} className={`glass-card p-4 ${kpi.status === 'green' ? 'glow-green' : kpi.status === 'amber' ? 'glow-amber' : 'glow-red'}`}>
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.status === 'green' ? 'text-green-400' : kpi.status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Cross-Mine HR Metrics</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ bottom: 22, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Mine', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="attendance" fill="#8b5cf6" name="Attendance %" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="productivity" fill="#a78bfa" name="Productivity (\u00d7100)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="training" fill="#7c3aed" name="Training %" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5 border-purple-500/20">
              <h3 className="text-sm font-semibold text-white mb-3">HR Scenarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: 'Low Attendance', desc: 'Productivity drops, backup crew activation needed', icon: '📉' },
                  { title: 'Overtime Alert', desc: 'Fatigue risk high, adjust shift patterns', icon: '⚠️' },
                  { title: 'Skill Gap', desc: 'Equipment efficiency loss, schedule refresher training', icon: '📚' },
                ].map((s) => (
                  <div key={s.title} className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
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
