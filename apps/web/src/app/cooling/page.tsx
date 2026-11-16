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
  RotateCw,
  Waves,
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
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-noc-border bg-noc-panel p-5 backdrop-blur-md shadow-lg md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
              COOLING DISTRIBUTION UNIT (CDU) & PRIMARY LOOP
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            In-Row CDU Primary Loop Alpha • Liquid Expansion Reservoir & Loop Pressure Transducers
          </p>
        </div>

        {/* Compound Leak Status Pill */}
        <div
          className={`flex items-center gap-2.5 rounded-lg border px-4 py-2 font-mono text-xs shadow-md transition-all ${
            isLeakSuspected
              ? 'border-rose-500 bg-rose-950/50 text-rose-300 animate-pulse font-bold shadow-[0_0_15px_rgba(244,63,94,0.3)]'
              : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
          }`}
        >
          {isLeakSuspected ? (
            <>
              <AlertOctagon className="h-4 w-4 text-rose-400 animate-spin" />
              <span>COMPOUND LEAK SUSPICION: CRITICAL</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>LOOP HYDRAULIC INTEGRITY: NOMINAL</span>
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
          subValue={`${litres.toFixed(1)} L / 80.0 L`}
          benchmark="Crit: < 15%"
          status={isLevelCritical ? 'critical' : isLevelWarn ? 'warn' : 'normal'}
          icon={<Droplet className="h-4 w-4" />}
        />

        <KpiCard
          title="Coolant Loop Pressure"
          value={pressure.toFixed(2)}
          unit="bar"
          subValue="Nominal: 2.4 - 2.8 bar"
          benchmark="Crit: < 1.00 bar"
          status={pressure < 1.0 ? 'critical' : pressure < 1.5 ? 'warn' : 'normal'}
          icon={<Gauge className="h-4 w-4" />}
        />

        <KpiCard
          title="Ultrasonic Headspace"
          value={distanceCm.toFixed(1)}
          unit="cm"
          subValue="Probe HC-SR04 #1"
          benchmark="Max: 40.0 cm"
          status="neutral"
          icon={<Activity className="h-4 w-4" />}
        />

        <KpiCard
          title="CDU Circulating Pumps"
          value="PUMP-1 & 2"
          unit="DUAL"
          subValue="Active Duty / Standby"
          benchmark="3,200 RPM"
          status={isLeakSuspected ? 'critical' : 'normal'}
          icon={<RotateCw className={`h-4 w-4 ${isLeakSuspected ? 'text-rose-400' : 'animate-spin text-cyan-400'}`} style={{ animationDuration: '6s' }} />}
        />
      </div>

      {/* Tank Reservoir Graphic & Pressure Trend Graph */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Liquid Tank Visualizer */}
        <div className="flex flex-col items-center justify-between rounded-xl border border-noc-border bg-noc-panel p-5 backdrop-blur-md shadow-md">
          <div className="w-full text-left">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                <Waves className="h-3.5 w-3.5 text-cyan-400" />
                CDU Expansion Tank
              </h2>
              <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
                MODEL: CDU-01
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              In-Row Closed Loop Primary Reservoir
            </p>
          </div>

          {/* Graphical Tank Column with Liquid Wave Surface */}
          <div className="my-5 flex items-center gap-6">
            <div className="relative h-60 w-28 rounded-xl border-2 border-slate-700 bg-slate-950/90 p-1.5 shadow-2xl overflow-hidden">
              {/* Glass Reflection Highlight */}
              <div className="absolute top-0 bottom-0 left-2 w-3 bg-gradient-to-r from-white/10 to-transparent z-20 pointer-events-none" />

              {/* Tick Marks on Left Edge */}
              <div className="absolute top-2 bottom-2 left-1 flex flex-col justify-between text-[8px] font-mono text-slate-600 z-10 pointer-events-none">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>

              {/* Fill Column */}
              <div
                className={`absolute bottom-1.5 left-1.5 right-1.5 rounded-b-lg transition-all duration-700 ease-out overflow-hidden ${
                  levelPct < 15
                    ? 'bg-gradient-to-t from-rose-700 via-rose-600 to-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                    : levelPct < 30
                    ? 'bg-gradient-to-t from-amber-700 via-amber-600 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : 'bg-gradient-to-t from-cyan-700 via-cyan-500 to-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                }`}
                style={{ height: `${Math.max(5, Math.min(96, levelPct))}%` }}
              >
                {/* Surface Liquid Wave Ripple */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-white/40 animate-pulse-subtle" />
              </div>

              {/* Threshold Reference Lines */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400 text-[9px] text-amber-300 font-mono pl-1.5 z-20"
                style={{ bottom: '30%' }}
              >
                Warn (30%)
              </div>
              <div
                className="absolute left-0 right-0 border-t border-dashed border-rose-500 text-[9px] text-rose-400 font-mono pl-1.5 z-20"
                style={{ bottom: '15%' }}
              >
                Crit (15%)
              </div>
            </div>

            {/* Readout stats */}
            <div className="space-y-3 font-mono text-xs">
              <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
                <span className="text-slate-500 block text-[10px] font-bold">CURRENT FILL</span>
                <span className="text-2xl font-black text-slate-100 tabular-nums">
                  {levelPct.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">STORED VOLUME</span>
                <span className="text-slate-200 font-bold text-sm">{litres.toFixed(1)} L</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">MAX CAPACITY</span>
                <span className="text-slate-400">80.0 Litres</span>
              </div>
            </div>
          </div>

          <div className="w-full text-center text-[11px] text-slate-500 font-mono border-t border-slate-800/80 pt-3">
            Coolant: Distilled Demineralized Water + 25% Inhibited Propylene Glycol
          </div>
        </div>

        {/* Right: Pressure History Area Chart */}
        <div className="col-span-2 rounded-xl border border-noc-border bg-noc-panel p-5 backdrop-blur-md shadow-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <Gauge className="h-4 w-4 text-cyan-400" />
                Coolant Loop Hydraulic Pressure Trend
              </h2>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Secondary Loop Supply Manifold • Nominal: 2.6 bar • Warn: &lt;1.5 bar • Crit: &lt;1.0 bar
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-xs text-slate-400">Current:</span>
              <span className="rounded bg-slate-900 px-2.5 py-1 text-sm font-bold text-cyan-300 border border-cyan-800/50 tabular-nums">
                {pressure.toFixed(2)} bar
              </span>
            </div>
          </div>

          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={pressureHistory.map((d) => ({
                  time: d.time_bucket
                    ? new Date(d.time_bucket).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Africa/Nairobi',
                      })
                    : '',
                  pressure: Number(d.pressure_bar),
                }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0.0, 3.5]}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.toFixed(1)}
                />
                <ReferenceLine
                  y={1.5}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Warn 1.5 bar',
                    fill: '#f59e0b',
                    fontSize: 9,
                    position: 'insideTopLeft',
                  }}
                />
                <ReferenceLine
                  y={1.0}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Crit 1.0 bar',
                    fill: '#ef4444',
                    fontSize: 9,
                    position: 'insideBottomLeft',
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090d16',
                    borderColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(value: any) => [`${Number(value).toFixed(2)} bar`, 'Loop Pressure']}
                />
                <Area
                  type="monotone"
                  dataKey="pressure"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
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
