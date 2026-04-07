'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import AIAdvisoryPanel from '@/components/panels/AIAdvisoryPanel';
import OperationalAlertsPanel from '@/components/panels/OperationalAlertsPanel';
import type { Alert, Advisory, KPIReading } from '@/types';
import { alertsApi, advisoryApi, workOrdersApi } from '@/services/api';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, setAuth, user } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [advisories, setAdvisories] = useState<Advisory[]>([]);
  const [kpiUpdates, setKpiUpdates] = useState<Record<string, Record<string, KPIReading>>>({});
  const [advisoryPanelOpen, setAdvisoryPanelOpen] = useState(false);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);

  // Hydrate auth from localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try { setAuth(JSON.parse(userStr), token); } catch { router.replace('/login'); }
    } else {
      router.replace('/login');
    }
  }, []);

  // Fetch initial data
  useEffect(() => {
    if (!isAuthenticated) return;
    alertsApi.list().then((r) => setAlerts(r.data)).catch(() => {});
    advisoryApi.list().then((r) => setAdvisories(r.data)).catch(() => {});
  }, [isAuthenticated]);

  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'alert') {
      setAlerts((prev) => [data.data, ...prev].slice(0, 100));
    } else if (data.type === 'advisory') {
      setAdvisories((prev) => [data.data, ...prev].slice(0, 100));
    } else if (data.type === 'kpi_update') {
      setKpiUpdates((prev) => ({
        ...prev,
        [data.mine_id]: data.data,
      }));
    }
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const handleAcknowledgeAlert = useCallback(async (id: string) => {
    try {
      await alertsApi.acknowledge(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } catch {}
  }, []);

  const handleAcknowledgeAdvisory = useCallback(async (id: string) => {
    try {
      await advisoryApi.acknowledge(id);
      setAdvisories(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as const } : a));
    } catch {}
  }, []);

  const handleResolveAdvisory = useCallback(async (id: string) => {
    try {
      await advisoryApi.resolve(id);
      setAdvisories(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a));
    } catch {}
  }, []);

  const handleAdvisoryAction = useCallback(async (action: { label: string; type: string }, advisory: Advisory) => {
    if (action.type === 'work_order' || action.type === 'schedule') {
      try {
        await workOrdersApi.create(advisory.mine_id, '', `${action.label}: ${advisory.root_cause}`, advisory.severity === 'critical' ? 'high' : 'medium');
      } catch {}
    } else if (action.type === 'view') {
      router.push(`/digital-twin/${advisory.mine_id}`);
    }
  }, [router]);

  const handleInvestigateAlert = useCallback((alert: Alert) => {
    if (alert.mine_id) {
      router.push(`/digital-twin/${alert.mine_id}`);
    }
  }, [router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050a18]">
        <div className="animate-pulse text-mine-amber">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a18]">
      <Sidebar />
      <TopBar
        wsConnected={connected}
        alerts={alerts}
        advisories={advisories}
        onToggleAdvisoryPanel={() => setAdvisoryPanelOpen(!advisoryPanelOpen)}
        onToggleAlertsPanel={() => setAlertsPanelOpen(!alertsPanelOpen)}
      />
      <main className="ml-64 mt-14 p-6">
        {typeof children === 'function'
          ? (children as any)({ alerts, advisories, kpiUpdates, wsConnected: connected })
          : children}
      </main>

      <AIAdvisoryPanel
        isOpen={advisoryPanelOpen}
        onClose={() => setAdvisoryPanelOpen(false)}
        advisories={advisories}
        onAcknowledge={handleAcknowledgeAdvisory}
        onResolve={handleResolveAdvisory}
        onAction={handleAdvisoryAction}
      />

      <OperationalAlertsPanel
        isOpen={alertsPanelOpen}
        onClose={() => setAlertsPanelOpen(false)}
        alerts={alerts}
        onAcknowledge={handleAcknowledgeAlert}
        onInvestigate={handleInvestigateAlert}
        sideOffset={advisoryPanelOpen ? 480 : 0}
      />
    </div>
  );
}
