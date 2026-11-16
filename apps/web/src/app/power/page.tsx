'use client';

import React from 'react';
import { useSSE } from '../../hooks/useSSE';
import { KpiCard } from '../../components/KpiCard';
import {
  Fuel,
  Zap,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  BatteryCharging,
} from 'lucide-react';

export default function PowerPage() {
  const { latestTelemetry } = useSSE();

  // Fuel telemetry
  const dieselPct = latestTelemetry?.derived.diesel_level_pct ?? 88.15;
  const dieselLitres = latestTelemetry?.derived.diesel_litres ?? 1762.96;
  const runtimeHours = latestTelemetry?.derived.diesel_runtime_hours ?? 26.94;
  const burnRate = latestTelemetry?.derived.diesel_burn_rate_lph ?? 65.44;

  // Power breakdown
  const itKw = latestTelemetry?.pue?.it_kw ?? latestTelemetry?.raw.rack_it_kw ?? 7.8;
  const coolingKw = latestTelemetry?.pue?.cooling_kw ?? 4.15;
  const upsLossKw = latestTelemetry?.pue?.ups_loss_kw ?? 0.50;
  const otherKw = latestTelemetry?.pue?.other_kw ?? 4.50;
  const totalKw = latestTelemetry?.pue?.total_kw ?? (itKw + coolingKw + upsLossKw + otherKw);
  const pue = latestTelemetry?.pue?.pue ?? Number((totalKw / itKw).toFixed(3));

  // Power channel percentages
  const itPct = ((itKw / totalKw) * 100).toFixed(1);
  const coolingPct = ((coolingKw / totalKw) * 100).toFixed(1);
  const upsPct = ((upsLossKw / totalKw) * 100).toFixed(1);
  const otherPct = ((otherKw / totalKw) * 100).toFixed(1);

  const isPowerCut = burnRate > 90 || (latestTelemetry?.raw.rack_it_kw && latestTelemetry?.raw.rack_it_kw > 14);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-noc-border bg-noc-panel p-5 backdrop-blur-md shadow-lg md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
            <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
              POWER DISTRIBUTION & GENERATOR AUTONOMY
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Electrical Single-Line Model • 1,000 kVA Standby Genset, Modular UPS & PUE Energy Allocation
          </p>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 font-mono text-xs shadow-md">
          <span className="text-slate-400">PRIMARY GRID SOURCE:</span>
          <span className="flex items-center gap-1.5 font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            KPLC 11kV UTILITY MAINS ACTIVE
          </span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Diesel Day-Tank Fill"
          value={dieselPct.toFixed(1)}
          unit="%"
          subValue={`${dieselLitres.toFixed(0)} L / 2,000 L capacity`}
          benchmark="Crit: < 20%"
          status={dieselPct < 20 ? 'critical' : dieselPct < 40 ? 'warn' : 'normal'}
          icon={<Fuel className="h-4 w-4" />}
        />

        <KpiCard
          title="Generator Autonomy"
          value={runtimeHours.toFixed(1)}
          unit="hrs"
          subValue={`Burn rate: ${burnRate.toFixed(1)} L/h at load`}
          benchmark="Min Reserve: 4h"
          status={runtimeHours < 2 ? 'critical' : runtimeHours < 4 ? 'warn' : 'normal'}
          icon={<Activity className="h-4 w-4" />}
        />

        <KpiCard
          title="Total Facility Demand"
          value={totalKw.toFixed(1)}
          unit="kW"
          subValue="IT + Cooling + UPS + Aux"
          benchmark="Rated: 250 kW"
          status="neutral"
          icon={<Zap className="h-4 w-4" />}
        />

        <KpiCard
          title="Instantaneous PUE"
          value={pue.toFixed(3)}
          subValue="ISO/IEC 30134-2 Energy Factor"
          benchmark="Target: ≤ 1.450"
          status={pue > 2.0 ? 'critical' : pue > 1.6 ? 'warn' : 'normal'}
          icon={<Layers className="h-4 w-4" />}
        />
      </div>

      {/* Fuel Storage Visualizer & Genset Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Diesel Fuel Tank Visualizer */}
        <div className="flex flex-col items-center justify-between rounded-xl border border-noc-border bg-noc-panel p-5 backdrop-blur-md shadow-md">
          <div className="w-full text-left">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
                <Fuel className="h-3.5 w-3.5 text-amber-400" />
                Diesel Day Tank
              </h2>
              <span className="font-mono text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                TAG: DIESEL-TK-01
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              Main Generator Bulk Feed Day Tank (2,000 L)
            </p>
          </div>

          <div className="my-5 flex items-center gap-6">
            {/* Visual Tank Graphic */}
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
                  dieselPct < 20
                    ? 'bg-gradient-to-t from-rose-700 via-rose-600 to-rose-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                    : dieselPct < 40
                    ? 'bg-gradient-to-t from-amber-700 via-amber-600 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : 'bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                }`}
                style={{ height: `${Math.max(5, Math.min(96, dieselPct))}%` }}
              >
                {/* Surface Wave */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-white/40 animate-pulse-subtle" />
              </div>

              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400 text-[9px] text-amber-300 font-mono pl-1.5 z-20"
                style={{ bottom: '40%' }}
              >
                Warn (40%)
              </div>
              <div
                className="absolute left-0 right-0 border-t border-dashed border-rose-500 text-[9px] text-rose-400 font-mono pl-1.5 z-20"
                style={{ bottom: '20%' }}
              >
                Crit (20%)
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
                <span className="text-slate-500 block text-[10px] font-bold">CURRENT FILL</span>
                <span className="text-2xl font-black text-slate-100 tabular-nums">
                  {dieselPct.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">CURRENT VOLUME</span>
                <span className="text-slate-200 font-bold text-sm">{dieselLitres.toFixed(0)} L</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">MAX CAPACITY</span>
                <span className="text-slate-400">2,000 Litres</span>
              </div>
            </div>
          </div>

          <div className="w-full text-center text-[11px] text-slate-500 font-mono border-t border-slate-800/80 pt-3">
            Fuel Vendor: Vivo Energy / Rubis Kenya • Priority Standby SLA
          </div>
        </div>

        {/* PUE Energy Allocation Breakdown */}
        <div className="col-span-2 rounded-xl border border-noc-border bg-noc-panel p-5 backdrop-blur-md shadow-md">
          <div className="pb-3 border-b border-slate-800/80">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              Facility Power Balance & PUE Channel Breakdown
            </h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Formula: PUE = (P_IT + P_Cooling + P_UPS_Loss + P_Aux) / P_IT
            </p>
          </div>

          {/* Color-Coded Power Allocation Bar */}
          <div className="mt-4">
            <div className="flex h-6 w-full overflow-hidden rounded-lg font-mono text-[10px] font-bold shadow-inner">
              <div
                style={{ width: `${itPct}%` }}
                className="flex items-center justify-center bg-cyan-500 text-slate-950 transition-all duration-500 hover:brightness-110"
                title={`IT Power: ${itKw.toFixed(1)} kW (${itPct}%)`}
              >
                IT {itPct}%
              </div>
              <div
                style={{ width: `${coolingPct}%` }}
                className="flex items-center justify-center bg-blue-600 text-white transition-all duration-500 hover:brightness-110"
                title={`Cooling: ${coolingKw.toFixed(1)} kW (${coolingPct}%)`}
              >
                Cooling {coolingPct}%
              </div>
              <div
                style={{ width: `${upsPct}%` }}
                className="flex items-center justify-center bg-amber-500 text-slate-950 transition-all duration-500 hover:brightness-110"
                title={`UPS Losses: ${upsLossKw.toFixed(1)} kW (${upsPct}%)`}
              >
                Loss {upsPct}%
              </div>
              <div
                style={{ width: `${otherPct}%` }}
                className="flex items-center justify-center bg-slate-600 text-white transition-all duration-500 hover:brightness-110"
                title={`Aux: ${otherKw.toFixed(1)} kW (${otherPct}%)`}
              >
                Aux {otherPct}%
              </div>
            </div>
          </div>

          {/* Allocation Cards */}
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
              <span className="text-[10px] text-cyan-400 font-bold block uppercase">1. IT Equipment</span>
              <span className="text-xl font-black text-slate-100 tabular-nums mt-1 block">
                {itKw.toFixed(2)} kW
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">{itPct}% of total</span>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3.5">
              <span className="text-[10px] text-blue-400 font-bold block uppercase">2. CDU + Chiller</span>
              <span className="text-xl font-black text-slate-100 tabular-nums mt-1 block">
                {coolingKw.toFixed(2)} kW
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">{coolingPct}% of total</span>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5">
              <span className="text-[10px] text-amber-400 font-bold block uppercase">3. Modular UPS</span>
              <span className="text-xl font-black text-slate-100 tabular-nums mt-1 block">
                {upsLossKw.toFixed(2)} kW
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">η = 94.0% online</span>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-3.5">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">4. Lighting & Aux</span>
              <span className="text-xl font-black text-slate-100 tabular-nums mt-1 block">
                {otherKw.toFixed(2)} kW
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">{otherPct}% of total</span>
            </div>
          </div>

          {/* Generator Operational Annunciator Panel */}
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                <div>
                  <span className="font-bold text-slate-200">GENSET-01 (Cummins 1,000 kVA / 800 kW)</span>
                  <span className="text-slate-500 block text-[11px]">Auto-Transfer Switch: SYNCHRONIZED READY</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] text-slate-300">
                  Fuel: {dieselLitres.toFixed(0)} L
                </span>
                <span className="rounded bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                  STANDBY 100%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
