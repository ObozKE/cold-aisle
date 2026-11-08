'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Droplet,
  Zap,
  Fuel,
  Radio,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Play,
  Lock,
} from 'lucide-react';
import { useAuthRole } from '../../context/AuthRoleContext';

interface ScenarioMeta {
  id: string;
  name: string;
  category: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
  summary: string;
  expectedBehavior: string;
  expectedAlerts: string[];
}

const SCENARIOS: ScenarioMeta[] = [
  {
    id: 'normal',
    name: 'Normal Operations (Baseline)',
    category: 'Baseline',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/20',
    borderColor: 'border-emerald-500/30',
    summary: 'Steady healthy thermal & hydraulic operations. Cold aisle at 22.4°C, loop pressure at 2.6 bar.',
    expectedBehavior: 'All readings stable within ASHRAE envelopes. PUE around 1.41.',
    expectedAlerts: ['No alerts firing. All healthy.'],
  },
  {
    id: 'thermal_spike',
    name: 'Thermal Spike / CRAH Failure',
    category: 'Thermal Fault',
    icon: Flame,
    color: 'text-rose-400',
    bgColor: 'bg-rose-950/20',
    borderColor: 'border-rose-500/30',
    summary: 'CRAH fan trip and chilled water damper failure. Cold aisle rapidly climbs towards 38°C.',
    expectedBehavior: 'Cold supply breaches 27°C (warn) and 32°C (crit). Exhaust delta-T exceeds 20°C.',
    expectedAlerts: ['RULE_COLD_TEMP (Warn -> Critical)', 'RULE_DELTA_T (Warn)'],
  },
  {
    id: 'cdu_leak',
    name: 'CDU Secondary Coolant Leak',
    category: 'Hydraulic Fault',
    icon: Droplet,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950/20',
    borderColor: 'border-cyan-500/30',
    summary: 'Manifold leak. Expansion reservoir drains rapidly (>2%/min) while loop pressure collapses below 1.5 bar.',
    expectedBehavior: 'Triggers compound rule before reservoir reaches critical level.',
    expectedAlerts: [
      'RULE_CDU_LEAK_COMPOUND (Critical)',
      'RULE_COOLANT_PRESSURE (Critical)',
      'RULE_RESERVOIR_LEVEL (Critical)',
    ],
  },
  {
    id: 'power_cut',
    name: 'Utility Mains Grid Outage',
    category: 'Electrical Fault',
    icon: Zap,
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/20',
    borderColor: 'border-amber-500/30',
    summary: 'Utility mains failure. Double-conversion UPS bridges transfer until 1,000 kVA genset picks up.',
    expectedBehavior: 'IT load fluctuations followed by steady diesel fuel consumption.',
    expectedAlerts: ['Generator transfer notice', 'PUE surge during diesel burn'],
  },
  {
    id: 'fuel_depletion',
    name: 'Accelerated Diesel Depletion',
    category: 'Fuel Reserve Fault',
    icon: Fuel,
    color: 'text-orange-400',
    bgColor: 'bg-orange-950/20',
    borderColor: 'border-orange-500/30',
    summary: 'Day-tank drain or bulk fuel breach. Stored volume falls rapidly below 40% and 20%.',
    expectedBehavior: 'Runtime autonomy drops below 4 hours (warn) and 2 hours (critical).',
    expectedAlerts: ['RULE_DIESEL_LEVEL (Warn -> Critical)', 'RULE_DIESEL_RUNTIME (Critical)'],
  },
  {
    id: 'sensor_dropout',
    name: 'Microcontroller Packet Dropout',
    category: 'Network / I/O Fault',
    icon: Radio,
    color: 'text-purple-400',
    bgColor: 'bg-purple-950/20',
    borderColor: 'border-purple-500/30',
    summary: 'Hardware gateway or Wokwi microcontroller brownout. Ingestion packets completely cease.',
    expectedBehavior: 'Watchdog detects no heartbeat for 3x (15s) and 10x (50s) interval.',
    expectedAlerts: ['RULE_DEVICE_STALE (Warn -> Critical)'],
  },
  {
    id: 'recovery',
    name: 'Incident Remediation & Recovery',
    category: 'Remediation',
    icon: RefreshCw,
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-950/30',
    borderColor: 'border-emerald-500/40',
    summary: 'Operator maintenance complete. Dampers restored, CDU recharged, temps return to baseline.',
    expectedBehavior: 'Smooth asymptotic return to baseline. Hysteresis clearing resolves all alerts.',
    expectedAlerts: ['Auto-resolution of all firing incidents'],
  },
];

export default function ScenarioControlPage() {
  const [activeScenario, setActiveScenario] = useState<string>('normal');
  const [loading, setLoading] = useState(false);
  const [lastInjected, setLastInjected] = useState<string | null>(null);
  const { isAdmin } = useAuthRole();

  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadCurrent() {
      try {
        const res = await fetch(`${ingestUrl}/api/v1/scenario`);
        const data = await res.json();
        if (data.scenario) {
          setActiveScenario(data.scenario);
        }
      } catch (err) {
        console.error('Failed to load active scenario', err);
      }
    }
    loadCurrent();
  }, [ingestUrl]);

  const handleInject = async (scenarioId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${ingestUrl}/api/v1/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioId }),
      });

      if (res.ok) {
        setActiveScenario(scenarioId);
        setLastInjected(scenarioId);
      }
    } catch (err) {
      console.error('Failed to inject scenario', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-noc-border bg-noc-panel p-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
            NOC SCENARIO CONTROL & FAULT INJECTION
          </h1>
          <p className="text-xs text-slate-400">
            Demonstration testbench • Inject physical failure profiles into the digital twin simulator
          </p>
        </div>

        <div className="flex items-center gap-2 rounded border border-slate-700 bg-slate-900/80 px-3 py-1.5 font-mono text-xs">
          <span className="text-slate-400">ACTIVE SCENARIO:</span>
          <span className="font-bold text-cyan-400 uppercase tracking-wider">
            [{activeScenario.toUpperCase()}]
          </span>
        </div>
      </div>

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SCENARIOS.map((sc) => {
          const Icon = sc.icon;
          const isActive = activeScenario === sc.id;

          return (
            <div
              key={sc.id}
              className={`flex flex-col justify-between rounded-lg border p-5 transition-all ${sc.bgColor} ${
                isActive
                  ? 'border-cyan-400 shadow-[0_0_16px_rgba(56,189,248,0.25)] ring-1 ring-cyan-400/50'
                  : sc.borderColor
              }`}
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${sc.color}`} />
                    <span className="font-mono text-xs font-bold text-slate-200">
                      {sc.name}
                    </span>
                  </div>
                  {isActive && (
                    <span className="rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 font-mono text-[10px] font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs text-slate-300 leading-relaxed font-sans">
                  {sc.summary}
                </p>

                <div className="mt-3 font-mono text-[11px] text-slate-400 space-y-1">
                  <div>
                    <strong className="text-slate-300">Physics:</strong> {sc.expectedBehavior}
                  </div>
                  <div>
                    <strong className="text-slate-300">Expected Alerts:</strong>
                    <ul className="list-disc pl-4 text-slate-400 mt-0.5 space-y-0.5">
                      {sc.expectedAlerts.map((alt, i) => (
                        <li key={i}>{alt}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/60">
                <button
                  disabled={loading || isActive || !isAdmin}
                  onClick={() => handleInject(sc.id)}
                  title={!isAdmin ? 'Admin role required to trigger fault injection profiles' : undefined}
                  className={`w-full flex items-center justify-center gap-2 rounded px-4 py-2 font-mono text-xs font-bold transition-all ${
                    !isAdmin
                      ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                      : isActive
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md'
                  }`}
                >
                  {!isAdmin ? (
                    <>
                      <Lock className="h-3.5 w-3.5 text-slate-600" />
                      <span>ADMIN REQUIRED</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>{isActive ? 'CURRENT PROFILE RUNNING' : `INJECT [${sc.id.toUpperCase()}]`}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
