'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { WS_URL } from '@/services/api';

export function useWebSocket(onMessage: (data: unknown) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ws = new WebSocket(`${WS_URL}?client_id=${clientId}`);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        // Unwrap batch frames from the server
        if (msg.type === 'batch') {
          for (const update of msg.updates) {
            onMessageRef.current(update);
          }
        } else {
          onMessageRef.current(msg);
        }
      } catch { /* ignore malformed frames */ }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 30_000);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { connected };
}
