'use client';

import React, { useState, useEffect } from 'react';
import { useSSE } from '../../hooks/useSSE';
import { KpiCard } from '../../components/KpiCard';
import {
  Thermometer,
  Layers,
  Zap,
  ArrowRightLeft,
  Flame,
  CheckCircle,
  AlertTriangle,
  Server,
} from 'lucide-react';

export default function HallViewPage() {
  const { latestTelemetry } = useSSE();
  const [selectedHall, setSelectedHall] = useState<'hall-alpha' | 'hall-beta'>('hall-alpha');
  const [racks, setRacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadRacks() {
      try {
        const res = await fetch(`${ingestUrl}/api/v1/telemetry/hall-racks`);
        const data = await res.json();
        setRacks(data.racks || []);
      } catch (err) {
        console.error('Failed to load hall racks', err);
      } finally {
        setLoading(false);
      }
    }

    loadRacks();
    const interval = setInterval(loadRacks, 6000);
    return () => clearInterval(interval);
  }, [ingestUrl]);

  // Adjust dynamically if live telemetry arrives
  const liveColdTemp = latestTelemetry?.raw.cold_aisle_temp_c;
  const liveHotTemp = latestTelemetry?.raw.hot_aisle_temp_c;
  const liveDeltaT = latestTelemetry?.derived.aisle_delta_t_c;

  const filteredRacks = racks.filter((r) => r.hall_code === selectedHall);

  // Helper for thermal heatmap color
  const getThermalClass = (temp: number) => {
    if (temp > 32) return 'border-rose-500/80 bg-gradient-to-b from-slate-900/90 to-rose-950/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)] ring-1 ring-rose-500/50';
    if (temp > 27) return 'border-amber-500/60 bg-gradient-to-b from-slate-900/90 to-amber-950/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
    if (temp > 25) return 'border-emerald-600/50 bg-gradient-to-b from-slate-900/90 to-emerald-950/20 text-emerald-200';
    if (temp >= 18) return 'border-emerald-500/40 bg-gradient-to-b from-slate-900/90 to-emerald-950/25 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
    return 'border-cyan-500/40 bg-gradient-to-b from-slate-900/90 to-cyan-950/25 text-cyan-300';
  };

  const avgInlet = liveColdTemp ?? 22.4;
  const avgExhaust = liveHotTemp ?? 35.1;
  const deltaT = liveDeltaT ?? (avgExhaust - avgInlet);

  return (
    <div className="space-y-6">
      {/* Header & Hall Selector */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-noc-border bg-noc-panel p-5 backdrop-blur-md shadow-lg md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
              DATA HALL THERMAL HEATMAP & AIRFLOW
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Per-rack thermal containment monitoring • ASHRAE TC 9.9 recommended envelope (18°C – 27°C)
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 p-1 font-mono text-xs shadow-md">
          <button
            onClick={() => setSelectedHall('hall-alpha')}
            className={`rounded-md px-3.5 py-1.5 font-bold transition-all ${
              selectedHall === 'hall-alpha'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hall Alpha (Cold Containment)
          </button>
          <button
            onClick={() => setSelectedHall('hall-beta')}
            className={`rounded-md px-3.5 py-1.5 font-bold transition-all ${
              selectedHall === 'hall-beta'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Hall Beta (HPC Liquid)
          </button>
        </div>
      </div>

      {/* Hall Thermal Overview KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Supply Inlet Temperature"
          value={avgInlet.toFixed(1)}
          unit="°C"
          subValue="ASHRAE Recommended Envelope"
          benchmark="Max: 27.0°C"
          status={avgInlet > 32 ? 'critical' : avgInlet > 27 ? 'warn' : 'normal'}
          icon={<Thermometer className="h-4 w-4" />}
        />

        <KpiCard
          title="Exhaust Hot Aisle"
          value={avgExhaust.toFixed(1)}
          unit="°C"
          subValue="CRAH Return Plenum"
          benchmark="Nominal: 35.0°C"
          status={avgExhaust > 48 ? 'critical' : avgExhaust > 40 ? 'warn' : 'normal'}
          icon={<Flame className="h-4 w-4" />}
        />

        <KpiCard
          title="Cold vs Hot Aisle ΔT"
          value={deltaT.toFixed(1)}
          unit="°C"
          subValue="Target Delta: 10 - 14 °C"
          benchmark="Crit: > 20.0°C"
          status={deltaT > 20 ? 'critical' : deltaT > 15 ? 'warn' : 'normal'}
          icon={<ArrowRightLeft className="h-4 w-4" />}
        />

        <KpiCard
          title="Active IT Load"
          value={(filteredRacks.reduce((acc, r) => acc + (r.active_kw || 7.8), 0)).toFixed(1)}
          unit="kW"
          subValue="Across 6 Enclosed Server Racks"
          benchmark="Rated: 90.0 kW"
          status="neutral"
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* Rack Grid Heatmap */}
      <div className="rounded-xl border border-noc-border bg-noc-panel p-5 backdrop-blur-md shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h2 className="font-mono text-sm font-bold tracking-tight text-slate-100 uppercase">
              {selectedHall === 'hall-alpha' ? 'Row A Containment Corridor (Racks A01 - A06)' : 'Row B Containment Corridor (Racks B01 - B06)'}
            </h2>
          </div>

          {/* Thermal Legend */}
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" /> &lt;22°C (Cool)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" /> 22-25°C (Optimal)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" /> &gt;27°C (Warn)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse" /> &gt;32°C (Critical)
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {filteredRacks.map((rack, idx) => {
            const inlet = liveColdTemp ? Number((liveColdTemp + ((idx % 3) - 1) * 0.4).toFixed(1)) : rack.inlet_temp_c;
            const exhaust = liveHotTemp ? Number((liveHotTemp + ((idx % 3) - 1) * 0.5).toFixed(1)) : rack.exhaust_temp_c;
            const rackDeltaT = Number((exhaust - inlet).toFixed(1));
            const activeKw = liveColdTemp ? Number((7.8 + ((idx % 4) - 1.5) * 0.4).toFixed(1)) : rack.active_kw;
            const loadPercent = Math.min(100, (activeKw / rack.rated_kw) * 100);

            return (
              <div
                key={rack.id}
                className={`flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-300 hover:-translate-y-1 ${getThermalClass(
                  inlet
                )}`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Server className="h-4 w-4 text-cyan-400 opacity-80" />
                      <span className="font-mono text-sm font-black tracking-wider text-slate-100">
                        {rack.label}
                      </span>
                    </div>
                    <span className="rounded bg-slate-800/80 border border-slate-700/60 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                      42U
                    </span>
                  </div>

                  {/* Inlet Temp Heatmap Display */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-bold">
                      INLET TEMP:
                    </span>
                    <span className="font-mono text-2xl font-black tabular-nums">
                      {inlet}°C
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Exhaust:</span>
                    <span className="tabular-nums text-slate-200 font-bold">{exhaust}°C</span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Delta-T:</span>
                    <span
                      className={`tabular-nums font-bold ${
                        rackDeltaT > 20
                          ? 'text-rose-400'
                          : rackDeltaT > 15
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {rackDeltaT}°C
                    </span>
                  </div>
                </div>

                {/* Simulated Server Blade Slots */}
                <div className="my-3 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6].map((slot) => (
                      <div
                        key={slot}
                        className={`h-1 flex-1 rounded-sm ${
                          inlet > 32
                            ? 'bg-rose-500/60'
                            : inlet > 27
                            ? 'bg-amber-500/50'
                            : 'bg-cyan-500/40'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Power Bar */}
                <div className="pt-2 border-t border-slate-800/60">
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>IT Load</span>
                    <span className="text-slate-100 font-bold">{activeKw} kW</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${loadPercent}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>{loadPercent.toFixed(0)}% loaded</span>
                    <span>Rated {rack.rated_kw} kW</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
