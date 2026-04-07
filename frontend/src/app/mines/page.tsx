'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { minesApi, kpiApi } from '@/services/api';
import type { Mine, KPIReading } from '@/types';
import { Mountain, MapPin, Gauge, ArrowRight, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapContainer  = dynamic(() => import('react-leaflet').then(m => m.MapContainer),  { ssr: false });
const TileLayer     = dynamic(() => import('react-leaflet').then(m => m.TileLayer),     { ssr: false });
const CircleMarker  = dynamic(() => import('react-leaflet').then(m => m.CircleMarker),  { ssr: false });
const LeafletTooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip),     { ssr: false });
const Popup         = dynamic(() => import('react-leaflet').then(m => m.Popup),         { ssr: false });
const UseMapHook    = dynamic(() => import('react-leaflet').then(m => {
  function ResetView() {
    const map = m.useMap();
    useEffect(() => { map.setView([23.5, 83.5], 6, { animate: false }); }, [map]);
    return null;
  }
  return { default: ResetView };
}), { ssr: false });

const STATUS_COLORS: Record<string, string> = { normal: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

export default function MinesPage() {
  const router = useRouter();
  const [mines, setMines] = useState<Mine[]>([]);
  const [kpis, setKpis] = useState<Record<string, Record<string, KPIReading>>>({});
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    minesApi.list().then((r) => setMines(r.data)).catch(() => {});
    kpiApi.current().then((r) => {
      if (!r.data.aggregated) setKpis(r.data);
    }).catch(() => {});
    import('leaflet/dist/leaflet.css');
    setMapReady(true);
  }, []);

  const statusColor = (s: string) =>
    s === 'normal' ? 'bg-green-400' : s === 'warning' ? 'bg-amber-400' : 'bg-red-400';
  const statusBorder = (s: string) =>
    s === 'normal' ? 'border-green-500/20 glow-green' : s === 'warning' ? 'border-amber-500/20 glow-amber' : 'border-red-500/20 glow-red';

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-2xl font-bold text-white">Mine Operations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of all mining sites</p>
        </div>

        {/* Leaflet Map */}
        <div className="glass-card overflow-hidden" style={{ height: 460 }}>
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
                const coords: [number, number] = [mine.lat || 23.5, mine.lng || 83.5];
                const fillColor = STATUS_COLORS[mine.status] || '#6b7280';
                const isUG = mine.mine_type === 'underground';
                return (
                  <CircleMarker
                    key={mine.id}
                    center={coords as any}
                    radius={10}
                    pathOptions={{
                      fillColor,
                      color: fillColor,
                      weight: 2,
                      fillOpacity: 0.7,
                      opacity: 0.9,
                    }}
                    eventHandlers={{ click: () => router.push(`/digital-twin/${mine.id}`) }}
                  >
                    <LeafletTooltip permanent direction="top" offset={[0, -14]} className="mine-tooltip">
                      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>
                          {mine.name.replace(' Open Cast Mine', '').replace(' Underground Mine', '').replace(' Mine', '')}
                        </div>
                        <div style={{ color: isUG ? '#a78bfa' : '#f59e0b', fontSize: 9, fontWeight: 600, marginTop: 1 }}>
                          {isUG ? '⛏ Underground' : '⭕ Open Cast'} · {mine.capacity_mtpa}MT
                        </div>
                      </div>
                    </LeafletTooltip>
                    <Popup>
                      <div style={{ background: '#111a35', color: 'white', padding: '8px', borderRadius: '8px', minWidth: 160 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{mine.name}</p>
                        <p style={{ color: '#94a3b8', fontSize: 11 }}>{mine.location}</p>
                        <p style={{ fontSize: 11, marginTop: 4 }}>
                          Status: <span style={{ color: fillColor }}>{mine.status}</span>
                        </p>
                        <p style={{ fontSize: 11, marginTop: 2 }}>Depth: {mine.depth_m}m · Seam: {mine.seam_thickness_m}m</p>
                        <button
                          onClick={() => router.push(`/digital-twin/${mine.id}`)}
                          style={{ marginTop: 6, fontSize: 11, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          Open 3D Twin →
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}
        </div>

        {/* Mine Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mines.map((mine) => {
            const mk = kpis[mine.id] || {};
            return (
              <div
                key={mine.id}
                onClick={() => router.push(`/digital-twin/${mine.id}`)}
                className={`glass-card-hover p-5 cursor-pointer ${statusBorder(mine.status)}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColor(mine.status)}`} />
                    <h3 className="text-sm font-semibold text-white">{mine.name}</h3>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600" />
                </div>
                <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {mine.location}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-600">Production</p>
                    <p className="text-lg font-bold text-white">{mine.current_production_tph.toFixed(2)}<span className="text-xs text-slate-500 ml-1">TPH</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600">Equipment</p>
                    <p className="text-lg font-bold text-white">{mine.equipment_count}<span className="text-xs text-slate-500 ml-1">units</span></p>
                  </div>
                  {mk['Equipment Utilization'] && (
                    <div>
                      <p className="text-[10px] text-slate-600">Utilization</p>
                      <p className={`text-sm font-semibold ${mk['Equipment Utilization'].status === 'green' ? 'text-green-400' : mk['Equipment Utilization'].status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>
                        {mk['Equipment Utilization'].value.toFixed(2)}%
                      </p>
                    </div>
                  )}
                  {mk['Downtime'] && (
                    <div>
                      <p className="text-[10px] text-slate-600">Downtime</p>
                      <p className={`text-sm font-semibold ${mk['Downtime'].status === 'green' ? 'text-green-400' : mk['Downtime'].status === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>
                        {mk['Downtime'].value.toFixed(2)}%
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-[#1e2d52]">
                  <p className="text-[10px] text-slate-600">Capacity: {mine.capacity_mtpa} MTPA | {mine.region} Region</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
