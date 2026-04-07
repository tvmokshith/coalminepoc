'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { advisoryApi, workOrdersApi } from '@/services/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Advisory } from '@/types';
import { Brain, AlertTriangle, CheckCircle, Clock, ArrowRight, Filter, Wrench, Users, Eye, Zap } from 'lucide-react';

export default function AdvisoryPage() {
  const router = useRouter();
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [selectedAdv, setSelectedAdv] = useState<Advisory | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleAction = async (action: { label: string; type: string }, adv: Advisory) => {
    if (action.type === 'work_order') {
      try {
        await workOrdersApi.create(adv.mine_id, '', `${action.label}: ${adv.root_cause}`, adv.severity === 'critical' ? 'high' : 'medium');
        showFeedback(`Work order created: ${action.label}`);
      } catch {
        showFeedback('Failed to create work order');
      }
    } else if (action.type === 'dispatch') {
      showFeedback(`Team dispatched to ${adv.mine_name} for ${adv.kpi_name}`);
    } else if (action.type === 'escalate') {
      showFeedback(`Advisory escalated to management: ${adv.kpi_name}`);
    } else if (action.type === 'view') {
      router.push(`/digital-twin/${adv.mine_id}`);
    } else if (action.type === 'schedule') {
      try {
        await workOrdersApi.create(adv.mine_id, '', `Scheduled: ${action.label} - ${adv.root_cause}`, 'medium');
        showFeedback(`Maintenance scheduled: ${action.label}`);
      } catch {
        showFeedback('Failed to schedule maintenance');
      }
    } else {
      showFeedback(`Action executed: ${action.label}`);
    }
  };

  useEffect(() => {
    advisoryApi.list().then((r) => setAdvisories(r.data)).catch(() => {});
  }, []);

  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'advisory') {
      setAdvisories((prev) => [data.data, ...prev].slice(0, 100));
    }
  }, []);

  useWebSocket(handleWsMessage);

  const filtered = advisories.filter((a) =>
    filter === 'all' ? true : a.status === filter
  );

  const handleAcknowledge = async (id: string) => {
    try {
      await advisoryApi.acknowledge(id);
      setAdvisories((prev) => prev.map((a) => a.id === id ? { ...a, status: 'acknowledged' as const } : a));
    } catch {}
  };

  const handleResolve = async (id: string) => {
    try {
      await advisoryApi.resolve(id);
      setAdvisories((prev) => prev.map((a) => a.id === id ? { ...a, status: 'resolved' as const } : a));
    } catch {}
  };

  const sevIcon = (s: string) => s === 'critical' ? '🔴' : s === 'warning' ? '🟠' : '🔵';

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-400" />
              AI Advisory Engine
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">AI-generated insights with root causes, impacts, and recommendations</p>
          </div>
          <div className="flex items-center gap-2">
            {['all', 'active', 'acknowledged', 'resolved'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4 border-red-500/20">
            <p className="text-xs text-slate-500">Active</p>
            <p className="text-2xl font-bold text-red-400">{advisories.filter(a => a.status === 'active').length}</p>
          </div>
          <div className="glass-card p-4 border-amber-500/20">
            <p className="text-xs text-slate-500">Acknowledged</p>
            <p className="text-2xl font-bold text-amber-400">{advisories.filter(a => a.status === 'acknowledged').length}</p>
          </div>
          <div className="glass-card p-4 border-green-500/20">
            <p className="text-xs text-slate-500">Resolved</p>
            <p className="text-2xl font-bold text-green-400">{advisories.filter(a => a.status === 'resolved').length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Advisory List */}
          <div className="lg:col-span-2 space-y-3">
            {filtered.map((adv) => (
              <div
                key={adv.id}
                onClick={() => setSelectedAdv(adv)}
                className={`glass-card-hover p-4 cursor-pointer ${
                  selectedAdv?.id === adv.id ? 'border-purple-500/40' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{sevIcon(adv.severity)}</span>
                    <span className="text-xs font-semibold text-purple-400">{adv.kpi_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      {adv.mine_name?.replace(' Open Cast Mine', '').replace(' Mine', '')}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    adv.status === 'active' ? 'bg-red-500/10 text-red-400' :
                    adv.status === 'acknowledged' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-green-500/10 text-green-400'
                  }`}>
                    {adv.status}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-1">
                  <span className="text-slate-500 font-medium">Root Cause: </span>{adv.root_cause}
                </p>
                <p className="text-xs text-slate-400">
                  <span className="text-slate-500 font-medium">Impact: </span>{adv.impact}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-slate-600">{(adv.confidence * 100).toFixed(2)}% confidence</span>
                  <span className="text-[10px] text-slate-700">•</span>
                  <span className="text-[10px] text-slate-600">{new Date(adv.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="glass-card p-8 text-center">
                <Brain className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-600">No advisories found</p>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div className="glass-card p-5 border-purple-500/20 h-fit sticky top-20">
            {selectedAdv ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">Advisory Detail</h3>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    selectedAdv.severity === 'critical' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {selectedAdv.severity.toUpperCase()}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] text-slate-600 uppercase mb-1">KPI</p>
                  <p className="text-sm text-purple-400 font-medium">{selectedAdv.kpi_name}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-600 uppercase mb-1">Root Cause</p>
                  <p className="text-xs text-slate-300">{selectedAdv.root_cause}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-600 uppercase mb-1">Impact</p>
                  <p className="text-xs text-slate-300">{selectedAdv.impact}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-600 uppercase mb-1">Recommendation</p>
                  <p className="text-xs text-amber-400">{selectedAdv.recommendation}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-600 uppercase mb-1">Confidence</p>
                  <div className="w-full bg-slate-800 rounded-full h-2 mt-1">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${selectedAdv.confidence * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{(selectedAdv.confidence * 100).toFixed(2)}%</p>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-[#1e2d52]">
                  <p className="text-[10px] text-slate-600 uppercase">Actions</p>
                  {selectedAdv.actions?.map((action, i) => {
                    const icons: Record<string, any> = { work_order: Wrench, dispatch: Users, escalate: AlertTriangle, view: Eye, schedule: Clock };
                    const ActionIcon = icons[action.type] || Zap;
                    return (
                      <button
                        key={i}
                        onClick={() => handleAction(action, selectedAdv)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/20 transition-all flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2"><ActionIcon className="w-3 h-3" />{action.label}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    );
                  })}
                  {selectedAdv.status === 'active' && (
                    <button
                      onClick={() => handleAcknowledge(selectedAdv.id)}
                      className="w-full px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/20 transition-all"
                    >
                      Acknowledge
                    </button>
                  )}
                  {selectedAdv.status === 'acknowledged' && (
                    <button
                      onClick={() => handleResolve(selectedAdv.id)}
                      className="w-full px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs hover:bg-green-500/20 transition-all"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-600">Select an advisory to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium shadow-2xl backdrop-blur-lg flex items-center gap-2 fade-in">
          <CheckCircle className="w-4 h-4" />
          {actionFeedback}
        </div>
      )}
    </DashboardLayout>
  );
}
