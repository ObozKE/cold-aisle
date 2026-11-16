import React from 'react';

interface PueGaugeProps {
  pue: number;
}

export function PueGauge({ pue }: PueGaugeProps) {
  // PUE scale ranges from 1.0 (ideal) to 2.5 (severe)
  const clamped = Math.max(1.0, Math.min(2.5, pue));
  const percentage = (clamped - 1.0) / 1.5; // 0.0 to 1.0

  // Arc calculation (half circle)
  const radius = 74;
  const strokeWidth = 12;
  const circumference = Math.PI * radius; // Half-circle perimeter
  const strokeDashoffset = circumference * (1 - percentage);

  // Tip indicator position on arc
  const angle = Math.PI * (1 - percentage); // from PI (left) to 0 (right)
  const tipX = 90 - radius * Math.cos(angle);
  const tipY = 98 - radius * Math.sin(angle);

  let statusLabel = 'OPTIMUM TIER III';
  let statusColor = 'text-emerald-400';
  let gradientId = 'pueOptimal';
  let tipColor = '#10b981';

  if (pue > 2.0) {
    statusLabel = 'CRITICAL INEFFICIENCY';
    statusColor = 'text-rose-400';
    gradientId = 'pueCritical';
    tipColor = '#f43f5e';
  } else if (pue > 1.6) {
    statusLabel = 'HIGH CONSUMPTION';
    statusColor = 'text-amber-400';
    gradientId = 'pueWarn';
    tipColor = '#f59e0b';
  } else if (pue > 1.45) {
    statusLabel = 'NOMINAL DESIGN';
    statusColor = 'text-cyan-400';
    gradientId = 'pueNominal';
    tipColor = '#38bdf8';
  }

  return (
    <div className="flex flex-col items-center justify-center p-3">
      <div className="relative flex items-center justify-center">
        <svg width="200" height="115" className="overflow-visible">
          <defs>
            <linearGradient id="pueOptimal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="pueNominal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="pueWarn" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="pueCritical" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#be123c" />
            </linearGradient>
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d="M 16 98 A 74 74 0 0 1 164 98"
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Scale Reference Ticks */}
          <line x1="16" y1="98" x2="6" y2="98" stroke="#475569" strokeWidth="2" />
          <line x1="90" y1="24" x2="90" y2="14" stroke="#475569" strokeWidth="2" />
          <line x1="164" y1="98" x2="174" y2="98" stroke="#475569" strokeWidth="2" />

          {/* Dynamic Fill Arc */}
          <path
            d="M 16 98 A 74 74 0 0 1 164 98"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
            className="transition-all duration-700 ease-out"
          />

          {/* Indicator Tip Point */}
          <circle
            cx={tipX}
            cy={tipY}
            r="6"
            fill="#ffffff"
            stroke={tipColor}
            strokeWidth="3"
            className="transition-all duration-700 ease-out shadow-lg"
          />
        </svg>

        {/* Center Digital Display */}
        <div className="absolute top-11 flex flex-col items-center">
          <span className="font-mono text-3xl font-black tracking-tight text-slate-100 tabular-nums">
            {pue.toFixed(3)}
          </span>
          <span className="font-mono text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            LIVE FACILITY PUE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <span
          className={`h-2 w-2 rounded-full ${
            pue > 2.0
              ? 'bg-rose-500 animate-ping'
              : pue > 1.6
              ? 'bg-amber-400 animate-pulse'
              : 'bg-emerald-400'
          }`}
        />
        <span className={`font-mono text-xs font-bold tracking-wider ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500 font-mono">
        <span>Ideal: 1.00</span>
        <span>•</span>
        <span>Target: ≤ 1.450</span>
        <span>•</span>
        <span>Limit: 2.00</span>
      </div>
    </div>
  );
}
