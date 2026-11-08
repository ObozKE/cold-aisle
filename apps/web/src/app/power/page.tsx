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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-noc-border bg-noc-panel p-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
            POWER DISTRIBUTION & GENERATOR AUTONOMY
          </h1>
          <p className="text-xs text-slate-400">
            Electrical Single-Line Model • 1,000 kVA Standby Genset, Modular UPS & PUE Energy Allocation
          </p>
        </div>

        <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900/60 px-3 py-1.5 font-mono text-xs">
          <span className="text-slate-400">GRID STATUS:</span>
          <span className="flex items-center gap-1 font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> KPLC UTILITY MAINS ACTIVE
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
          status={dieselPct < 20 ? 'critical' : dieselPct < 40 ? 'warn' : 'normal'}
          icon={<Fuel className="h-4 w-4" />}
        />

        <KpiCard
          title="Generator Autonomy"
          value={runtimeHours.toFixed(1)}
          unit="hrs"
          subValue={`Burn rate: ${burnRate.toFixed(1)} L/h at load`}
          status={runtimeHours < 2 ? 'critical' : runtimeHours < 4 ? 'warn' : 'normal'}
          icon={<Activity className="h-4 w-4" />}
        />

        <KpiCard
          title="Total Facility Demand"
          value={totalKw.toFixed(1)}
          unit="kW"
          subValue="IT + Cooling + UPS + Aux"
          status="neutral"
          icon={<Zap className="h-4 w-4" />}
        />

        <KpiCard
          title="Instantaneous PUE"
          value={pue.toFixed(3)}
          subValue="ISO/IEC 30134-2 Energy Factor"
          status={pue > 2.0 ? 'critical' : pue > 1.6 ? 'warn' : 'normal'}
          icon={<Layers className="h-4 w-4" />}
        />
      </div>

      {/* Fuel Storage Visualizer & Genset Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Diesel Fuel Tank Visualizer */}
        <div className="flex flex-col items-center justify-between rounded-lg border border-noc-border bg-noc-panel p-5">
          <div className="w-full text-left">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Diesel Day Tank
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Bulk Generator Reservoir (DIESEL-TK-01)
            </p>
          </div>

          <div className="my-4 flex items-center gap-6">
            <div className="relative h-56 w-24 rounded-lg border-2 border-slate-700 bg-slate-900/80 p-1 shadow-inner overflow-hidden">
              <div
                className={`absolute bottom-1 left-1 right-1 rounded-b transition-all duration-700 ease-out ${
                  dieselPct < 20
                    ? 'bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : dieselPct < 40
                    ? 'bg-amber-500'
                    : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                }`}
                style={{ height: `${Math.max(4, dieselPct)}%` }}
              />

              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400 text-[9px] text-amber-300 font-mono pl-1"
                style={{ bottom: '40%' }}
              >
                Warn (40%)
              </div>
              <div
                className="absolute left-0 right-0 border-t border-dashed border-rose-400 text-[9px] text-rose-300 font-mono pl-1"
                style={{ bottom: '20%' }}
              >
                Crit (20%)
              </div>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">CURRENT FILL</span>
                <span className="text-xl font-bold text-slate-100">{dieselPct.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">CURRENT VOLUME</span>
                <span className="text-slate-200 font-semibold">{dieselLitres.toFixed(0)} Litres</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">TOTAL CAPACITY</span>
                <span className="text-slate-400">2,000 Litres</span>
              </div>
            </div>
          </div>

          <div className="w-full text-center text-[11px] text-slate-500 font-mono border-t border-slate-800 pt-2">
            Vendor: Vivo Energy Kenya • Priority Standby Contract
          </div>
        </div>

        {/* PUE Energy Allocation Breakdown */}
        <div className="col-span-2 rounded-lg border border-noc-border bg-noc-panel p-5">
          <div className="pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Facility Power Balance & PUE Channel Breakdown
            </h2>
            <p className="text-[11px] text-slate-500 font-mono">
              Formula: PUE = Total Facility Power / IT Equipment Power
            </p>
          </div>

          {/* Color-Coded Power Allocation Bar */}
          <div className="mt-3">
            <div className="flex h-5 w-full overflow-hidden rounded font-mono text-[10px] font-bold">
              <div
                style={{ width: `${itPct}%` }}
                className="flex items-center justify-center bg-cyan-500 text-slate-950 transition-all duration-500"
                title={`IT Power: ${itKw.toFixed(1)} kW (${itPct}%)`}
              >
                IT {itPct}%
              </div>
              <div
                style={{ width: `${coolingPct}%` }}
                className="flex items-center justify-center bg-blue-600 text-white transition-all duration-500"
                title={`Cooling: ${coolingKw.toFixed(1)} kW (${coolingPct}%)`}
              >
                Cooling {coolingPct}%
              </div>
              <div
                style={{ width: `${upsPct}%` }}
                className="flex items-center justify-center bg-amber-500 text-slate-950 transition-all duration-500"
                title={`UPS Losses: ${upsLossKw.toFixed(1)} kW (${upsPct}%)`}
              >
                Loss {upsPct}%
              </div>
              <div
                style={{ width: `${otherPct}%` }}
                className="flex items-center justify-center bg-slate-600 text-white transition-all duration-500"
                title={`Aux: ${otherKw.toFixed(1)} kW (${otherPct}%)`}
              >
                Aux {otherPct}%
              </div>
            </div>
          </div>

          {/* Allocation Table */}
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono text-xs">
            <div className="rounded border border-cyan-500/20 bg-cyan-950/20 p-3">
              <span className="text-[10px] text-cyan-400 block uppercase">1. IT Equipment Power</span>
              <span className="text-xl font-bold text-slate-100 tabular-nums">{itKw.toFixed(2)} kW</span>
              <span className="text-[10px] text-slate-400 block mt-1">{itPct}% of facility</span>
            </div>

            <div className="rounded border border-blue-500/20 bg-blue-950/20 p-3">
              <span className="text-[10px] text-blue-400 block uppercase">2. CDU + Chiller Cooling</span>
              <span className="text-xl font-bold text-slate-100 tabular-nums">{coolingKw.toFixed(2)} kW</span>
              <span className="text-[10px] text-slate-400 block mt-1">{coolingPct}% of facility</span>
            </div>

            <div className="rounded border border-amber-500/20 bg-amber-950/20 p-3">
              <span className="text-[10px] text-amber-400 block uppercase">3. Modular UPS Losses</span>
              <span className="text-xl font-bold text-slate-100 tabular-nums">{upsLossKw.toFixed(2)} kW</span>
              <span className="text-[10px] text-slate-400 block mt-1">η = 94.0% double-conversion</span>
            </div>

            <div className="rounded border border-slate-700 bg-slate-800/40 p-3">
              <span className="text-[10px] text-slate-400 block uppercase">4. Auxiliary & Lighting</span>
              <span className="text-xl font-bold text-slate-100 tabular-nums">{otherKw.toFixed(2)} kW</span>
              <span className="text-[10px] text-slate-400 block mt-1">Fixed plant overhead</span>
            </div>
          </div>

          <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-3 font-mono text-xs flex items-center justify-between">
            <span className="text-slate-400">Total Instantaneous Facility Power:</span>
            <span className="text-lg font-bold text-slate-100">{totalKw.toFixed(2)} kW</span>
            <span className="text-slate-400">Resulting PUE:</span>
            <span className="text-lg font-bold text-cyan-400">{pue.toFixed(3)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
