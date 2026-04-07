'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { kpiApi, equipmentApi, minesApi } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuthStore } from '@/store/authStore';
import type { Mine, Equipment, KPIReading } from '@/types';
import { Box, Wrench, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

export default function MiningOpsPage() {
  const { user } = useAuthStore();
  const [mines, setMines] = useState<Mine[]>([]);
  const [kpis, setKpis] = useState<Record<string, Record<string, KPIReading>>>({});
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedMine, setSelectedMine] = useState<string>('');
  const [prodHistory, setProdHistory] = useState<any[]>([]);
  const [timeFilter, setTimeFilter] = useState('24H');
  const TIME_FILTERS = ['1H', '6H', '24H', '7D', '30D'];

  useEffect(() => {
    minesApi.list().then((r) => {
      setMines(r.data);
      if (r.data.length > 0) {
        const defaultMine = user?.assigned_mine_id || r.data[0].id;
        setSelectedMine(defaultMine);
      }
    }).catch(() => {});
    kpiApi.current().then((r) => {
      if (!r.data.aggregated) setKpis(r.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedMine) return;
    equipmentApi.list(selectedMine).then((r) => setEquipment(r.data)).catch(() => {});
    kpiApi.history(selectedMine, 'Production Rate').then((r) => {
      setProdHistory(r.data.data?.slice(-50).map((d: any, i: number) => ({
        i, value: d.value, time: new Date(d.timestamp).toLocaleTimeString()
      })) || []);
    }).catch(() => {});
  }, [selectedMine]);

  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'kpi_update') {
      setKpis((prev) => ({ ...prev, [data.mine_id]: data.data }));
    }
  }, []);
  useWebSocket(handleWsMessage);

  const mk = kpis[selectedMine] || {};
  const miningKpis = [
    { name: 'Production Rate', ...mk['Production Rate'] },
    { name: 'Equipment Utilization', ...mk['Equipment Utilization'] },
    { name: 'Downtime', ...mk['Downtime'] },
    { name: 'Stripping Ratio', ...mk['Stripping Ratio'] },
  ].filter(k => k.value !== undefined);

  const eqByType = equipment.reduce((acc, eq) => {
    acc[eq.type] = acc[eq.type] || [];
    acc[eq.type].push(eq);
    return acc;
  }, {} as Record<string, Equipment[]>);

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Box className="w-6 h-6 text-amber-400" />
              Mining Operations
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Production, equipment utilization, and operational KPIs</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#0a1025] rounded-lg border border-[#1e2d52] p-0.5">
              {TIME_FILTERS.map(tf => (
                <button key={tf} onClick={() => setTimeFilter(tf)} className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${timeFilter === tf ? 'bg-amber-500/20 text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>{tf}</button>
              ))}
            </div>
            <select
              value={selectedMine}
              onChange={(e) => setSelectedMine(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#0c1228] border border-[#1e2d52] text-sm text-slate-300 focus:outline-none focus:border-amber-500/50"
            >
            {mines.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {miningKpis.map((kpi) => (
            <div key={kpi.name} className={`glass-card p-4 ${
              kpi.status === 'green' ? 'glow-green' : kpi.status === 'amber' ? 'glow-amber' : 'glow-red'
            }`}>
              <p className="text-xs text-slate-500 mb-1">{kpi.name}</p>
              <p className={`text-2xl font-bold ${
                kpi.status === 'green' ? 'text-green-400' : kpi.status === 'amber' ? 'text-amber-400' : 'text-red-400'
              }`}>
                {typeof kpi.value === 'number' ? kpi.value.toFixed(2) : kpi.value}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">{kpi.unit}</p>
            </div>
          ))}
        </div>

        {/* Production Trend */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Production Rate Trend (TPH)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={prodHistory} margin={{ bottom: 22, left: 12 }}>
              <defs>
                <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
              <XAxis dataKey="i" tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'Sample', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} label={{ value: 'TPH', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="url(#prodGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Equipment by Type */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Equipment by Type</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(eqByType).map(([type, eqs]) => {
              const running = eqs.filter(e => e.status === 'running').length;
              const avgUtil = eqs.reduce((s, e) => s + e.utilization, 0) / eqs.length;
              return (
                <div key={type} className="p-4 rounded-lg bg-white/3 border border-[#1e2d52]">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-slate-300 capitalize">{type.replace('_', ' ')}</h4>
                    <span className="text-[10px] text-slate-600">{running}/{eqs.length} running</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full ${avgUtil > 85 ? 'bg-green-500' : avgUtil > 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${avgUtil}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Avg Utilization: {avgUtil.toFixed(2)}%</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {eqs.map((eq) => (
                      <span key={eq.id} className={`text-[9px] px-1.5 py-0.5 rounded ${
                        eq.status === 'running' ? 'bg-green-500/10 text-green-400' :
                        eq.status === 'breakdown' ? 'bg-red-500/10 text-red-400' :
                        eq.status === 'maintenance' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                        {eq.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scenarios */}
        <div className="glass-card p-5 border-purple-500/20">
          <h3 className="text-sm font-semibold text-white mb-3">Operational Scenarios</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: 'Excavator Failure', desc: 'Production drops → AI suggests maintenance', icon: '⚠️', color: 'red' },
              { title: 'Overburden Delay', desc: 'Stripping ratio increases → cost impact', icon: '📊', color: 'amber' },
              { title: 'High Utilization', desc: 'Equipment wear risk increases', icon: '🔧', color: 'blue' },
            ].map((s) => (
              <div key={s.title} className={`p-3 rounded-lg border ${
                s.color === 'red' ? 'border-red-500/20 bg-red-500/5' :
                s.color === 'amber' ? 'border-amber-500/20 bg-amber-500/5' :
                'border-blue-500/20 bg-blue-500/5'
              }`}>
                <p className="text-xs font-medium text-slate-300">{s.icon} {s.title}</p>
                <p className="text-[10px] text-slate-500 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
