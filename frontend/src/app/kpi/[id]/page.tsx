'use client';

import { useEffect, useState, use } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { kpiApi, minesApi } from '@/services/api';
import type { Mine, KPIDefinition, KPIReading } from '@/types';
import { ArrowLeft, TrendingUp, TrendingDown, Target } from 'lucide-react';
import Link from 'next/link';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';

export default function KPIDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const kpiName = decodeURIComponent(resolvedParams.id);
  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);
  const [mines, setMines] = useState<Mine[]>([]);
  const [selectedMine, setSelectedMine] = useState('');
  const [history, setHistory] = useState<{ value: number; timestamp: string }[]>([]);
  const [forecast, setForecast] = useState<{ value: number; timestamp: string }[]>([]);
  const [rollingAvg, setRollingAvg] = useState<number>(0);

  useEffect(() => {
    kpiApi.definitions().then((r) => setDefinitions(r.data)).catch(() => {});
    minesApi.list().then((r) => {
      setMines(r.data);
      if (r.data.length > 0) setSelectedMine(r.data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedMine || !kpiName) return;
    kpiApi.history(selectedMine, kpiName).then((r) => {
      const d = r.data;
      setHistory(d.data || []);
      setForecast(d.forecast || []);
      setRollingAvg(d.rolling_avg || 0);
    }).catch(() => {});
    const interval = setInterval(() => {
      kpiApi.history(selectedMine, kpiName).then((r) => {
        const d = r.data;
        setHistory(d.data || []);
        setForecast(d.forecast || []);
        setRollingAvg(d.rolling_avg || 0);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedMine, kpiName]);

  const def = definitions.find((d) => d.name === kpiName);
  const chartData = history.slice(-60).map((h, i) => ({
    i,
    value: h.value,
    time: new Date(h.timestamp).toLocaleTimeString(),
  }));
  const forecastData = forecast.map((f, i) => ({
    i: chartData.length + i,
    value: f.value,
    time: `F+${i + 1}`,
  }));
  const lastValue = history.length > 0 ? history[history.length - 1].value : 0;
  const prevValue = history.length > 1 ? history[history.length - 2].value : lastValue;
  const delta = lastValue - prevValue;
  const lastReading = history.length > 0 ? history[history.length - 1] : null;
  const status = (lastReading as any)?.status || 'green';

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">{kpiName}</h1>
              <p className="text-sm text-slate-500">{def?.description || 'KPI Details'}</p>
            </div>
          </div>
          <select value={selectedMine} onChange={(e) => setSelectedMine(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0c1228] border border-[#1e2d52] text-sm text-slate-300 focus:outline-none">
            {mines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {/* Current Value + Thresholds */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className={`glass-card p-5 lg:col-span-1 ${status === 'green' ? 'glow-green' : status === 'amber' ? 'glow-amber' : 'glow-red'}`}>
            <p className="text-xs text-slate-500 mb-2">Current Value</p>
            <p className={`text-4xl font-bold ${status === 'green' ? 'text-green-400' : status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>
              {lastValue.toFixed(2)}
            </p>
            <p className="text-xs text-slate-600 mt-1">{def?.unit || ''}</p>
            <div className="flex items-center mt-2 gap-1">
              {delta >= 0 ? <TrendingUp className="w-3 h-3 text-green-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
              <span className={`text-[10px] ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
              </span>
            </div>
          </div>
          {def && (
            <>
              <div className="glass-card p-4 border-green-500/20">
                <p className="text-xs text-slate-500 mb-1">Green (Target)</p>
                <p className="text-lg font-bold text-green-400">{def.green_threshold}</p>
                <p className="text-[10px] text-slate-600">{def.unit}</p>
              </div>
              <div className="glass-card p-4 border-amber-500/20">
                <p className="text-xs text-slate-500 mb-1">Amber (Warning)</p>
                <p className="text-lg font-bold text-amber-400">{def.amber_threshold}</p>
                <p className="text-[10px] text-slate-600">{def.unit}</p>
              </div>
              <div className="glass-card p-4 border-red-500/20">
                <p className="text-xs text-slate-500 mb-1">Red (Critical)</p>
                <p className="text-lg font-bold text-red-400">{def.red_threshold}</p>
                <p className="text-[10px] text-slate-600">{def.unit}</p>
              </div>
            </>
          )}
        </div>

        {/* Time Series */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Historical Trend</h3>
            <div className="flex items-center gap-2">
              <Target className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-500">Rolling Avg: {rollingAvg.toFixed(2)}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="kpiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={status === 'green' ? '#22c55e' : status === 'amber' ? '#f59e0b' : '#ef4444'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={status === 'green' ? '#22c55e' : status === 'amber' ? '#f59e0b' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
              <XAxis dataKey="i" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              {rollingAvg > 0 && (
                <ReferenceLine y={rollingAvg} stroke="#8b5cf6" strokeDasharray="5 5" strokeOpacity={0.5} label={{ value: 'Avg', fill: '#8b5cf6', fontSize: 10 }} />
              )}
              <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="value" stroke={status === 'green' ? '#22c55e' : status === 'amber' ? '#f59e0b' : '#ef4444'}
                fill="url(#kpiGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Forecast */}
        {forecastData.length > 0 && (
          <div className="glass-card p-5 border-purple-500/20">
            <h3 className="text-sm font-semibold text-white mb-4">AI Forecast (Next {forecastData.length} Points)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={[...chartData.slice(-20), ...forecastData]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                <XAxis dataKey="i" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
