'use client';

import React, { useState, useEffect } from 'react';
import { useSSE } from '../../hooks/useSSE';
import { formatEATDateTime, formatEAT } from '../../lib/utils';
import {
  Cpu,
  Radio,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Server,
} from 'lucide-react';

export default function DevicesPage() {
  const { latestTelemetry } = useSSE();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:4000';

  const loadDevices = async () => {
    try {
      const res = await fetch(`${ingestUrl}/api/v1/devices`);
      const data = await res.json();
      setDevices(data.devices || []);
    } catch (err) {
      console.error('Failed to load devices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, [ingestUrl]);

  // Refresh upon receiving live telemetry packet
  useEffect(() => {
    if (latestTelemetry) {
      loadDevices();
    }
  }, [latestTelemetry]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-noc-border bg-noc-panel p-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
            TELEMETRY SENSOR HARDWARE & VIRTUAL TWIN NODES
          </h1>
          <p className="text-xs text-slate-400">
            Microcontroller registration • Heartbeat watchdog & stale packet detection
          </p>
        </div>

        <button
          onClick={loadDevices}
          className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-3 py-1.5 font-mono text-xs text-slate-300 hover:bg-slate-700/80"
        >
          <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
          <span>Refresh Hardware Status</span>
        </button>
      </div>

      {/* Devices Table */}
      <div className="overflow-hidden rounded-lg border border-noc-border bg-noc-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-noc-border bg-slate-900/80 text-[11px] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Device ID & Name</th>
                <th className="py-3 px-4">Campus / Hall</th>
                <th className="py-3 px-4">Firmware</th>
                <th className="py-3 px-4">Cadence</th>
                <th className="py-3 px-4">Sensors</th>
                <th className="py-3 px-4">Last Seen (EAT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No registered devices found.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const isOnline = device.status === 'online';
                  const isStale = device.status === 'stale';

                  return (
                    <tr
                      key={device.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isStale ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`flex items-center gap-1.5 font-semibold ${
                            isOnline
                              ? 'text-emerald-400'
                              : isStale
                              ? 'text-amber-400 animate-pulse'
                              : 'text-slate-500'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isOnline
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                                : isStale
                                ? 'bg-amber-400'
                                : 'bg-slate-500'
                            }`}
                          />
                          {device.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Device ID & Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-200">{device.name}</div>
                        <div className="text-[11px] text-cyan-400">{device.id}</div>
                      </td>

                      {/* Campus / Hall */}
                      <td className="py-3 px-4 text-slate-300">
                        {device.site_code} / {device.hall_name}
                      </td>

                      {/* Firmware */}
                      <td className="py-3 px-4">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-mono">
                          {device.firmware_version}
                        </span>
                      </td>

                      {/* Cadence */}
                      <td className="py-3 px-4 text-slate-300 tabular-nums">
                        {device.publish_interval_sec}s interval
                      </td>

                      {/* Sensors */}
                      <td className="py-3 px-4 text-slate-300 tabular-nums">
                        {device.sensor_count} channels
                      </td>

                      {/* Last Seen */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {device.last_seen_at ? formatEATDateTime(device.last_seen_at) : 'Never'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
