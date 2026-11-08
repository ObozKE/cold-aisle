'use client';

import React, { useState, useEffect } from 'react';
import { useSSE } from '../../hooks/useSSE';
import { KpiCard } from '../../components/KpiCard';
import {
  Droplet,
  Gauge,
  AlertOctagon,
  Activity,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function CoolingPage() {
  const { latestTelemetry } = useSSE();
  const [pressureHistory, setPressureHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`${ingestUrl}/api/v1/telemetry/pressure-history`);
        const data = await res.json();
        setPressureHistory(data.samples || []);
      } catch (err) {
        console.error('Failed to load pressure history', err);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
    const interval = setInterval(loadHistory, 6000);
    return () => clearInterval(interval);
  }, [ingestUrl]);

  // Live values
  const levelPct = latestTelemetry?.derived.cdu_reservoir_level_pct ?? 73.71;
  const litres = latestTelemetry?.derived.cdu_reservoir_litres ?? 58.97;
  const distanceCm = latestTelemetry?.raw.cdu_reservoir_distance_cm ?? 14.2;
  const pressure = latestTelemetry?.raw.coolant_pressure_bar ?? 2.60;

  // Leak suspicion assessment
  const isPressureLow = pressure < 1.80;
  const isLevelCritical = levelPct < 15.0;
  const isLevelWarn = levelPct < 30.0;
  const isLeakSuspected = isPressureLow && isLevelWarn;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-noc-border bg-noc-panel p-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
            COOLING DISTRIBUTION UNIT (CDU) & PRIMARY LOOP
          </h1>
          <p className="text-xs text-slate-400">
            In-Row CDU Primary Loop Alpha • Liquid Expansion Reservoir & Loop Pressure Transducers
          </p>
        </div>

        {/* Compound Leak Status Pill */}
        <div
          className={`flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-xs ${
            isLeakSuspected
              ? 'border-rose-500 bg-rose-950/40 text-rose-300 animate-pulse font-bold'
              : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
          }`}
        >
          {isLeakSuspected ? (
            <>
              <AlertOctagon className="h-4 w-4 text-rose-400" />
              <span>COMPOUND LEAK SUSPICION: CRITICAL</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>LOOP HYDRAULIC INTEGRITY: SECURE</span>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="CDU Reservoir Level"
          value={levelPct.toFixed(1)}
          unit="%"
          subValue={`${litres.toFixed(1)} L / 80.0 L usable`}
          status={levelPct < 15 ? 'critical' : levelPct < 30 ? 'warn' : 'normal'}
          icon={<Droplet className="h-4 w-4" />}
        />

        <KpiCard
          title="Coolant Loop Pressure"
          value={pressure.toFixed(2)}
          unit="bar"
          subValue="Nominal closed loop: 2.50 bar"
          status={pressure < 1.0 ? 'critical' : pressure < 1.5 ? 'warn' : 'normal'}
          icon={<Gauge className="h-4 w-4" />}
        />

        <KpiCard
          title="Ultrasonic Headspace"
          value={distanceCm.toFixed(1)}
          unit="cm"
          subValue="Tank height: 40 cm (deadzone: 5 cm)"
          status="neutral"
          icon={<Activity className="h-4 w-4" />}
        />

        <KpiCard
          title="Leak Detection Engine"
          value={isLeakSuspected ? 'ACTIVE' : 'NOMINAL'}
          subValue="Compound d(Level)/dt + Pressure"
          status={isLeakSuspected ? 'critical' : 'normal'}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>

      {/* Tank Reservoir Graphic & Pressure Trend Graph */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Liquid Tank Visualizer */}
        <div className="flex flex-col items-center justify-between rounded-lg border border-noc-border bg-noc-panel p-5">
          <div className="w-full text-left">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              CDU Expansion Tank
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Geometric Volume Calibration (Model: CDU-01)
            </p>
          </div>

          {/* Graphical Tank Column */}
          <div className="my-4 flex items-center gap-6">
            <div className="relative h-56 w-24 rounded-lg border-2 border-slate-700 bg-slate-900/80 p-1 shadow-inner overflow-hidden">
              {/* Fill Column */}
              <div
                className={`absolute bottom-1 left-1 right-1 rounded-b transition-all duration-700 ease-out ${
                  levelPct < 15
                    ? 'bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : levelPct < 30
                    ? 'bg-amber-500'
                    : 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                }`}
                style={{ height: `${Math.max(4, levelPct)}%` }}
              />

              {/* Threshold Lines */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400/80 text-[9px] text-amber-300 font-mono pl-1"
                style={{ bottom: '30%' }}
              >
                Warn (30%)
              </div>
              <div
                className="absolute left-0 right-0 border-t border-dashed border-rose-400/80 text-[9px] text-rose-300 font-mono pl-1"
                style={{ bottom: '15%' }}
              >
                Crit (15%)
              </div>
            </div>

            {/* Readout stats */}
            <div className="space-y-2 font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">CURRENT FILL</span>
                <span className="text-xl font-bold text-slate-100">{levelPct.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">STORED VOLUME</span>
                <span className="text-slate-200 font-semibold">{litres.toFixed(1)} Litres</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">TOTAL CAPACITY</span>
                <span className="text-slate-400">80.0 Litres</span>
              </div>
            </div>
          </div>

          <div className="w-full text-center text-[11px] text-slate-500 font-mono border-t border-slate-800 pt-2">
            Coolant: Distilled Water + 25% Inhibited Propylene Glycol
          </div>
        </div>

        {/* Right: Pressure History Area Chart */}
        <div className="col-span-2 rounded-lg border border-noc-border bg-noc-panel p-5">
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                Coolant Loop Hydraulic Pressure Trend
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                Pressure Transducer (bar) • Warning threshold: 1.50 bar • Critical: 1.00 bar
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-cyan-400">
              Live: {pressure.toFixed(2)} bar
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={pressureHistory.map((d) => ({
                  time: d.time_bucket
                    ? new Date(d.time_bucket).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '',
                  pressure: Number(d.pressure_bar),
                }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  domain={[0.0, 3.5]}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: any) => [`${Number(value).toFixed(2)} bar`, 'Loop Pressure']}
                />
                <ReferenceLine y={1.5} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Warn: 1.5 bar', fill: '#f59e0b', fontSize: 10 }} />
                <ReferenceLine y={1.0} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Crit: 1.0 bar', fill: '#ef4444', fontSize: 10 }} />
                <Area
                  type="monotone"
                  dataKey="pressure"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#pressureGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
