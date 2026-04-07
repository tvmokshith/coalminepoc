'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { subsystemsApi, minesApi, kpiApi } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/store/authStore';
import type { Mine, LogisticsData, KPIReading } from '@/types';
import { Truck, Train, Package } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, Legend
} from 'recharts';

export default function LogisticsPage() {
  const { user } = useAuthStore();
  const [mines, setMines] = useState<Mine[]>([]);
  const [logistics, setLogistics] = useState<LogisticsData[]>([]);
  const [selectedMine, setSelectedMine] = useState('');
  const [timeFilter, setTimeFilter] = useState('24H');
  const TIME_FILTERS = ['1H', '6H', '24H', '7D', '30D'];

  useEffect(() => {
    minesApi.list().then((r) => {
      setMines(r.data);
      if (r.data.length > 0) setSelectedMine(user?.assigned_mine_id || r.data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    subsystemsApi.logistics().then((r) => setLogistics(r.data)).catch(() => {});
  }, []);

  const handleWsMessage = useCallback(() => {
    subsystemsApi.logistics().then((r) => setLogistics(r.data)).catch(() => {});
  }, []);
  useWebSocket(handleWsMessage);

  const current = logistics.find((l) => l.mine_id === selectedMine);
  const chartData = logistics.map((l) => ({
    name: mines.find(m => m.id === l.mine_id)?.name?.replace(' Open Cast Mine', '').replace(' Mine', '') || l.mine_id,
    dispatch: l.dispatch_efficiency,
    wagon: l.wagon_availability,
    stockpile: l.stockpile_level_pct,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-amber-400" /> Logistics
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Dispatch, transport, and stockpile management</p>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Dispatch Efficiency', value: `${current.dispatch_efficiency.toFixed(2)}%`, status: current.dispatch_efficiency > 90 ? 'green' : current.dispatch_efficiency > 75 ? 'amber' : 'red' },
                { label: 'Wagon Availability', value: `${current.wagon_availability.toFixed(2)}%`, status: current.wagon_availability > 85 ? 'green' : current.wagon_availability > 70 ? 'amber' : 'red' },
                { label: 'Turnaround Time', value: `${current.turnaround_time_hrs.toFixed(2)}h`, status: current.turnaround_time_hrs < 4 ? 'green' : current.turnaround_time_hrs < 6 ? 'amber' : 'red' },
                { label: 'Trucks Active', value: `${current.trucks_active}/${current.trucks_total}`, status: current.trucks_active >= current.trucks_total - 1 ? 'green' : 'amber' },
              ].map((kpi) => (
                <div key={kpi.label} className={`glass-card p-4 ${kpi.status === 'green' ? 'glow-green' : kpi.status === 'amber' ? 'glow-amber' : 'glow-red'}`}>
                  <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.status === 'green' ? 'text-green-400' : kpi.status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Stockpile Level</h3>
                <div className="flex items-center justify-center py-6">
                  <div className="relative w-40 h-40">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#1e2d52" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none"
                        stroke={current.stockpile_level_pct > 80 ? '#ef4444' : current.stockpile_level_pct > 50 ? '#f59e0b' : '#22c55e'}
                        strokeWidth="8" strokeDasharray={`${current.stockpile_level_pct * 2.64} 264`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-white">{current.stockpile_level_pct.toFixed(2)}%</span>
                      <span className="text-[10px] text-slate-500">Capacity</span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <span className={`text-[10px] px-2 py-1 rounded-full ${
                    current.rail_status === 'operational' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>Rail: {current.rail_status}</span>
                </div>
              </div>

              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Cross-Mine Comparison</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} margin={{ bottom: 22, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Mine', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: '%', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="dispatch" fill="#8b5cf6" name="Dispatch %" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="wagon" fill="#a78bfa" name="Wagon %" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-5 border-purple-500/20">
              <h3 className="text-sm font-semibold text-white mb-3">Logistics Scenarios</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: 'Rail Delay', desc: 'Stockpile overflow risk, switch to road transport', icon: '🚂' },
                  { title: 'Truck Shortage', desc: 'Dispatch efficiency drops, hire contract vehicles', icon: '🚚' },
                  { title: 'Weather Impact', desc: 'Route delays due to monsoon, activate alternate routes', icon: '🌧️' },
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
