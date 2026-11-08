import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  status?: 'normal' | 'warn' | 'critical' | 'neutral';
  icon?: React.ReactNode;
}

export function KpiCard({
  title,
  value,
  unit,
  subValue,
  status = 'normal',
  icon,
}: KpiCardProps) {
  const statusColors = {
    normal: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    warn: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    critical: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    neutral: 'text-cyan-400 border-slate-700 bg-slate-800/20',
  };

  const borderPulse = status === 'critical' ? 'animate-pulse border-rose-500/60' : '';

  return (
    <div
      className={`rounded-lg border p-4 shadow-sm backdrop-blur-sm transition-all ${statusColors[status]} ${borderPulse}`}
    >
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        {icon && <span className="opacity-80">{icon}</span>}
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-3xl font-bold tracking-tight text-slate-100 tabular-nums">
          {value}
        </span>
        {unit && <span className="font-mono text-sm text-slate-400">{unit}</span>}
      </div>

      {subValue && (
        <div className="mt-1 text-xs text-slate-400 font-mono">
          {subValue}
        </div>
      )}
    </div>
  );
}
