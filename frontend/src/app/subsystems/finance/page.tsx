'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { subsystemsApi, minesApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import type { Mine, FinanceData } from '@/types';
import { DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function FinancePage() {
  const { user } = useAuthStore();
  const [mines, setMines] = useState<Mine[]>([]);
  const [finData, setFinData] = useState<FinanceData[]>([]);
  const [selectedMine, setSelectedMine] = useState('');
  const [timeFilter, setTimeFilter] = useState('24H');
  const TIME_FILTERS = ['1H', '6H', '24H', '7D', '30D'];

  useEffect(() => {
    minesApi.list().then((r) => {
      setMines(r.data);
      if (r.data.length > 0) setSelectedMine(user?.assigned_mine_id || r.data[0].id);
    }).catch(() => {});
    subsystemsApi.finance().then((r) => setFinData(r.data)).catch(() => {});
    const interval = setInterval(() => {
      subsystemsApi.finance().then((r) => setFinData(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const current = finData.find((f) => f.mine_id === selectedMine);
  const costBreakdown = current ? [
    { name: 'Fuel', value: current.fuel_cost, color: '#7c3aed' },
    { name: 'Maintenance', value: current.maintenance_cost, color: '#8b5cf6' },
    { name: 'Labor', value: current.labor_cost, color: '#a78bfa' },
  ] : [];

  const chartData = finData.map((f) => ({
    name: mines.find(m => m.id === f.mine_id)?.name?.replace(' Open Cast Mine', '').replace(' Mine', '') || f.mine_id,
    cpt: f.cost_per_tonne,
    revenue: f.revenue_daily / 100000,
    ebitda: f.ebitda_margin,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-amber-400" /> Finance
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Cost analysis, revenue, and EBITDA tracking</p>
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
                { label: 'Cost Per Tonne', value: `₹${current.cost_per_tonne.toFixed(2)}`, status: current.cost_per_tonne < 800 ? 'green' : current.cost_per_tonne < 1200 ? 'amber' : 'red' },
                { label: 'Daily Revenue', value: `₹${(current.revenue_daily / 100000).toFixed(2)}L`, status: 'green' },
                { label: 'EBITDA Margin', value: `${current.ebitda_margin.toFixed(2)}%`, status: current.ebitda_margin > 20 ? 'green' : current.ebitda_margin > 10 ? 'amber' : 'red' },
              ].map((kpi) => (
                <div key={kpi.label} className={`glass-card p-4 ${kpi.status === 'green' ? 'glow-green' : kpi.status === 'amber' ? 'glow-amber' : 'glow-red'}`}>
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.status === 'green' ? 'text-green-400' : kpi.status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Cost Breakdown</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {costBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v: number) => `₹${(v / 1000).toFixed(2)}K`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4">
                  {costBreakdown.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-[10px] text-slate-500">{d.name}: ₹{(d.value / 1000).toFixed(2)}K</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Cost Per Tonne — All Mines</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} margin={{ bottom: 22, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Mine', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: '\u20b9/Tonne', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="cpt" fill="#8b5cf6" name="\u20b9/Tonne" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-5 border-purple-500/20">
              <h3 className="text-sm font-semibold text-white mb-3">Finance Scenarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: 'Fuel Cost Spike', desc: 'Operating cost per tonne increases, optimize haul routes', icon: '⛽' },
                  { title: 'Low Production', desc: 'Revenue drops below target, investigate equipment issues', icon: '📉' },
                  { title: 'Maintenance Surge', desc: 'Unplanned maintenance impacting EBITDA margins', icon: '🔧' },
                ].map((s) => (
                  <div key={s.title} className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
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
