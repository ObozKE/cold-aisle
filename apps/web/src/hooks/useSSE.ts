'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface TelemetryStreamEvent {
  device: string;
  ts: string;
  raw: {
    cold_aisle_temp_c: number;
    cold_aisle_rh: number;
    hot_aisle_temp_c: number;
    hot_aisle_rh: number;
    coolant_pressure_bar: number;
    cdu_reservoir_distance_cm: number;
    diesel_distance_cm: number;
    rack_it_kw: number;
  };
  derived: {
    cdu_reservoir_fill_cm: number;
    cdu_reservoir_level_pct: number;
    cdu_reservoir_litres: number;
    diesel_fill_cm: number;
    diesel_level_pct: number;
    diesel_litres: number;
    diesel_burn_rate_lph: number;
    diesel_runtime_hours: number;
    aisle_delta_t_c: number;
  };
  pue?: {
    it_kw: number;
    cooling_kw: number;
    ups_loss_kw: number;
    other_kw: number;
    total_kw: number;
    pue: number;
  };
}

export interface AlertStreamEvent {
  type: 'opened' | 'escalated' | 'resolved';
  alert: any;
}

export function useSSE() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryStreamEvent | null>(null);
  const [latestAlert, setLatestAlert] = useState<AlertStreamEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:4000';
    const sseUrl = `${ingestUrl}/api/v1/stream`;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus('connecting');
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setStatus('connected');
    });

    es.addEventListener('telemetry', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestTelemetry(data);
      } catch (err) {
        console.error('Failed to parse telemetry SSE payload', err);
      }
    });

    es.addEventListener('alert', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLatestAlert(data);
      } catch (err) {
        console.error('Failed to parse alert SSE payload', err);
      }
    });

    es.onerror = () => {
      setStatus('disconnected');
      es.close();
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 3000);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { status, latestTelemetry, latestAlert };
}
