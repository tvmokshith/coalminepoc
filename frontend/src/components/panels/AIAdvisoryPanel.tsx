'use client';

import { useState, useMemo } from 'react';
import type { Advisory } from '@/types';
import {
  X, Search, Brain, AlertTriangle, Clock, Target, TrendingUp,
  ChevronRight, ChevronDown, Shield, Zap, Wrench, Eye,
  Users, FileText, ArrowRight, Activity, BarChart3, CheckCircle
} from 'lucide-react';

interface AIAdvisoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  advisories: Advisory[];
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
  onAction?: (action: { label: string; type: string }, advisory: Advisory) => void;
}

type DetailTab = 'overview' | 'causal' | 'impact' | 'actions' | 'evidence';

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500', badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const CATEGORY_FILTERS = ['All', 'Equipment', 'Production', 'Logistics', 'Ehs', 'Finance', 'Esg', 'Hr'];

function RiskScoreCircle({ score }: { score: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#ef4444' : score >= 60 ? '#f59e0b' : '#22c55e';

  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0">
      <svg className="transform -rotate-90" width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#1e2d52" strokeWidth="5" />
        <circle cx="36" cy="36" r={radius} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white">{score}</span>
        <span className="text-[8px] text-slate-500 uppercase tracking-wider">Risk</span>
      </div>
    </div>
  );
}

export default function AIAdvisoryPanel({ isOpen, onClose, advisories, onAcknowledge, onResolve, onAction }: AIAdvisoryPanelProps) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedAdvisory, setSelectedAdvisory] = useState<Advisory | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleQuickAction = (action: { label: string; type: string }) => {
    if (!selectedAdvisory) return;
    if (onAction) {
      onAction(action, selectedAdvisory);
    }
    setActionFeedback(`${action.label} executed`);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const activeAdvisories = useMemo(() => {
    return advisories.filter(a => a.status === 'active');
  }, [advisories]);

  const filtered = useMemo(() => {
    return activeAdvisories.filter(a => {
      if (severityFilter !== 'All' && a.severity !== severityFilter.toLowerCase()) return false;
      if (categoryFilter !== 'All' && !a.category_tag?.toLowerCase().includes(categoryFilter.toLowerCase())) return false;
      if (search) {
        const q = search.toLowerCase();
        return a.root_cause.toLowerCase().includes(q) ||
               a.kpi_name.toLowerCase().includes(q) ||
               a.mine_name.toLowerCase().includes(q) ||
               a.overview_narrative?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeAdvisories, severityFilter, categoryFilter, search]);

  const criticalCount = activeAdvisories.filter(a => a.severity === 'critical').length;
  const warningCount = activeAdvisories.filter(a => a.severity === 'warning').length;

  if (!isOpen) return null;

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'causal', label: 'Causal Chain' },
    { id: 'impact', label: 'Impact' },
    { id: 'actions', label: 'Actions' },
    { id: 'evidence', label: 'Evidence' },
  ];

  return (
    <div className="fixed top-14 right-0 bottom-0 w-[480px] bg-[#080e20]/98 backdrop-blur-xl border-l border-[#1e2d52] z-40 flex flex-col shadow-2xl fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d52]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">AI Advisory Engine</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">{criticalCount} critical</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">{warningCount} warning</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Search + Filters */}
      <div className="px-5 py-3 border-b border-[#1e2d52] space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            type="text"
            placeholder="Search advisories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#0a1025] border border-[#1e2d52] rounded-lg text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['All', 'Critical', 'Warning'].map(s => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors whitespace-nowrap ${
                severityFilter === s
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                  : 'bg-transparent border-[#1e2d52] text-slate-500 hover:text-slate-400'
              }`}
            >
              {s}
            </button>
          ))}
          <span className="w-px bg-[#1e2d52] mx-1" />
          {CATEGORY_FILTERS.map(c => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors whitespace-nowrap ${
                categoryFilter === c
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                  : 'bg-transparent border-[#1e2d52] text-slate-500 hover:text-slate-400'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Advisory List / Detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedAdvisory ? (
          /* ── Detail View ── */
          <div className="p-5 space-y-4 fade-in">
            {/* Back button */}
            <button
              onClick={() => setSelectedAdvisory(null)}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mb-2"
            >
              <ChevronRight className="w-3 h-3 rotate-180" /> Back to list
            </button>

            {/* Header row */}
            <div className="flex items-start gap-4">
              <RiskScoreCircle score={selectedAdvisory.risk_score || 75} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${(SEVERITY_STYLES[selectedAdvisory.severity] || SEVERITY_STYLES.info).badge}`}>
                    {selectedAdvisory.severity}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {selectedAdvisory.priority_label || 'L3 Urgent'}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white leading-tight">{selectedAdvisory.kpi_name}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedAdvisory.mine_name} · {selectedAdvisory.category_tag}</p>
              </div>
            </div>

            {/* Key metrics row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#0a1025] rounded-lg p-2.5 border border-[#1e2d52]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span className="text-[9px] text-slate-500 uppercase">Time to Impact</span>
                </div>
                <span className="text-xs font-bold text-white">{selectedAdvisory.time_to_impact || '2-4 hours'}</span>
              </div>
              <div className="bg-[#0a1025] rounded-lg p-2.5 border border-[#1e2d52]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-red-400" />
                  <span className="text-[9px] text-slate-500 uppercase">Failure Prob</span>
                </div>
                <span className="text-xs font-bold text-white">{((selectedAdvisory.failure_probability || 0) * 100).toFixed(2)}%</span>
              </div>
              <div className="bg-[#0a1025] rounded-lg p-2.5 border border-[#1e2d52]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span className="text-[9px] text-slate-500 uppercase">Affected</span>
                </div>
                <span className="text-xs font-bold text-white">{selectedAdvisory.affected_count || 'N/A'}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#1e2d52]">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-slate-500 hover:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-4 fade-in">
              {activeTab === 'overview' && (
                <>
                  {/* Narrative */}
                  <div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedAdvisory.overview_narrative || selectedAdvisory.root_cause}
                    </p>
                  </div>

                  {/* Root Cause */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Root Cause</h4>
                    <div className="bg-[#0a1025] rounded-lg p-3 border border-[#1e2d52]">
                      <p className="text-xs text-slate-300">{selectedAdvisory.root_cause}</p>
                    </div>
                  </div>

                  {/* Trend Analysis */}
                  {selectedAdvisory.trend_analysis && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Trend Analysis</h4>
                      <div className="bg-[#0a1025] rounded-lg p-3 border border-[#1e2d52]">
                        <p className="text-xs text-slate-300 leading-relaxed">{selectedAdvisory.trend_analysis}</p>
                      </div>
                    </div>
                  )}

                  {/* Historical Context */}
                  {selectedAdvisory.historical_context && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Historical Context</h4>
                      <div className="bg-[#0a1025] rounded-lg p-3 border border-[#1e2d52]">
                        <p className="text-xs text-slate-300 leading-relaxed">{selectedAdvisory.historical_context}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'causal' && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Causal Chain Analysis</h4>
                  {(selectedAdvisory.causal_chain || []).map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {i + 1}
                        </div>
                        {i < (selectedAdvisory.causal_chain || []).length - 1 && (
                          <div className="w-px h-6 bg-[#1e2d52]" />
                        )}
                      </div>
                      <div className="bg-[#0a1025] rounded-lg p-2.5 border border-[#1e2d52] flex-1">
                        <p className="text-xs text-slate-300">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'impact' && (
                <div className="space-y-3">
                  <div className="bg-[#0a1025] rounded-lg p-3 border border-[#1e2d52]">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Impact Assessment</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{selectedAdvisory.impact}</p>
                  </div>
                  {selectedAdvisory.impact_details && Object.keys(selectedAdvisory.impact_details).length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedAdvisory.impact_details).map(([key, value]) => (
                        <div key={key} className="bg-[#0a1025] rounded-lg p-2.5 border border-[#1e2d52]">
                          <span className="text-[9px] text-slate-500 uppercase">{key.replace(/_/g, ' ')}</span>
                          <p className="text-xs font-bold text-white mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {(selectedAdvisory.affected_entities || []).length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Affected Entities</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedAdvisory.affected_entities.map((entity, i) => (
                          <span key={i} className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {entity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'actions' && (
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {(selectedAdvisory.actions || []).slice(0, 4).map((action, i) => {
                        const icons: Record<string, any> = {
                          work_order: Wrench, dispatch: Users, escalate: AlertTriangle,
                          view: Eye, schedule: Clock, procurement: FileText,
                          training: Users, logistics: Zap, plan: BarChart3,
                          analysis: Activity, alert: Shield, welfare: Users,
                        };
                        const Icon = icons[action.type] || Zap;
                        return (
                          <button
                            key={i}
                            onClick={() => handleQuickAction(action)}
                            className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0a1025] border border-[#1e2d52] hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors text-left"
                          >
                            <Icon className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-[11px] text-slate-300">{action.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preventive Actions */}
                  {(selectedAdvisory.preventive_actions || []).length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preventive Actions</h4>
                      <div className="space-y-1.5">
                        {selectedAdvisory.preventive_actions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/15">
                            <Shield className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                            <span className="text-[11px] text-slate-300">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Corrective Actions */}
                  {(selectedAdvisory.corrective_actions || []).length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Corrective Actions</h4>
                      <div className="space-y-1.5">
                        {selectedAdvisory.corrective_actions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15">
                            <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                            <span className="text-[11px] text-slate-300">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'evidence' && (
                <div className="space-y-3">
                  <div className="bg-[#0a1025] rounded-lg p-3 border border-[#1e2d52]">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Confidence Level</h4>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-[#1e2d52] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${(selectedAdvisory.confidence || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-white">{((selectedAdvisory.confidence || 0) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="bg-[#0a1025] rounded-lg p-3 border border-[#1e2d52]">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Data Sources</h4>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Activity className="w-3 h-3 text-blue-400" />
                        <span>Real-time KPI monitoring stream</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <BarChart3 className="w-3 h-3 text-green-400" />
                        <span>Historical pattern analysis</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <TrendingUp className="w-3 h-3 text-amber-400" />
                        <span>Predictive failure model v2.1</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Wrench className="w-3 h-3 text-purple-400" />
                        <span>Equipment sensor telemetry</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#0a1025] rounded-lg p-3 border border-[#1e2d52]">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Generated</h4>
                    <p className="text-xs text-slate-400">{new Date(selectedAdvisory.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="flex gap-2 pt-3 border-t border-[#1e2d52]">
              <button
                onClick={() => { onAcknowledge?.(selectedAdvisory.id); setSelectedAdvisory(null); }}
                className="flex-1 py-2 text-xs font-medium rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                Acknowledge
              </button>
              <button
                onClick={() => { onResolve?.(selectedAdvisory.id); setSelectedAdvisory(null); }}
                className="flex-1 py-2 text-xs font-medium rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors"
              >
                Mark Resolved
              </button>
            </div>
          </div>
        ) : (
          /* ── List View ── */
          <div className="p-3 space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Brain className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No matching advisories</p>
              </div>
            )}
            {filtered.map(adv => {
              const styles = SEVERITY_STYLES[adv.severity] || SEVERITY_STYLES.info;
              return (
                <button
                  key={adv.id}
                  onClick={() => { setSelectedAdvisory(adv); setActiveTab('overview'); }}
                  className={`w-full text-left p-3.5 rounded-xl border ${styles.border} ${styles.bg} hover:brightness-110 transition-all group`}
                >
                  <div className="flex items-start gap-3">
                    {/* Risk score mini circle */}
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <svg className="transform -rotate-90" width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="#1e2d52" strokeWidth="3" />
                        <circle cx="20" cy="20" r="16" fill="none"
                          stroke={adv.risk_score >= 80 ? '#ef4444' : adv.risk_score >= 60 ? '#f59e0b' : '#22c55e'}
                          strokeWidth="3"
                          strokeDasharray={2 * Math.PI * 16}
                          strokeDashoffset={2 * Math.PI * 16 * (1 - (adv.risk_score || 50) / 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                        {adv.risk_score || 50}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                        <span className="text-xs font-semibold text-white truncate">{adv.kpi_name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{adv.root_cause}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">{adv.category_tag || adv.kpi_category}</span>
                        <span className="text-[9px] text-slate-600">{adv.mine_name?.replace(' Open Cast Mine', '').replace(' Mine', '')}</span>
                        <span className="text-[9px] text-slate-600 ml-auto">{new Date(adv.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 transition-colors mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Feedback Toast */}
      {actionFeedback && (
        <div className="absolute bottom-4 left-4 right-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium shadow-2xl backdrop-blur-lg flex items-center gap-2 fade-in">
          <CheckCircle className="w-4 h-4" />
          {actionFeedback}
        </div>
      )}
    </div>
  );
}
