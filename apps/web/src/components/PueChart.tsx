'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
    return <div className="h-44 w-full animate-pulse rounded bg-slate-900/60" />;
  }

  const chartData = data.map((d) => ({
    time: d.time_bucket ? new Date(d.time_bucket).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
    pue: Number(d.pue),
    it_kw: Number(d.it_kw),
    total_kw: Number(d.total_kw),
  }));

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="pueGradient" x1="0" y1="0" x2="0" y2="1">
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
            domain={[1.0, 2.5]}
            stroke="#64748b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderColor: '#1e293b',
              borderRadius: '6px',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
            formatter={(value: any) => [`${Number(value).toFixed(3)} PUE`, 'Efficiency']}
          />
          <Area
            type="monotone"
            dataKey="pue"
            stroke="#38bdf8"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#pueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
