'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Bell, Brain, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import type { Alert, Advisory } from '@/types';

interface TopBarProps {
  wsConnected: boolean;
  alerts: Alert[];
  advisories: Advisory[];
  onToggleAdvisoryPanel?: () => void;
  onToggleAlertsPanel?: () => void;
}

export default function TopBar({ wsConnected, alerts, advisories, onToggleAdvisoryPanel, onToggleAlertsPanel }: TopBarProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showAlerts, setShowAlerts] = useState(false);

  const unackAlerts = alerts.filter((a) => !a.acknowledged).length;
  const activeAdvisories = advisories.filter((a) => a.status === 'active').length;

  return (
    <header className="h-14 bg-[#0a1025]/90 backdrop-blur-lg border-b border-[#1e2d52] flex items-center px-6 justify-between fixed top-0 left-64 right-0 z-30">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <Wifi className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={`text-xs ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
            {wsConnected ? 'Live' : 'Offline'}
          </span>
        </div>
        <span className="text-xs text-slate-600">|</span>
        <span className="text-xs text-slate-500">
          {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* AI Advisory Button */}
        <button
          onClick={() => onToggleAdvisoryPanel ? onToggleAdvisoryPanel() : router.push('/advisory')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all text-xs font-medium"
        >
          <Brain className="w-3.5 h-3.5" />
          AI Advisory
          {activeAdvisories > 0 && (
            <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {activeAdvisories}
            </span>
          )}
        </button>

        {/* Alerts */}
        <div className="relative">
          <button
            onClick={() => onToggleAlertsPanel ? onToggleAlertsPanel() : setShowAlerts(!showAlerts)}
            className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <Bell className="w-4 h-4 text-slate-400" />
            {unackAlerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {unackAlerts > 9 ? '9+' : unackAlerts}
              </span>
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 top-10 w-80 max-h-96 overflow-y-auto glass-card shadow-2xl p-2 fade-in">
              <p className="text-xs font-semibold text-slate-400 p-2">Recent Alerts</p>
              {alerts.slice(0, 10).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded-lg mb-1 text-xs ${
                    alert.severity === 'critical'
                      ? 'bg-red-500/10 border border-red-500/20'
                      : alert.severity === 'warning'
                      ? 'bg-amber-500/10 border border-amber-500/20'
                      : 'bg-blue-500/10 border border-blue-500/20'
                  }`}
                >
                  <p className="text-slate-300">{alert.message}</p>
                  <p className="text-slate-600 mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="text-xs text-slate-600 p-2">No alerts</p>
              )}
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={() => { logout(); router.push('/login'); }}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
        </button>
      </div>
    </header>
  );
}
