'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import DashboardLayout from '@/components/layout/DashboardLayout';
import KPIDetailModal from '@/components/modals/KPIDetailModal';
import { kpiApi, minesApi, alertsApi, advisoryApi } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Mine, KPIReading, Alert, Advisory, KPIDefinition } from '@/types';
import {
  TrendingUp, TrendingDown, Activity, AlertTriangle, Mountain,
  Truck, Users, DollarSign, Leaf, ShieldAlert, ArrowRight, Zap,
  BarChart3, Timer, Gauge, Hammer, Train, HardHat, Factory,
  Wind, Brain, ChevronRight, RefreshCw, Layers, Eye
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ReferenceLine, Legend
} from 'recharts';

const STATUS_COLORS = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444' };
const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

const KPI_META: Record<string, { icon: any; color: string; bgColor: string; borderColor: string; subsystem: string }> = {
  'Production Rate': { icon: Factory, color: '#f59e0b', bgColor: 'bg-amber-500/15', borderColor: 'border-amber-500/40', subsystem: 'Production' },
  'Equipment Utilization': { icon: Gauge, color: '#3b82f6', bgColor: 'bg-blue-500/15', borderColor: 'border-blue-500/40', subsystem: 'Equipment' },
  'Downtime': { icon: Timer, color: '#ef4444', bgColor: 'bg-red-500/15', borderColor: 'border-red-500/40', subsystem: 'Equipment' },
  'Stripping Ratio': { icon: Layers, color: '#8b5cf6', bgColor: 'bg-purple-500/15', borderColor: 'border-purple-500/40', subsystem: 'Production' },
  'Dispatch Efficiency': { icon: Truck, color: '#06b6d4', bgColor: 'bg-cyan-500/15', borderColor: 'border-cyan-500/40', subsystem: 'Logistics' },
  'Wagon Availability': { icon: Train, color: '#10b981', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-500/40', subsystem: 'Logistics' },
  'Cost Per Tonne': { icon: DollarSign, color: '#f97316', bgColor: 'bg-orange-500/15', borderColor: 'border-orange-500/40', subsystem: 'Finance' },
  'CO2 Emissions': { icon: Wind, color: '#22c55e', bgColor: 'bg-green-500/15', borderColor: 'border-green-500/40', subsystem: 'ESG' },
  'Workforce Attendance': { icon: HardHat, color: '#6366f1', bgColor: 'bg-indigo-500/15', borderColor: 'border-indigo-500/40', subsystem: 'HR' },
  'Safety Score': { icon: ShieldAlert, color: '#ec4899', bgColor: 'bg-pink-500/15', borderColor: 'border-pink-500/40', subsystem: 'EHS' },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  green: { label: 'NORMAL', className: 'bg-green-500/15 text-green-400 border-green-500/25' },
  amber: { label: 'WARNING', className: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  red: { label: 'CRITICAL', className: 'bg-red-500/15 text-red-400 border-red-500/25' },
};

const TIME_FILTERS = ['1H', '6H', '24H', '7D', '30D'];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [mines, setMines] = useState<Mine[]>([]);
  const [kpis, setKpis] = useState<Record<string, Record<string, KPIReading>>>({});
  const [kpiDefs, setKpiDefs] = useState<KPIDefinition[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [timeFilter, setTimeFilter] = useState('24H');
  const [kpiHistory, setKpiHistory] = useState<Record<string, any[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [detailModal, setDetailModal] = useState<{
    open: boolean; kpiName: string; mineId: string; mineName: string;
    reading?: KPIReading; def?: KPIDefinition;
  }>({ open: false, kpiName: '', mineId: '', mineName: '' });

  const loadData = useCallback(() => {
    minesApi.list().then((r) => setMines(r.data)).catch(() => {});
    kpiApi.current().then((r) => {
      if (r.data.aggregated) { /* CEO view */ }
      else setKpis(r.data);
    }).catch(() => {});
    kpiApi.definitions().then((r) => setKpiDefs(r.data)).catch(() => {});
    alertsApi.list().then((r) => setAlerts(r.data)).catch(() => {});
    advisoryApi.list().then((r) => setAdvisories(r.data)).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    setTimeout(() => setRefreshing(false), 1000);
  }, [loadData]);

  useEffect(() => {
    if (mines.length === 0) return;
    const firstMine = mines[0].id;
    const kpiNames = ['Production Rate', 'Equipment Utilization', 'Downtime', 'Dispatch Efficiency', 'Safety Score', 'Cost Per Tonne'];
    kpiNames.forEach(name => {
      kpiApi.history(firstMine, name)
        .then(r => setKpiHistory(prev => ({ ...prev, [name]: r.data.data || [] })))
        .catch(() => {});
    });
  }, [mines]);

  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'kpi_update') setKpis((prev) => ({ ...prev, [data.mine_id]: data.data }));
    else if (data.type === 'alert') setAlerts((prev) => [data.data, ...prev].slice(0, 100));
    else if (data.type === 'advisory') setAdvisories((prev) => [data.data, ...prev].slice(0, 100));
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const aggregatedKpis = useMemo(() => {
    const result: Record<string, { sum: number; count: number; status: string }> = {};
    Object.values(kpis).forEach(mineKpis => {
      Object.entries(mineKpis).forEach(([name, reading]) => {
        if (!result[name]) result[name] = { sum: 0, count: 0, status: 'green' };
        result[name].sum += reading.value;
        result[name].count += 1;
        if (reading.status === 'red') result[name].status = 'red';
        else if (reading.status === 'amber' && result[name].status !== 'red') result[name].status = 'amber';
      });
    });
    return result;
  }, [kpis]);

  const kpiTiles = useMemo(() => {
    const order = [
      'Production Rate', 'Equipment Utilization', 'Downtime', 'Stripping Ratio',
      'Dispatch Efficiency', 'Wagon Availability', 'Cost Per Tonne', 'CO2 Emissions',
      'Workforce Attendance', 'Safety Score',
    ];
    return order.map(name => {
      const agg = aggregatedKpis[name] || aggregatedKpis[name.replace('CO2', 'CO\u2082')];
      const meta = KPI_META[name] || { icon: Activity, color: '#64748b', bgColor: 'bg-slate-500/15', borderColor: 'border-slate-500/40', subsystem: '' };
      const def = kpiDefs.find(d => d.name === name || d.name === name.replace('CO2', 'CO\u2082'));
      let value = agg ? (name === 'Production Rate' ? agg.sum : agg.sum / agg.count) : 0;
      const status = (agg?.status || 'green') as 'green' | 'amber' | 'red';
      const unit = def?.unit || '';
      const inverted = ['Downtime', 'Stripping Ratio', 'Cost Per Tonne', 'CO2 Emissions'].includes(name);
      const delta = (Math.random() * 6 - 2).toFixed(2);
      const deltaPositive = parseFloat(delta) > 0;
      return { name: def?.name || name, value: value.toFixed(2), unit, status, meta, def, inverted, delta, deltaPositive };
    });
  }, [aggregatedKpis, kpiDefs, kpis]);

  const productionByMine = mines.map((m) => ({
    name: m.name.replace(' Open Cast Mine', '').replace(' Mine', ''),
    production: m.current_production_tph, capacity: m.capacity_mtpa * 1000000 / 8760,
  }));

  const crossKpiData = mines.map((m) => {
    const mk = kpis[m.id] || {};
    return {
      name: m.name.replace(' Open Cast Mine', '').replace(' Mine', ''),
      production: mk['Production Rate']?.value || m.current_production_tph,
      downtime: mk['Downtime']?.value || 10,
      dispatch: mk['Dispatch Efficiency']?.value || 85,
      utilization: mk['Equipment Utilization']?.value || 80,
      safety: mk['Safety Score']?.value || 85,
    };
  });

  const radarData = useMemo(() => {
    const metrics = ['Production', 'Utilization', 'Dispatch', 'Safety', 'Attendance', 'Emissions'];
    const kpiNames = ['Production Rate', 'Equipment Utilization', 'Dispatch Efficiency', 'Safety Score', 'Workforce Attendance', 'CO\u2082 Emissions'];
    return metrics.map((m, i) => {
      const agg = aggregatedKpis[kpiNames[i]];
      let val = agg ? agg.sum / agg.count : 50;
      if (kpiNames[i] === 'Production Rate') val = Math.min(100, (agg?.sum || 0) / 30);
      if (kpiNames[i] === 'CO\u2082 Emissions') val = Math.max(0, 100 - (val / 3));
      return { metric: m, value: Math.min(100, Math.max(0, val)) };
    });
  }, [aggregatedKpis]);

  const activeAdvisories = advisories.filter(a => a.status === 'active');
  const criticalAdvisories = activeAdvisories.filter(a => a.severity === 'critical').length;
  const warningAdvisories = activeAdvisories.filter(a => a.severity === 'warning').length;
  const unackAlerts = alerts.filter(a => !a.acknowledged).length;

  const openDetailModal = (kpiName: string) => {
    const firstMine = mines[0];
    if (!firstMine) return;
    const reading = (kpis[firstMine.id] || {})[kpiName];
    const def = kpiDefs.find(d => d.name === kpiName);
    setDetailModal({ open: true, kpiName, mineId: firstMine.id, mineName: firstMine.name, reading, def });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        {criticalAdvisories > 0 && (
          <div onClick={() => router.push('/advisory')} className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-red-500/10 via-red-500/5 to-purple-500/10 border border-red-500/20 cursor-pointer hover:border-red-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-red-400">AI Engine Alert</span>
                <p className="text-[11px] text-slate-400">{criticalAdvisories} critical advisories require immediate attention</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-red-400" />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{user?.role === 'ceo' ? 'Executive Dashboard' : 'Operations Dashboard'}</h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              Last refresh: {new Date().toLocaleTimeString()}
              {connected && <span className="inline-flex items-center gap-1 text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[#0a1025] rounded-lg border border-[#1e2d52] p-0.5">
              {TIME_FILTERS.map(tf => (
                <button key={tf} onClick={() => setTimeFilter(tf)} className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${timeFilter === tf ? 'bg-purple-500/20 text-purple-400' : 'text-slate-600 hover:text-slate-400'}`}>{tf}</button>
              ))}
            </div>
            <button onClick={handleRefresh} className="p-2 rounded-lg hover:bg-white/5 transition-colors"><RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiTiles.map((kpi) => {
            const Icon = kpi.meta.icon;
            const badge = STATUS_BADGE[kpi.status] || STATUS_BADGE.green;
            const statusBorderColor = kpi.status === 'green' ? 'border-green-500/30' : kpi.status === 'amber' ? 'border-amber-500/30' : 'border-red-500/30';
            const statusGlow = kpi.status === 'green' ? 'shadow-green-500/5' : kpi.status === 'amber' ? 'shadow-amber-500/10' : 'shadow-red-500/10';
            return (
              <button key={kpi.name} onClick={() => openDetailModal(kpi.name)} className={`relative p-4 text-left rounded-2xl bg-[#0a1025] border ${statusBorderColor} hover:scale-[1.03] transition-all duration-200 group shadow-lg ${statusGlow} overflow-hidden`}>
                {/* Top color accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${kpi.meta.color}88, ${kpi.meta.color}22)` }} />

                {/* Header: Icon + Status dot */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl ${kpi.meta.bgColor} flex items-center justify-center shadow-inner`}>
                    <Icon className="w-5 h-5" style={{ color: kpi.meta.color }} />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${kpi.status === 'green' ? 'bg-green-400 shadow-green-400/50' : kpi.status === 'amber' ? 'bg-amber-400 shadow-amber-400/50' : 'bg-red-400 shadow-red-400/50'} shadow-lg`} />
                    <span className="text-[7px] text-slate-600 font-medium tracking-wider uppercase">{kpi.meta.subsystem}</span>
                  </div>
                </div>

                {/* Value */}
                <div className="mb-1">
                  <span className="text-2xl font-bold text-white tracking-tight">{kpi.value}</span>
                  <span className="text-[10px] text-slate-500 font-medium ml-1">{kpi.unit}</span>
                </div>

                {/* KPI Name */}
                <p className="text-[11px] text-slate-400 font-medium mb-3 leading-tight">{kpi.name}</p>

                {/* Footer: Badge + Delta */}
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] px-2 py-0.5 rounded-md border font-bold tracking-wide ${badge.className}`}>{badge.label}</span>
                  <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${(kpi.deltaPositive && !kpi.inverted) || (!kpi.deltaPositive && kpi.inverted) ? 'text-green-400' : 'text-red-400'}`}>
                    {kpi.deltaPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(parseFloat(kpi.delta))}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Mine Health Overview */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white">Mine Health Index</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Individual and combined health scores based on KPI performance</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">Combined:</span>
              <span className="text-lg font-bold text-green-400">
                {(() => {
                  let totalGreen = 0, totalKpis = 0;
                  Object.values(kpis).forEach(mk => {
                    Object.values(mk).forEach(r => { totalKpis++; if (r.status === 'green') totalGreen++; });
                  });
                  return totalKpis > 0 ? Math.round((totalGreen / totalKpis) * 100) : 0;
                })()}%
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {mines.map(mine => {
              const mk = kpis[mine.id] || {};
              const kpiEntries = Object.values(mk);
              const greenCount = kpiEntries.filter(r => r.status === 'green').length;
              const amberCount = kpiEntries.filter(r => r.status === 'amber').length;
              const redCount = kpiEntries.filter(r => r.status === 'red').length;
              const health = kpiEntries.length > 0 ? Math.round((greenCount / kpiEntries.length) * 100) : 0;
              const healthColor = health >= 80 ? 'text-green-400' : health >= 60 ? 'text-amber-400' : 'text-red-400';
              const healthBg = health >= 80 ? 'from-green-500 to-emerald-400' : health >= 60 ? 'from-amber-500 to-yellow-400' : 'from-red-500 to-rose-400';
              const statusColor = mine.status === 'normal' ? 'bg-green-400' : mine.status === 'warning' ? 'bg-amber-400' : 'bg-red-400';
              return (
                <button key={mine.id} onClick={() => router.push(`/digital-twin/${mine.id}`)} className="p-4 rounded-xl bg-[#0a1025] border border-slate-700/30 hover:border-slate-600/50 hover:scale-[1.02] transition-all text-left">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
                    <span className="text-xs font-semibold text-white truncate">{mine.name.replace(' Open Cast Mine', '').replace(' Mine', '')}</span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <span className={`text-2xl font-bold ${healthColor}`}>{health}%</span>
                    <span className="text-[9px] text-slate-500">{mine.mine_type === 'underground' ? 'UG' : 'OC'}</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                    <div className={`h-2 rounded-full bg-gradient-to-r ${healthBg} transition-all`} style={{ width: `${health}%` }} />
                  </div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className="text-green-400">{greenCount} OK</span>
                    <span className="text-amber-400">{amberCount} Warn</span>
                    <span className="text-red-400">{redCount} Crit</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div><h2 className="text-sm font-bold text-white">KPI Trend Analytics</h2><p className="text-[10px] text-slate-500 mt-0.5">One chart per KPI with thresholds</p></div>
            {connected && <span className="inline-flex items-center gap-1 text-[10px] text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {['Production Rate', 'Equipment Utilization', 'Downtime', 'Dispatch Efficiency', 'Safety Score', 'Cost Per Tonne'].map(kpiName => {
              const meta = KPI_META[kpiName] || { icon: Activity, color: '#64748b', bgColor: 'bg-slate-500/15' };
              const def = kpiDefs.find(d => d.name === kpiName);
              const history = kpiHistory[kpiName] || [];
              const chartData = history.slice(-40).map((d: any) => ({ time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), value: d.value }));
              const agg = aggregatedKpis[kpiName];
              const status = (agg?.status || 'green') as 'green' | 'amber' | 'red';
              const badge = STATUS_BADGE[status] || STATUS_BADGE.green;
              const firstReading = Object.values(kpis)[0]?.[kpiName];
              const thresholds = firstReading?.thresholds || {};
              return (
                <div key={kpiName} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div><h3 className="text-xs font-semibold text-white">{kpiName}</h3><p className="text-[9px] text-slate-600 mt-0.5">{def?.description || ''}</p></div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openDetailModal(kpiName)} className="text-[9px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 transition-colors font-medium">Predict</button>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-semibold ${badge.className}`}>{badge.label}</span>
                    </div>
                  </div>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <AreaChart data={chartData}>
                        <defs><linearGradient id={`grad_${kpiName.replace(/[^a-zA-Z]/g, '')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                        <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#475569' }} interval="preserveStartEnd" label={{ value: 'Time', position: 'insideBottom', offset: -2, fill: '#475569', fontSize: 8 }} />
                        <YAxis tick={{ fontSize: 9, fill: '#475569' }} width={44} label={{ value: def?.unit || 'Value', angle: -90, position: 'insideLeft', offset: 14, fill: '#475569', fontSize: 8 }} />
                        <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '6px', fontSize: '10px' }} />
                        {thresholds.green && typeof thresholds.green === 'number' && <ReferenceLine y={thresholds.green} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1} />}
                        {thresholds.amber && typeof thresholds.amber === 'number' && <ReferenceLine y={thresholds.amber} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1} />}
                        <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill={`url(#grad_${kpiName.replace(/[^a-zA-Z]/g, '')})`} strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[140px] flex items-center justify-center"><Activity className="w-5 h-5 text-slate-700 animate-pulse" /></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-semibold text-white">Production by Mine (TPH)</h3><span className="text-[9px] text-slate-600 uppercase tracking-wider">Real-time</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productionByMine} margin={{ bottom: 22, left: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" /><XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Mine', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} /><YAxis tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'TPH', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} /><Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '6px', fontSize: '10px' }} /><Legend wrapperStyle={{ fontSize: '10px' }} /><Bar dataKey="production" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Production (TPH)" /><Bar dataKey="capacity" fill="#2d1b69" radius={[3, 3, 0, 0]} name="Capacity" /></BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-semibold text-white">Operations Health Index</h3><span className="text-[9px] text-slate-600 uppercase tracking-wider">Composite</span></div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}><PolarGrid stroke="#1e2d52" /><PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: '#94a3b8' }} /><PolarRadiusAxis tick={{ fontSize: 8, fill: '#475569' }} domain={[0, 100]} /><Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} /></RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5 border-purple-500/15">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-purple-400" />Active AI Advisories</h3>
              <div className="flex items-center gap-1.5"><span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">{criticalAdvisories} critical</span><span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">{warningAdvisories} warning</span></div>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {activeAdvisories.slice(0, 6).map(adv => (
                <div key={adv.id} className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/15 hover:border-purple-500/30 transition-colors cursor-pointer">
                  <div className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${adv.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">{adv.root_cause}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{adv.category_tag || adv.kpi_category}</span>
                        <span className="text-[9px] text-slate-600">{adv.mine_name?.replace(' Open Cast Mine', '').replace(' Mine', '')}</span>
                        {adv.risk_score > 0 && <span className={`text-[9px] font-bold ml-auto ${adv.risk_score >= 80 ? 'text-red-400' : adv.risk_score >= 60 ? 'text-amber-400' : 'text-green-400'}`}>{adv.risk_score}%</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => router.push('/advisory')} className="mt-3 w-full text-center text-[10px] text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1 py-1.5">View All <ArrowRight className="w-3 h-3" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-xs font-semibold text-white">Digital Twin � 3D Mine Network</h3><p className="text-[9px] text-slate-600 mt-0.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Real-time</p></div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">{mines.filter(m => m.status === 'critical').length} Critical</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">{mines.filter(m => m.status === 'warning').length} Warning</span>
              </div>
            </div>
            <div className="h-[200px] bg-[#050a14] rounded-xl border border-[#1e2d52]/50 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center gap-6 p-4">
                {mines.map((mine) => {
                  const colors: Record<string, string> = { normal: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };
                  return (
                    <button key={mine.id} onClick={() => router.push(`/digital-twin/${mine.id}`)} className="flex flex-col items-center gap-2 group cursor-pointer">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-110" style={{ borderColor: colors[mine.status], background: `${colors[mine.status]}15` }}>
                        <Mountain className="w-4 h-4" style={{ color: colors[mine.status] }} />
                      </div>
                      <span className="text-[8px] text-slate-500 group-hover:text-white transition-colors text-center leading-tight max-w-[60px]">{mine.name.replace(' Open Cast Mine', '').replace(' Mine', '')}</span>
                      <span className="text-[8px] text-slate-600">{mine.current_production_tph.toFixed(2)} TPH</span>
                    </button>
                  );
                })}
              </div>
              <div className="absolute bottom-2 left-3 flex items-center gap-3">
                {[{ label: 'Normal', color: '#22c55e' }, { label: 'Warning', color: '#f59e0b' }, { label: 'Critical', color: '#ef4444' }].map(l => (
                  <div key={l.label} className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} /><span className="text-[7px] text-slate-600">{l.label}</span></div>
                ))}
              </div>
              <div className="absolute bottom-2 right-3 text-[7px] text-slate-600">{mines.length} mines � Live Monitoring</div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[9px] text-slate-600">Click a mine to explore 3D digital twin</span>
              <button onClick={() => router.push(`/digital-twin/${mines[0]?.id || 'mine_gevra'}`)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">Open Full View <ArrowRight className="w-3 h-3" /></button>
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold text-white mb-4">Production vs Downtime Correlation</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={crossKpiData} margin={{ bottom: 22, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" /><XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Mine', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} /><YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'TPH', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} /><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} label={{ value: 'Downtime %', angle: 90, position: 'insideRight', offset: 16, fill: '#64748b', fontSize: 9 }} />
                <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '6px', fontSize: '10px' }} /><Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar yAxisId="left" dataKey="production" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Production (TPH)" /><Bar yAxisId="right" dataKey="downtime" fill="#a78bfa" radius={[3, 3, 0, 0]} name="Downtime (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold text-white mb-4">Dispatch vs Utilization</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={crossKpiData} margin={{ bottom: 22, left: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" /><XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} label={{ value: 'Mine', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 8 }} /><YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft', offset: 14, fill: '#64748b', fontSize: 9 }} /><Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '6px', fontSize: '10px' }} /><Legend wrapperStyle={{ fontSize: '10px' }} /><Bar dataKey="dispatch" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Dispatch (%)" /><Bar dataKey="utilization" fill="#a78bfa" radius={[3, 3, 0, 0]} name="Utilization (%)" /></BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold text-white mb-4">Safety Score by Mine</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={crossKpiData} layout="vertical" margin={{ bottom: 22, left: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" /><XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} domain={[0, 100]} label={{ value: 'Score (0–100)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 9 }} /><YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} width={70} /><Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '6px', fontSize: '10px' }} /><Bar dataKey="safety" fill="#8b5cf6" radius={[0, 3, 3, 0]} name="Safety Score" /></BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold text-white mb-4">Mine Status Distribution</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={[{ name: 'Normal', value: mines.filter(m => m.status === 'normal').length, color: '#22c55e' }, { name: 'Warning', value: mines.filter(m => m.status === 'warning').length, color: '#f59e0b' }, { name: 'Critical', value: mines.filter(m => m.status === 'critical').length, color: '#ef4444' }].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4} dataKey="value">
                  {[{ name: 'Normal', value: mines.filter(m => m.status === 'normal').length, color: '#22c55e' }, { name: 'Warning', value: mines.filter(m => m.status === 'warning').length, color: '#f59e0b' }, { name: 'Critical', value: mines.filter(m => m.status === 'critical').length, color: '#ef4444' }].filter(d => d.value > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '6px', fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4">
              {['Normal', 'Warning', 'Critical'].map(s => { const count = mines.filter(m => m.status === s.toLowerCase()).length; const color = s === 'Normal' ? '#22c55e' : s === 'Warning' ? '#f59e0b' : '#ef4444'; return (<div key={s} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: color }} /><span className="text-[9px] text-slate-500">{s} ({count})</span></div>); })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xs font-semibold text-white flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" />Active Alerts</h3><span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{unackAlerts} unacknowledged</span></div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {alerts.filter(a => !a.acknowledged).slice(0, 8).map((alert) => (
                <div key={alert.id} className={`p-2.5 rounded-lg border ${SEVERITY_STYLES[alert.severity] || ''}`}>
                  <div className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${alert.severity === 'critical' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[8px] px-1 py-0.5 rounded font-semibold uppercase ${alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' : alert.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{(alert.type || 'operational').replace(/_/g, ' ')}</span>
                        {alert.location_tag && <span className="text-[8px] text-slate-600">{alert.location_tag}</span>}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-slate-600">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        {alert.team_assigned && <span className="text-[9px] text-cyan-500">{alert.team_assigned}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold text-white mb-4">Mines Overview</h3>
            <div className="space-y-2">
              {mines.map((mine) => (
                <button key={mine.id} onClick={() => router.push(`/digital-twin/${mine.id}`)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group border border-transparent hover:border-[#1e2d52]">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${mine.status === 'normal' ? 'bg-green-400' : mine.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`} />
                    <div className="text-left"><span className="text-xs text-slate-300 group-hover:text-white transition-colors font-medium">{mine.name.replace(' Open Cast Mine', '').replace(' Mine', '')}</span><p className="text-[9px] text-slate-600">{mine.location}</p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right"><p className="text-xs font-bold text-white">{mine.current_production_tph.toFixed(2)} TPH</p><p className="text-[9px] text-slate-600">{mine.equipment_count} equipment</p></div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <KPIDetailModal isOpen={detailModal.open} onClose={() => setDetailModal(prev => ({ ...prev, open: false }))} kpiName={detailModal.kpiName} mineId={detailModal.mineId} mineName={detailModal.mineName} currentReading={detailModal.reading} kpiDefinition={detailModal.def} />
    </DashboardLayout>
  );
}
