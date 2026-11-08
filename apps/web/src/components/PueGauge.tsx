import React from 'react';

interface PueGaugeProps {
  pue: number;
}

export function PueGauge({ pue }: PueGaugeProps) {
  // PUE scale ranges from 1.0 (ideal) to 2.5 (severe)
  const clamped = Math.max(1.0, Math.min(2.5, pue));
  const percentage = (clamped - 1.0) / 1.5; // 0.0 to 1.0

  // Arc calculation (half circle)
  const radius = 70;
  const strokeWidth = 14;
  const circumference = Math.PI * radius; // Half-circle perimeter
  const strokeDashoffset = circumference * (1 - percentage);

  let statusLabel = 'OPTIMUM';
  let statusColor = 'text-emerald-400';
  let strokeColor = '#10b981';

  if (pue > 2.0) {
    statusLabel = 'CRITICAL INEFFICIENCY';
    statusColor = 'text-rose-400';
    strokeColor = '#ef4444';
  } else if (pue > 1.6) {
    statusLabel = 'HIGH CONSUMPTION';
    statusColor = 'text-amber-400';
    strokeColor = '#f59e0b';
  } else if (pue > 1.45) {
    statusLabel = 'NOMINAL TIER III';
    statusColor = 'text-cyan-400';
    strokeColor = '#38bdf8';
  }

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="relative flex items-center justify-center">
        <svg width="180" height="105" className="overflow-visible">
          {/* Background Track Arc */}
          <path
            d="M 20 95 A 70 70 0 0 1 160 95"
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Dynamic Fill Arc */}
          <path
            d="M 20 95 A 70 70 0 0 1 160 95"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Digital Display */}
        <div className="absolute top-10 flex flex-col items-center">
          <span className="font-mono text-3xl font-bold tracking-tight text-slate-100 tabular-nums">
            {pue.toFixed(3)}
          </span>
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
            FACILITY PUE
          </span>
        </div>
      </div>

      <div className={`mt-1 font-mono text-xs font-semibold tracking-wider ${statusColor}`}>
        {statusLabel}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500 font-mono">
        Target: ≤ 1.450 (Tier III Nairobi)
      </div>
    </div>
  );
}
