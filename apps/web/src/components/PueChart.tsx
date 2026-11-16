'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export interface PueSamplePoint {
  time_bucket: string;
  pue: number;
  it_kw: number;
  total_kw: number;
}

interface PueChartProps {
  data: PueSamplePoint[];
}

export function PueChart({ data }: PueChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-48 w-full animate-pulse rounded-lg bg-slate-900/60" />;
  }

  const chartData = data.map((d) => ({
    time: d.time_bucket
      ? new Date(d.time_bucket).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Nairobi',
        })
      : '',
    pue: Number(d.pue),
    it_kw: Number(d.it_kw),
    total_kw: Number(d.total_kw),
  }));

  const minPue = chartData.length > 0 ? Math.min(...chartData.map((d) => d.pue)) : 1.35;
  const maxPue = chartData.length > 0 ? Math.max(...chartData.map((d) => d.pue)) : 1.55;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span>PUE 1h Trend (EAT)</span>
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400/90">Min: {minPue.toFixed(3)}</span>
          <span className="text-rose-400/90">Max: {maxPue.toFixed(3)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <span className="inline-block w-3 border-t border-dashed border-amber-400/70" />
          <span>ASHRAE Design (1.45)</span>
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="pueAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.45} />
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
              domain={[1.0, 2.4]}
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <ReferenceLine
              y={1.45}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#090d16',
                borderColor: '#1e293b',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
              }}
              formatter={(value: any) => [`${Number(value).toFixed(3)} PUE`, 'Efficiency']}
              labelFormatter={(label) => `Time (EAT): ${label}`}
            />
            <Area
              type="monotone"
              dataKey="pue"
              stroke="#38bdf8"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#pueAreaGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
