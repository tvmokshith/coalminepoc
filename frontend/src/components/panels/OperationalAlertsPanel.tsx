'use client';

import { useState, useMemo } from 'react';
import type { Alert } from '@/types';
import {
  X, Bell, ChevronDown, ChevronRight, AlertTriangle, Shield,
  Users, MapPin, Wrench, Zap, Eye
} from 'lucide-react';

interface OperationalAlertsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: Alert[];
  onAcknowledge?: (id: string) => void;
  onInvestigate?: (alert: Alert) => void;
  sideOffset?: number;
}

const SEVERITY_TABS = ['All', 'Critical', 'Warning', 'Info'];

const TYPE_BADGES: Record<string, { bg: string; text: string }> = {
  equipment_failure: { bg: 'bg-red-500/15', text: 'text-red-400' },
  thermal: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  vibration: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  overload: { bg: 'bg-red-500/15', text: 'text-red-400' },
  safety: { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  environmental: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  logistics: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  operational: { bg: 'bg-slate-500/15', text: 'text-slate-400' },
};

export default function OperationalAlertsPanel({ isOpen, onClose, alerts, onAcknowledge, onInvestigate, sideOffset = 0 }: OperationalAlertsPanelProps) {
  const [activeTab, setActiveTab] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const unacknowledged = useMemo(() => alerts.filter(a => !a.acknowledged), [alerts]);

  const filtered = useMemo(() => {
    if (activeTab === 'All') return unacknowledged;
    return unacknowledged.filter(a => a.severity === activeTab.toLowerCase());
  }, [unacknowledged, activeTab]);

  const criticalCount = unacknowledged.filter(a => a.severity === 'critical').length;
  const warningCount = unacknowledged.filter(a => a.severity === 'warning').length;
  const infoCount = unacknowledged.filter(a => a.severity === 'info').length;

  const countMap: Record<string, number> = {
    All: unacknowledged.length,
    Critical: criticalCount,
    Warning: warningCount,
    Info: infoCount,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-14 bottom-0 w-[380px] bg-[#080e20]/98 backdrop-blur-xl border-l border-[#1e2d52] z-40 flex flex-col shadow-2xl fade-in" style={{ right: sideOffset, transition: 'right 0.25s ease' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d52]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <Bell className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Operational Alerts</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">{unacknowledged.length} total · {criticalCount} critical</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Severity Tabs */}
      <div className="flex px-5 py-2 border-b border-[#1e2d52] gap-1">
        {SEVERITY_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${
              activeTab === tab
                ? tab === 'Critical' ? 'bg-red-500/20 text-red-400'
                  : tab === 'Warning' ? 'bg-amber-500/20 text-amber-400'
                  : tab === 'Info' ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-purple-500/20 text-purple-400'
                : 'text-slate-500 hover:text-slate-400 hover:bg-white/5'
            }`}
          >
            {tab}
            <span className="text-[9px] opacity-70">({countMap[tab]})</span>
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No alerts in this category</p>
          </div>
        )}

        {filtered.map(alert => {
          const isExpanded = expandedId === alert.id;
          const typeBadge = TYPE_BADGES[alert.type] || TYPE_BADGES.operational;
          const sevColor = alert.severity === 'critical' ? 'border-red-500/30 bg-red-500/5'
            : alert.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-blue-500/30 bg-blue-500/5';
          const dotColor = alert.severity === 'critical' ? 'bg-red-500'
            : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500';

          return (
            <div key={alert.id} className={`rounded-xl border ${sevColor} overflow-hidden transition-all`}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                className="w-full text-left p-3.5 hover:brightness-110 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${typeBadge.bg} ${typeBadge.text}`}>
                        {alert.type.replace(/_/g, ' ')}
                      </span>
                      {alert.location_tag && (
                        <span className="text-[9px] text-slate-600 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {alert.location_tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-300 leading-relaxed">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] text-slate-600">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      <span className="text-[9px] text-slate-600">{alert.mine_name?.replace(' Open Cast Mine', '').replace(' Mine', '')}</span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-600 mt-1" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 mt-1" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3.5 pb-3.5 space-y-3 border-t border-[#1e2d52]/50 pt-3 fade-in">
                  {/* Team Assignment */}
                  {alert.team_assigned && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <Users className="w-3 h-3 text-cyan-400" />
                      <span className="text-slate-400">Assigned to:</span>
                      <span className="text-cyan-400 font-medium">{alert.team_assigned}</span>
                    </div>
                  )}

                  {/* Location */}
                  {alert.location_tag && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-400">Location:</span>
                      <span className="text-slate-300">{alert.location_tag}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onAcknowledge?.(alert.id); }}
                      className="flex-1 py-1.5 text-[10px] font-medium rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onInvestigate?.(alert); }}
                      className="flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-medium rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <Eye className="w-3 h-3" /> Investigate
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
