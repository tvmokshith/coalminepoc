'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { subsystemsApi, minesApi } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import type { Mine, ESGData } from '@/types';
import { Leaf } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function ESGPage() {
  const { user } = useAuthStore();
  const [mines, setMines] = useState<Mine[]>([]);
  const [esgData, setEsgData] = useState<ESGData[]>([]);
  const [selectedMine, setSelectedMine] = useState('');
  const [timeFilter, setTimeFilter] = useState('24H');
  const TIME_FILTERS = ['1H', '6H', '24H', '7D', '30D'];

  useEffect(() => {
    minesApi.list().then((r) => {
      setMines(r.data);
      if (r.data.length > 0) setSelectedMine(user?.assigned_mine_id || r.data[0].id);
    }).catch(() => {});
    subsystemsApi.esg().then((r) => setEsgData(r.data)).catch(() => {});
    const interval = setInterval(() => {
      subsystemsApi.esg().then((r) => setEsgData(r.data)).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const current = esgData.find((e) => e.mine_id === selectedMine);
  const chartData = esgData.map((e) => ({
    name: mines.find(m => m.id === e.mine_id)?.name?.replace(' Open Cast Mine', '').replace(' Mine', '') || e.mine_id,
    emissions: e.co2_emissions_tpd,
    water: e.water_usage_kl / 10,
    compliance: e.compliance_score,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Leaf className="w-6 h-6 text-green-400" /> ESG Compliance
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Environmental, Social, and Governance metrics</p>
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
                { label: 'CO₂ Emissions', value: `${current.co2_emissions_tpd.toFixed(2)} TPD`, status: current.co2_emissions_tpd < 150 ? 'green' : current.co2_emissions_tpd < 250 ? 'amber' : 'red' },
                { label: 'Water Usage', value: `${current.water_usage_kl.toFixed(2)} KL`, status: current.water_usage_kl < 1000 ? 'green' : current.water_usage_kl < 1800 ? 'amber' : 'red' },
                { label: 'Land Reclaimed', value: `${current.land_reclaimed_ha.toFixed(2)} Ha`, status: 'green' },
                { label: 'Dust Level', value: `${current.dust_level_ugm3.toFixed(2)} µg/m³`, status: current.dust_level_ugm3 < 100 ? 'green' : current.dust_level_ugm3 < 150 ? 'amber' : 'red' },
                { label: 'Noise Level', value: `${current.noise_level_db.toFixed(2)} dB`, status: current.noise_level_db < 75 ? 'green' : current.noise_level_db < 85 ? 'amber' : 'red' },
                { label: 'Compliance Score', value: `${current.compliance_score.toFixed(2)}`, status: current.compliance_score > 85 ? 'green' : current.compliance_score > 70 ? 'amber' : 'red' },
              ].map((kpi) => (
                <div key={kpi.label} className={`glass-card p-4 ${kpi.status === 'green' ? 'glow-green' : kpi.status === 'amber' ? 'glow-amber' : 'glow-red'}`}>
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.status === 'green' ? 'text-green-400' : kpi.status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">ESG Metrics — All Mines</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ bottom: 22, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Mine', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Value', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Bar dataKey="emissions" fill="#8b5cf6" name="CO\u2082 (TPD)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="compliance" fill="#a78bfa" name="Compliance Score" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5 border-green-500/20">
              <h3 className="text-sm font-semibold text-white mb-3">ESG Scenarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: 'High Emissions', desc: 'Compliance risk, accelerate fleet modernization', icon: '🏭' },
                  { title: 'Water Shortage', desc: 'Operations impacted, activate recycling systems', icon: '💧' },
                  { title: 'Reclamation Delay', desc: 'ESG penalty risk, deploy additional reclamation crews', icon: '🌱' },
                ].map((s) => (
                  <div key={s.title} className="p-3 rounded-lg border border-green-500/20 bg-green-500/5">
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
