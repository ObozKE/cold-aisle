'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSSE } from '../hooks/useSSE';
import { KpiCard } from '../components/KpiCard';
import { PueGauge } from '../components/PueGauge';
import { PueChart, PueSamplePoint } from '../components/PueChart';
import { formatEAT } from '../lib/utils';
import {
  Thermometer,
  AlertTriangle,
  Fuel,
  Cpu,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

export default function OverviewPage() {
  const { status: sseStatus, latestTelemetry, latestAlert } = useSSE();

  // Local state initialized with sensible defaults
  const [summaryData, setSummaryData] = useState<any>(null);
  const [pueHistory, setPueHistory] = useState<PueSamplePoint[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:4000';

  // Initial load of summary & alerts
  useEffect(() => {
    async function loadData() {
      try {
        const [sumRes, histRes, alertsRes] = await Promise.all([
          fetch(`${ingestUrl}/api/v1/telemetry/summary`).then((r) => r.json()),
          fetch(`${ingestUrl}/api/v1/telemetry/pue-history?hours=1`).then((r) => r.json()),
          fetch(`${ingestUrl}/api/v1/alerts?state=firing&limit=5`).then((r) => r.json()),
        ]);

        setSummaryData(sumRes);
        setPueHistory(histRes.samples || []);
        setActiveAlerts(alertsRes.alerts || []);
      } catch (err) {
        console.error('Failed to load initial summary data', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 10000); // 10s poll fallback
    return () => clearInterval(interval);
  }, [ingestUrl]);

  // Merge live SSE telemetry
  const livePue = latestTelemetry?.pue?.pue ?? summaryData?.latestPue?.pue ?? 1.411;
  const liveColdTemp = latestTelemetry?.raw.cold_aisle_temp_c ?? summaryData?.readings?.cold_aisle_temp_c ?? 22.4;
  const liveDieselRuntime = latestTelemetry?.derived.diesel_runtime_hours ?? 26.9;
  const liveDieselLitres = latestTelemetry?.derived.diesel_litres ?? 1762.0;
  const liveItKw = latestTelemetry?.raw.rack_it_kw ?? summaryData?.readings?.rack_it_kw ?? 7.8;

  // React to live alert events
  useEffect(() => {
    if (latestAlert) {
      if (latestAlert.type === 'opened') {
        setActiveAlerts((prev) => [latestAlert.alert, ...prev.filter((a) => a.id !== latestAlert.alert.id)]);
      } else if (latestAlert.type === 'resolved') {
        setActiveAlerts((prev) => prev.filter((a) => a.id !== latestAlert.alert.id));
      }
    }
  }, [latestAlert]);

  const activeCritical = activeAlerts.filter((a) => a.severity === 'critical').length;
  const activeWarn = activeAlerts.filter((a) => a.severity === 'warn').length;

  return (
    <div className="space-y-6">
      {/* Top Facility Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-noc-border bg-noc-panel p-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
            DATA HALL ALPHA & BETA TELEMETRY TWIN
          </h1>
          <p className="text-xs text-slate-400">
            Primary Facility NOC Dashboard • High-Density In-Row Cooling & Power Infrastructure
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-mono">
            <span className="text-slate-400">FACILITY STATUS:</span>
            {activeCritical > 0 ? (
              <span className="flex items-center gap-1 font-bold text-rose-400 animate-pulse">
                <ShieldAlert className="h-4 w-4" /> CRITICAL INCIDENT ({activeCritical})
              </span>
            ) : activeWarn > 0 ? (
              <span className="flex items-center gap-1 font-bold text-amber-400">
                <AlertTriangle className="h-4 w-4" /> WARNING ({activeWarn})
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> OPTIMAL
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Avg Cold-Aisle Supply"
          value={liveColdTemp.toFixed(1)}
          unit="°C"
          subValue="ASHRAE Recommended: 18 - 27 °C"
          status={liveColdTemp > 32 ? 'critical' : liveColdTemp > 27 ? 'warn' : 'normal'}
          icon={<Thermometer className="h-4 w-4" />}
        />

        <KpiCard
          title="Active Facility Alerts"
          value={activeAlerts.length}
          subValue={`${activeCritical} Critical • ${activeWarn} Warning`}
          status={activeCritical > 0 ? 'critical' : activeWarn > 0 ? 'warn' : 'normal'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />

        <KpiCard
          title="Diesel Generator Autonomy"
          value={liveDieselRuntime.toFixed(1)}
          unit="hrs"
          subValue={`${liveDieselLitres.toFixed(0)} L stored fuel`}
          status={liveDieselRuntime < 2 ? 'critical' : liveDieselRuntime < 4 ? 'warn' : 'normal'}
          icon={<Fuel className="h-4 w-4" />}
        />

        <KpiCard
          title="Monitored IT Load"
          value={liveItKw.toFixed(1)}
          unit="kW"
          subValue="Telemetry Rack Loop Alpha"
          status="neutral"
          icon={<Cpu className="h-4 w-4" />}
        />
      </div>

      {/* Main PUE Efficiency & Trend Center */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Circular PUE Gauge */}
        <div className="flex flex-col items-center justify-between rounded-lg border border-noc-border bg-noc-panel p-5">
          <div className="w-full text-left">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Live Facility PUE
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Total Facility Power / IT Power Ratio
            </p>
          </div>

          <PueGauge pue={livePue} />

          <div className="w-full border-t border-slate-800/80 pt-3 text-center">
            <Link
              href="/power"
              className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
            >
              <span>Inspect Power & UPS Loss Model</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Right: 1-Hour PUE Trend Graph */}
        <div className="col-span-2 rounded-lg border border-noc-border bg-noc-panel p-5">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                1-Hour Rolling PUE Trend
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                Continuous Time-Bucketed Facility Efficiency (Africa/Nairobi)
              </p>
            </div>
            <span className="font-mono text-xs text-cyan-400">
              Latest: {livePue.toFixed(3)}
            </span>
          </div>

          <PueChart data={pueHistory} />
        </div>
      </div>

      {/* Device Health Strip & Active Alerts Quick List */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Device Health Strip */}
        <div className="rounded-lg border border-noc-border bg-noc-panel p-4">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Device Health Strip
            </span>
            <Link href="/devices" className="text-xs text-cyan-400 hover:text-cyan-300">
              View All
            </Link>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-200">sim-node-01 (Simulator)</span>
              </div>
              <span className="text-emerald-400 font-semibold">ONLINE</span>
            </div>

            <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/40 p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <span className="text-slate-200">wokwi-esp32-01 (Wokwi ESP32)</span>
              </div>
              <span className="text-slate-400">STANDBY / READY</span>
            </div>
          </div>
        </div>

        {/* Active Alert Feed */}
        <div className="col-span-2 rounded-lg border border-noc-border bg-noc-panel p-4">
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Active NOC Alert Feed
            </span>
            <Link href="/alerts" className="text-xs text-cyan-400 hover:text-cyan-300">
              Open Alerts Table →
            </Link>
          </div>

          {activeAlerts.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded border border-dashed border-slate-800 text-xs font-mono text-slate-500">
              ✓ No active firing alerts. All environmental & power parameters normal.
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between rounded border p-2.5 text-xs font-mono ${
                    a.severity === 'critical'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        a.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
                      }`}
                    >
                      {a.severity}
                    </span>
                    <span>{a.subject}</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{formatEAT(a.opened_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
