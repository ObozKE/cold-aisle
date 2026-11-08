'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatEAT } from '../lib/utils';
import {
  Activity,
  AlertTriangle,
  LayoutGrid,
  Droplet,
  Zap,
  Cpu,
  Settings,
  Flame,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { useAuthRole } from '../context/AuthRoleContext';

interface NavbarProps {
  sseStatus?: 'connecting' | 'connected' | 'disconnected';
  activeAlertCount?: number;
}

export function Navbar({ sseStatus = 'connected', activeAlertCount = 0 }: NavbarProps) {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState<string>('');
  const { role, setRole, isAdmin } = useAuthRole();

  useEffect(() => {
    setCurrentTime(formatEAT(new Date()));
    const timer = setInterval(() => {
      setCurrentTime(formatEAT(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { label: 'Overview', href: '/', icon: Activity },
    { label: 'Alerts', href: '/alerts', icon: AlertTriangle, badge: activeAlertCount },
    { label: 'Hall View', href: '/hall', icon: LayoutGrid },
    { label: 'Cooling', href: '/cooling', icon: Droplet },
    { label: 'Power', href: '/power', icon: Zap },
    { label: 'Devices', href: '/devices', icon: Cpu },
    { label: 'Settings', href: '/settings', icon: Settings },
    { label: 'Scenario Control', href: '/scenario', icon: Flame, highlight: true },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-noc-border bg-noc-panel/90 backdrop-blur-md">
      {/* Top Meta Strip */}
      <div className="flex h-11 items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
            <span className="font-mono font-bold tracking-wider text-slate-100">
              COLDAISLE <span className="text-cyan-400">TELEMETRY TWIN</span>
            </span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-400">CAMPUS: NAIROBI DC1 (NBO1)</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Live Clock in Africa/Nairobi */}
          <div className="flex items-center gap-1.5 font-mono text-slate-300">
            <span className="text-slate-500">LOCAL CLOCK:</span>
            <span className="font-bold text-amber-400 tabular-nums">{currentTime || '--:--:-- EAT'}</span>
          </div>

          {/* SSE Connection State */}
          <div className="flex items-center gap-2 rounded border border-noc-border bg-slate-900/60 px-2 py-0.5 font-mono text-[11px]">
            <span
              className={`h-2 w-2 rounded-full ${
                sseStatus === 'connected'
                  ? 'animate-pulse bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                  : sseStatus === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-400">
              {sseStatus === 'connected' ? 'LIVE SSE' : sseStatus.toUpperCase()}
            </span>
          </div>

          {/* RBAC Role Selector */}
          <button
            onClick={() => setRole(isAdmin ? 'viewer' : 'admin')}
            title={`Active role: ${role.toUpperCase()}. Click to switch to ${isAdmin ? 'VIEWER (Read-Only)' : 'ADMIN (Operator)'}`}
            className={`flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
              isAdmin
                ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40'
                : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:bg-slate-800'
            }`}
          >
            {isAdmin ? (
              <>
                <ShieldCheck className="h-3 w-3 text-cyan-400" />
                <span>ROLE: ADMIN</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 text-slate-400" />
                <span>ROLE: VIEWER</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Bar */}
      <nav className="flex space-x-1 overflow-x-auto px-3 pb-2 pt-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : item.highlight
                  ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border border-rose-800/40'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="ml-1 rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-sm">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
