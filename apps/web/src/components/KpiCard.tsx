import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subValue?: string;
  status?: 'normal' | 'warn' | 'critical' | 'neutral';
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'steady';
  benchmark?: string;
}

export function KpiCard({
  title,
  value,
  unit,
  subValue,
  status = 'normal',
  icon,
  benchmark,
}: KpiCardProps) {
  const statusStyles = {
    normal: {
      border: 'border-emerald-500/30 hover:border-emerald-500/50',
      bg: 'bg-gradient-to-b from-slate-900/90 to-emerald-950/20',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.08)]',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
      text: 'text-emerald-400',
    },
    warn: {
      border: 'border-amber-500/40 hover:border-amber-500/60',
      bg: 'bg-gradient-to-b from-slate-900/90 to-amber-950/20',
      glow: 'shadow-[0_0_14px_rgba(245,158,11,0.12)]',
      dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
      text: 'text-amber-400',
    },
    critical: {
      border: 'border-rose-500/50 hover:border-rose-500/80',
      bg: 'bg-gradient-to-b from-slate-900/90 to-rose-950/30',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.25)] animate-pulse',
      dot: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)] animate-ping',
      text: 'text-rose-400',
    },
    neutral: {
      border: 'border-cyan-500/30 hover:border-cyan-500/50',
      bg: 'bg-gradient-to-b from-slate-900/90 to-cyan-950/20',
      glow: 'shadow-[0_0_12px_rgba(56,189,248,0.08)]',
      dot: 'bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]',
      text: 'text-cyan-400',
    },
  };

  const style = statusStyles[status];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 ${style.border} ${style.bg} ${style.glow}`}
    >
      {/* Top Accent Line */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] opacity-75 ${
          status === 'critical'
            ? 'bg-rose-500'
            : status === 'warn'
            ? 'bg-amber-400'
            : status === 'normal'
            ? 'bg-emerald-400'
            : 'bg-cyan-400'
        }`}
      />

      <div className="flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2">
          <span className={`relative flex h-2 w-2 rounded-full ${style.dot}`} />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            {title}
          </span>
        </div>
        {icon && <span className="opacity-80 transition-opacity hover:opacity-100">{icon}</span>}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-100 tabular-nums">
          {value}
        </span>
        {unit && <span className="font-mono text-sm font-medium text-slate-400">{unit}</span>}
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-slate-400">
        {subValue && <span className="truncate">{subValue}</span>}
        {benchmark && (
          <span className="text-[10px] text-slate-500 bg-slate-900/70 px-1.5 py-0.5 rounded border border-slate-800">
            {benchmark}
          </span>
        )}
      </div>
    </div>
  );
}
