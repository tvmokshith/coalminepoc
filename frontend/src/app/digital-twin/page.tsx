'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { minesApi, kpiApi, alertsApi, advisoryApi } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Mine, KPIReading, Alert, Advisory } from '@/types';
import dynamic from 'next/dynamic';
import {
  Map, ArrowRight, Mountain, Factory, Truck, Activity,
  AlertTriangle, Gauge, TrendingUp, TrendingDown, Zap,
  Layers, Eye, Wifi, Signal
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// Dynamic import for Leaflet (SSR incompatible)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const LeafletTooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip), { ssr: false });
const UseMapHook = dynamic(() => import('react-leaflet').then(m => {
  // Inner component that resets map to initial view on every mount
  function ResetView() {
    const map = m.useMap();
    useEffect(() => {
      map.setView([23.5, 83.5], 6, { animate: false });
    }, [map]);
    return null;
  }
  return { default: ResetView };
}), { ssr: false });

const STATUS_COLORS: Record<string, string> = { normal: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

export default function DigitalTwinIndex() {
  const router = useRouter();
  const [mines, setMines] = useState<Mine[]>([]);
  const [kpis, setKpis] = useState<Record<string, Record<string, KPIReading>>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [selectedMine, setSelectedMine] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const navigateToMine = useCallback((mineId: string) => {
    setTransitioning(mineId);
    setTimeout(() => router.push(`/digital-twin/${mineId}`), 800);
  }, [router]);

  useEffect(() => {
    import('leaflet/dist/leaflet.css');
    setMapReady(true);
  }, []);

  useEffect(() => {
    minesApi.list().then((r) => setMines(r.data)).catch(() => {});
    kpiApi.current().then((r) => setKpis(r.data)).catch(() => {});
    alertsApi.list().then((r) => setAlerts(r.data)).catch(() => {});
    advisoryApi.list().then((r) => setAdvisories(r.data)).catch(() => {});
  }, []);

  const { connected } = useWebSocket((data: any) => {
    if (data.type === 'kpi_update') setKpis((prev) => ({ ...prev, [data.mine_id]: data.data }));
    if (data.type === 'alert') setAlerts((prev) => [data.data, ...prev].slice(0, 100));
  });

  const getMineCoords = (mine: Mine): [number, number] => [mine.lat || 23.5, mine.lng || 83.5];

  const selectedMineData = mines.find((m) => m.id === selectedMine);
  const selectedMineKpis = selectedMine ? kpis[selectedMine] || {} : {};

  const networkHealth = useMemo(() => {
    const total = mines.length;
    const normal = mines.filter((m) => m.status === 'normal').length;
    const warning = mines.filter((m) => m.status === 'warning').length;
    const critical = mines.filter((m) => m.status === 'critical').length;
    const activeAlerts = alerts.filter((a) => !a.acknowledged).length;
    const activeAdvisories = advisories.filter((a) => a.status === 'active').length;
    const totalCapacity = mines.reduce((s, m) => s + (m.capacity_mtpa || 0), 0);
    return { total, normal, warning, critical, activeAlerts, activeAdvisories, totalCapacity, healthPct: total > 0 ? Math.round((normal / total) * 100) : 0 };
  }, [mines, alerts, advisories]);

  const productionData = useMemo(() => {
    return mines.map((m) => {
      const mk = kpis[m.id] || {};
      const pr = mk['Production Rate'];
      const val = pr && typeof pr === 'object' && 'value' in pr ? pr.value : 0;
      return { name: m.name.replace(' Open Cast Mine', '').replace(' Underground Mine', '').replace(' Mine', ''), production: val, capacity: (m.capacity_mtpa || 50) / 365 };
    });
  }, [mines, kpis]);

  return (
    <DashboardLayout>
      <div className="space-y-4 fade-in">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Mountain className="w-5 h-5 text-amber-400" />
              Digital Twin - Mine Network
            </h1>
            <p className="text-[10px] text-slate-500 flex items-center gap-2">
              Real-time geospatial intelligence across all operational mines
              {connected && (
                <span className="inline-flex items-center gap-1 text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Live
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Network Health Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Network Health', value: `${networkHealth.healthPct}%`, icon: Signal, color: networkHealth.healthPct >= 80 ? 'text-green-400' : 'text-amber-400' },
            { label: 'Active Alerts', value: networkHealth.activeAlerts.toString(), icon: AlertTriangle, color: networkHealth.activeAlerts > 5 ? 'text-red-400' : 'text-amber-400' },
            { label: 'AI Advisories', value: networkHealth.activeAdvisories.toString(), icon: Zap, color: 'text-purple-400' },
            { label: 'Total Capacity', value: `${(networkHealth.totalCapacity / 1e6).toFixed(2)}Mt`, icon: Layers, color: 'text-cyan-400' },
          ].map((card) => (
            <div key={card.label} className="glass-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase">{card.label}</p>
                  <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                </div>
                <card.icon className={`w-5 h-5 ${card.color} opacity-40`} />
              </div>
            </div>
          ))}
        </div>

        {/* Map + Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Leaflet Map */}
          <div className="lg:col-span-2 glass-card overflow-hidden" style={{ height: 460 }}>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>{`
              .leaflet-container { background: #0a1025 !important; height: 100% !important; width: 100% !important; }
              .leaflet-tile-pane { filter: brightness(0.85) contrast(1.15) saturate(0.85) hue-rotate(10deg); }
              .leaflet-control-attribution { font-size: 8px !important; background: rgba(10,16,37,0.8) !important; color: #475569 !important; }
              .leaflet-control-attribution a { color: #64748b !important; }
              .leaflet-control-zoom { border: 1px solid #1e2d52 !important; }
              .leaflet-control-zoom a { background: #111a35 !important; color: #94a3b8 !important; border-color: #1e2d52 !important; }
              .mine-tooltip { background: rgba(5,10,24,0.92) !important; border: 1px solid rgba(245,158,11,0.4) !important; border-radius: 8px !important; padding: 4px 10px !important; box-shadow: 0 2px 12px rgba(0,0,0,0.6) !important; }
              .mine-tooltip::before { border-top-color: rgba(245,158,11,0.4) !important; }
            `}</style>
            {mapReady && (
              <MapContainer
                center={[23.5, 83.5] as any}
                zoom={6}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
              >
                <UseMapHook />
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                {mines.map((mine) => {
                  const coords = getMineCoords(mine);
                  const fillColor = STATUS_COLORS[mine.status] || '#6b7280';
                  const isUG = mine.mine_type === 'underground';
                  return (
                    <CircleMarker
                      key={mine.id}
                      center={coords as any}
                      radius={selectedMine === mine.id ? 14 : 10}
                      pathOptions={{
                        fillColor,
                        color: selectedMine === mine.id ? '#f59e0b' : fillColor,
                        weight: selectedMine === mine.id ? 3 : 2,
                        fillOpacity: 0.7,
                        opacity: 0.9,
                      }}
                      eventHandlers={{
                        click: () => setSelectedMine(mine.id),
                        dblclick: () => navigateToMine(mine.id),
                      }}
                    >
                      <LeafletTooltip permanent direction="top" offset={[0, -14]} className="mine-tooltip">
                        <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: 11, textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
                            {mine.name.replace(' Open Cast Mine', '').replace(' Underground Mine', '').replace(' Mine', '')}
                          </div>
                          <div style={{ color: isUG ? '#a78bfa' : '#f59e0b', fontSize: 9, fontWeight: 600, marginTop: 1 }}>
                            {isUG ? '\u26CF Underground' : '\u2B55 Open Cast'} &middot; {mine.capacity_mtpa}MT
                          </div>
                        </div>
                      </LeafletTooltip>
                      <Popup>
                        <div className="bg-[#111a35] text-white p-2 rounded-lg min-w-[160px]" style={{ background: '#111a35', color: 'white' }}>
                          <p className="font-bold text-sm">{mine.name}</p>
                          <p className="text-xs text-slate-400">{mine.location}</p>
                          <p className="text-xs mt-1">
                            Status: <span className={mine.status === 'normal' ? 'text-green-400' : mine.status === 'warning' ? 'text-amber-400' : 'text-red-400'}>{mine.status}</span>
                          </p>
                          <p className="text-xs mt-0.5">Depth: {mine.depth_m}m &middot; Seam: {mine.seam_thickness_m}m</p>
                          <button
                            onClick={() => navigateToMine(mine.id)}
                            className="mt-2 text-xs text-amber-400 hover:text-amber-300"
                          >
                            Open 3D Twin &rarr;
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            )}
          </div>

          {/* Mine Detail Sidebar */}
          <div className="space-y-3">
            {selectedMineData ? (
              <>
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">{selectedMineData.name}</h3>
                    <span className={`w-2.5 h-2.5 rounded-full ${selectedMineData.status === 'normal' ? 'bg-green-400' : selectedMineData.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`} />
                  </div>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-slate-500">Location</span><span className="text-slate-300">{selectedMineData.location}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Type</span><span className={`font-medium ${selectedMineData.mine_type === 'underground' ? 'text-purple-400' : 'text-amber-400'}`}>{selectedMineData.mine_type === 'underground' ? 'Underground' : 'Open Cast'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Depth</span><span className="text-slate-300">{selectedMineData.depth_m}m</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Seam Thickness</span><span className="text-slate-300">{selectedMineData.seam_thickness_m}m</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Capacity</span><span className="text-slate-300">{selectedMineData.capacity_mtpa} MTPA</span></div>
                    {selectedMineData.mine_type === 'open_cast' && <div className="flex justify-between"><span className="text-slate-500">Strip Ratio</span><span className="text-slate-300">{selectedMineData.strip_ratio}:1</span></div>}
                    {selectedMineData.mine_type === 'open_cast' && <div className="flex justify-between"><span className="text-slate-500">Benches</span><span className="text-slate-300">{selectedMineData.bench_count}</span></div>}
                  </div>
                  <button
                    onClick={() => navigateToMine(selectedMineData.id)}
                    className="w-full mt-3 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Open 3D Digital Twin
                  </button>
                </div>
                <div className="glass-card p-3">
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Live KPIs</h4>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {Object.entries(selectedMineKpis).map(([name, kpi]) => {
                      const k = kpi as KPIReading;
                      return (
                        <div key={name} className="flex items-center justify-between p-1.5 rounded bg-white/3">
                          <span className="text-[9px] text-slate-500 truncate max-w-[100px]">{k.kpi_name || name}</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${k.status === 'green' ? 'bg-green-400' : k.status === 'amber' ? 'bg-amber-400' : 'bg-red-400'}`} />
                            <span className={`text-[10px] font-bold ${k.status === 'green' ? 'text-green-400' : k.status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>
                              {typeof k.value === 'number' ? k.value.toFixed(2) : k.value}
                            </span>
                            <span className="text-[8px] text-slate-600">{k.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(selectedMineKpis).length === 0 && <p className="text-[9px] text-slate-600 text-center py-2">Loading KPIs...</p>}
                  </div>
                </div>
                <div className="glass-card p-3">
                  <h4 className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Recent Alerts</h4>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto">
                    {alerts.filter(a => a.mine_id === selectedMine && !a.acknowledged).slice(0, 5).map(a => (
                      <div key={a.id} className={`p-1.5 rounded text-[9px] ${a.severity === 'critical' ? 'bg-red-500/10 text-red-400' : a.severity === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {a.message}
                      </div>
                    ))}
                    {alerts.filter(a => a.mine_id === selectedMine && !a.acknowledged).length === 0 && <p className="text-[9px] text-slate-600 text-center py-2">No active alerts</p>}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-card p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: 340 }}>
                <Map className="w-8 h-8 text-slate-700 mb-3" />
                <p className="text-sm text-slate-500 font-medium">Select a mine on the map</p>
                <p className="text-[10px] text-slate-600 mt-1">Click any mine marker to view details. Double-click to open 3D twin.</p>
              </div>
            )}
          </div>
        </div>

        {/* Mine Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {mines.map((mine) => {
            const mk = kpis[mine.id] || {};
            const pr = mk['Production Rate'];
            const prVal = pr && typeof pr === 'object' && 'value' in pr ? pr.value : null;
            const eu = mk['Equipment Utilization'];
            const euVal = eu && typeof eu === 'object' && 'value' in eu ? eu.value : null;
            const mineAlerts = alerts.filter(a => a.mine_id === mine.id && !a.acknowledged).length;
            return (
              <button
                key={mine.id}
                onClick={() => setSelectedMine(mine.id)}
                onDoubleClick={() => navigateToMine(mine.id)}
                className={`glass-card p-3 text-left transition-all hover:scale-[1.02] ${selectedMine === mine.id ? 'ring-1 ring-amber-400/40' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-slate-500 uppercase truncate">{mine.name.replace(' Open Cast Mine', '').replace(' Underground Mine', '')}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-semibold ${mine.mine_type === 'underground' ? 'bg-purple-500/15 text-purple-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {mine.mine_type === 'underground' ? 'UG' : 'OC'}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${mine.status === 'normal' ? 'bg-green-400' : mine.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-600">Production</span>
                    <span className="text-slate-300 font-medium">{prVal !== null ? `${prVal.toFixed(2)} t/h` : '--'}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-600">Utilization</span>
                    <span className="text-slate-300 font-medium">{euVal !== null ? `${euVal.toFixed(2)}%` : '--'}</span>
                  </div>
                  {mineAlerts > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-[8px] text-amber-400">{mineAlerts} alerts</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Production Comparison Chart */}
        {productionData.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-xs font-semibold text-white mb-3">Production Rate Comparison (t/hr)</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={productionData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: 8, fontSize: 10 }} />
                <Bar dataKey="production" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Current" />
                <Bar dataKey="capacity" fill="#1e2d52" radius={[4, 4, 0, 0]} name="Daily Target" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* Transition overlay */}
        {transitioning && (() => {
          const tMine = mines.find(m => m.id === transitioning);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
              <div className="absolute inset-0 bg-[#050a18]" style={{ animation: 'fadeIn 0.4s ease-in-out' }} />
              <div className="relative z-10 text-center" style={{ animation: 'scaleIn 0.5s ease-out' }}>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                  <Mountain className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">{tMine?.name || 'Loading...'}</h2>
                <p className="text-sm text-slate-400">{tMine?.location}</p>
                <p className="text-xs text-slate-500 mt-2 flex items-center justify-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tMine?.mine_type === 'underground' ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {tMine?.mine_type === 'underground' ? 'Underground Mine' : 'Open Cast Mine'}
                  </span>
                  &middot; Depth: {tMine?.depth_m}m
                </p>
                <div className="mt-6 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-[10px] text-slate-600 mt-3">Initializing 3D Digital Twin...</p>
              </div>
            </div>
          );
        })()}
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
