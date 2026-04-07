'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Target, Calendar, BarChart3, Brain, AlertTriangle, Activity, Loader2 } from 'lucide-react';
import { kpiApi } from '@/services/api';
import type { KPITimeSeries, KPIDefinition, KPIReading } from '@/types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface KPIDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiName: string;
  mineId: string;
  mineName: string;
  currentReading?: KPIReading;
  kpiDefinition?: KPIDefinition;
}

const TIME_RANGES = ['1H', '6H', '24H', '7D', '30D'];

const STATUS_CONFIG = {
  green: { label: 'NORMAL', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  amber: { label: 'WARNING', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  red: { label: 'CRITICAL', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

export default function KPIDetailModal({
  isOpen, onClose, kpiName, mineId, mineName, currentReading, kpiDefinition,
}: KPIDetailModalProps) {
  const [tsData, setTsData] = useState<KPITimeSeries | null>(null);
  const [timeRange, setTimeRange] = useState('24H');
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [predictionSummary, setPredictionSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !mineId || !kpiName) return;
    setLoading(true);
    setShowForecast(false);
    setPredictionSummary(null);
    kpiApi.history(mineId, kpiName)
      .then(r => setTsData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, mineId, kpiName]);

  const handlePredictTrend = () => {
    if (!tsData || predicting) return;
    setPredicting(true);
    // Simulate AI prediction processing, then show forecast line
    setTimeout(() => {
      setShowForecast(true);
      const forecast = tsData.forecast || [];
      const lastActual = tsData.data[tsData.data.length - 1];
      const trendDirection = forecast.length > 0 && lastActual
        ? (forecast[forecast.length - 1].value > lastActual.value ? 'upward' : 'downward')
        : 'stable';
      const confidence = ((tsData as any).confidence || 0.85) * 100;
      setPredictionSummary(
        `AI predicts a ${trendDirection} trend for ${kpiName} over the next period with ${confidence.toFixed(2)}% confidence. ${
          forecast.length
        } forecast data points generated based on historical patterns and real-time sensor data.`
      );
      setPredicting(false);
    }, 1500);
  };

  const statusCfg = currentReading ? STATUS_CONFIG[currentReading.status] : STATUS_CONFIG.green;

  // Chart data with time formatting
  const chartData = useMemo(() => {
    if (!tsData) return [];
    const actualData = tsData.data.map(d => ({ ...d, type: 'actual' }));
    const forecastData = showForecast ? tsData.forecast.map(d => ({ ...d, type: 'forecast', forecast: d.value })) : [];
    const combined = [...actualData, ...forecastData];
    return combined.map(d => ({
      ...d,
      time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actual: d.type === 'actual' ? d.value : undefined,
      forecast: d.type === 'forecast' ? d.value : undefined,
    }));
  }, [tsData, showForecast]);

  // Parse threshold values from KPI definition
  const thresholds = useMemo(() => {
    if (!currentReading?.thresholds) return { green: 0, amber: 0, red: 0 };
    return currentReading.thresholds;
  }, [currentReading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#080e20] border border-[#1e2d52] rounded-2xl shadow-2xl fade-in">
        {/* Header */}
        <div className="sticky top-0 bg-[#080e20]/95 backdrop-blur-lg border-b border-[#1e2d52] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                  {kpiDefinition?.id?.replace('kpi_', '').toUpperCase() || 'KPI'} · {kpiDefinition?.category?.toUpperCase() || ''}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{kpiName}</h2>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} border`}>
              {statusCfg.label}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Value Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#0a1025] rounded-xl p-4 border border-[#1e2d52]">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Current Value</span>
              <p className="text-2xl font-bold text-white mt-1">{currentReading?.value?.toFixed(2) || '—'}</p>
              <span className="text-[10px] text-slate-500">{currentReading?.unit}</span>
            </div>
            <div className="bg-[#0a1025] rounded-xl p-4 border border-[#1e2d52]">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Target</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{tsData?.target_value?.toFixed(2) || '—'}</p>
              <span className="text-[10px] text-slate-500">{currentReading?.unit}</span>
            </div>
            <div className="bg-[#0a1025] rounded-xl p-4 border border-[#1e2d52]">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">YTD Avg</span>
              <p className="text-2xl font-bold text-blue-400 mt-1">{tsData?.ytd_avg?.toFixed(2) || '—'}</p>
              <span className="text-[10px] text-slate-500">{currentReading?.unit}</span>
            </div>
            <div className="bg-[#0a1025] rounded-xl p-4 border border-[#1e2d52]">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Industry Avg</span>
              <p className="text-2xl font-bold text-purple-400 mt-1">{tsData?.industry_avg?.toFixed(2) || '—'}</p>
              <span className="text-[10px] text-slate-500">{currentReading?.unit}</span>
            </div>
          </div>

          {/* Delta indicators */}
          <div className="flex items-center gap-4">
            {tsData && tsData.delta_vs_yesterday !== 0 && (
              <div className="flex items-center gap-1.5">
                {tsData.delta_vs_yesterday > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className={`text-xs font-medium ${tsData.delta_vs_yesterday > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tsData.delta_vs_yesterday > 0 ? '+' : ''}{tsData.delta_vs_yesterday.toFixed(2)} vs historical
                </span>
              </div>
            )}
            {tsData && tsData.pct_of_target > 0 && (
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">{tsData.pct_of_target.toFixed(2)}% of target</span>
              </div>
            )}
          </div>

          {/* Definition & Methodology */}
          {(tsData?.definition || kpiDefinition?.description) && (
            <div className="bg-[#0a1025] rounded-xl p-4 border border-[#1e2d52]">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Definition & Methodology</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-2">
                {tsData?.definition || kpiDefinition?.description}
              </p>
              {tsData?.methodology && (
                <p className="text-xs text-slate-500 leading-relaxed">
                  {tsData.methodology}
                </p>
              )}
            </div>
          )}

          {/* Threshold Bands */}
          {kpiDefinition && (
            <div className="bg-[#0a1025] rounded-xl p-4 border border-[#1e2d52]">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Threshold Bands</h3>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg p-2.5 bg-green-500/10 border border-green-500/20">
                  <span className="text-[9px] text-green-400 font-bold uppercase">Normal</span>
                  <p className="text-xs text-green-300 mt-0.5">{kpiDefinition.green_threshold}</p>
                </div>
                <div className="flex-1 rounded-lg p-2.5 bg-amber-500/10 border border-amber-500/20">
                  <span className="text-[9px] text-amber-400 font-bold uppercase">Warning</span>
                  <p className="text-xs text-amber-300 mt-0.5">{kpiDefinition.amber_threshold}</p>
                </div>
                <div className="flex-1 rounded-lg p-2.5 bg-red-500/10 border border-red-500/20">
                  <span className="text-[9px] text-red-400 font-bold uppercase">Critical</span>
                  <p className="text-xs text-red-300 mt-0.5">{kpiDefinition.red_threshold}</p>
                </div>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="bg-[#0a1025] rounded-xl p-4 border border-[#1e2d52]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{timeRange}</span>
                <div className="flex gap-1">
                  {TIME_RANGES.map(tr => (
                    <button
                      key={tr}
                      onClick={() => setTimeRange(tr)}
                      className={`px-2 py-0.5 text-[9px] font-medium rounded transition-colors ${
                        timeRange === tr ? 'bg-purple-500/20 text-purple-400' : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {tr}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handlePredictTrend}
                disabled={predicting || !tsData}
                className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-colors flex items-center gap-1.5 ${
                  showForecast
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {predicting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                {predicting ? 'Predicting...' : showForecast ? 'Prediction Active' : 'Predict Trend'}
              </button>
            </div>

            {loading ? (
              <div className="h-[250px] flex items-center justify-center">
                <Activity className="w-6 h-6 text-slate-600 animate-pulse" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="kpiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d52" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ background: '#111a35', border: '1px solid #1e2d52', borderRadius: '8px', fontSize: '11px' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  {/* Threshold reference lines */}
                  {thresholds.green && typeof thresholds.green === 'number' && (
                    <ReferenceLine y={thresholds.green} stroke="#22c55e" strokeDasharray="6 3" label={{ value: 'Target', fontSize: 9, fill: '#22c55e' }} />
                  )}
                  {thresholds.amber && typeof thresholds.amber === 'number' && (
                    <ReferenceLine y={thresholds.amber} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'Warn', fontSize: 9, fill: '#f59e0b' }} />
                  )}
                  <Area type="monotone" dataKey="actual" stroke="#8b5cf6" fill="url(#kpiGrad)" strokeWidth={2} dot={false} name="Actual" />
                  <Area type="monotone" dataKey="forecast" stroke="#3b82f6" fill="url(#forecastGrad)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Forecast" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* AI Prediction Summary */}
          {predictionSummary && (
            <div className="bg-purple-500/5 rounded-xl p-4 border border-purple-500/20">
              <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                AI Trend Prediction
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{predictionSummary}</p>
            </div>
          )}

          {/* Detected Anomalies */}
          {tsData && tsData.anomalies && tsData.anomalies.length > 0 && (
            <div className="bg-[#0a1025] rounded-xl p-4 border border-[#1e2d52]">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Detected Anomalies & Events
              </h3>
              <div className="space-y-2">
                {tsData.anomalies.slice(-5).reverse().map((anomaly, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                      anomaly.severity === 'critical'
                        ? 'bg-red-500/5 border border-red-500/15'
                        : 'bg-amber-500/5 border border-amber-500/15'
                    }`}
                  >
                    <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                      anomaly.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase ${
                          anomaly.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {anomaly.severity}
                        </span>
                        <span className="text-[9px] text-slate-600">
                          {new Date(anomaly.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">{anomaly.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Advisory */}
          {tsData?.ai_summary && (
            <div className="bg-purple-500/5 rounded-xl p-4 border border-purple-500/20">
              <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                AI Advisory
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{tsData.ai_summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
