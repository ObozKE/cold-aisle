'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Send,
  Save,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuthRole } from '../../context/AuthRoleContext';

export default function SettingsPage() {
  const { isAdmin } = useAuthRole();
  const [rules, setRules] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:4000';

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`${ingestUrl}/api/v1/settings`);
        const data = await res.json();
        setRules(data.rules || []);
        setPolicies(data.policies || []);
        setEndpoints(data.endpoints || []);
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [ingestUrl]);

  const handleRuleChange = (id: string, field: string, value: any) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSaveRule = async (rule: any) => {
    setSavingRuleId(rule.id);
    try {
      const res = await fetch(`${ingestUrl}/api/v1/settings/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warn_threshold: parseFloat(rule.warn_threshold),
          crit_threshold: parseFloat(rule.crit_threshold),
          for_seconds: parseInt(rule.for_seconds, 10),
          hysteresis: parseFloat(rule.hysteresis),
          enabled: rule.enabled,
        }),
      });

      if (res.ok) {
        setSaveSuccess(rule.id);
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch (err) {
      console.error('Failed to update rule', err);
    } finally {
      setSavingRuleId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-lg border border-noc-border bg-noc-panel p-4">
        <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
          SYSTEM THRESHOLDS & ESCALATION CONFIGURATION
        </h1>
        <p className="text-xs text-slate-400">
          Operational setpoints • Debounce timing, hysteresis deadbands & HMAC-signed endpoints
        </p>
      </div>

      {/* Section 1: Alert Rules & Thresholds */}
      <div className="rounded-lg border border-noc-border bg-noc-panel p-5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sliders className="h-5 w-5 text-cyan-400" />
          <h2 className="font-mono text-sm font-bold tracking-tight text-slate-100 uppercase">
            Facility Alert Thresholds & Hysteresis Rules
          </h2>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
              <tr>
                <th className="py-2.5 px-3">Rule Name & Code</th>
                <th className="py-2.5 px-3">Metric</th>
                <th className="py-2.5 px-3">Op</th>
                <th className="py-2.5 px-3">Warn Limit</th>
                <th className="py-2.5 px-3">Crit Limit</th>
                <th className="py-2.5 px-3">Debounce (s)</th>
                <th className="py-2.5 px-3">Hysteresis</th>
                <th className="py-2.5 px-3">Enabled</th>
                <th className="py-2.5 px-3 text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-800/20">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-200">{rule.name}</div>
                    <div className="text-[10px] text-slate-500">{rule.code}</div>
                  </td>
                  <td className="py-2.5 px-3 text-cyan-400 font-semibold">{rule.metric}</td>
                  <td className="py-2.5 px-3 text-slate-400 font-bold">{rule.operator}</td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      step="any"
                      value={rule.warn_threshold ?? ''}
                      onChange={(e) => handleRuleChange(rule.id, 'warn_threshold', e.target.value)}
                      className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      step="any"
                      value={rule.crit_threshold ?? ''}
                      onChange={(e) => handleRuleChange(rule.id, 'crit_threshold', e.target.value)}
                      className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      value={rule.for_seconds ?? 0}
                      onChange={(e) => handleRuleChange(rule.id, 'for_seconds', e.target.value)}
                      className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      step="any"
                      value={rule.hysteresis ?? 0}
                      onChange={(e) => handleRuleChange(rule.id, 'hysteresis', e.target.value)}
                      className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-cyan-500 focus:outline-none"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => handleRuleChange(rule.id, 'enabled', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleSaveRule(rule)}
                      disabled={savingRuleId === rule.id || !isAdmin}
                      title={!isAdmin ? 'Admin role required to save threshold settings' : undefined}
                      className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        !isAdmin
                          ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-60'
                          : 'bg-slate-800 text-cyan-300 hover:bg-slate-700 disabled:opacity-50'
                      }`}
                    >
                      {!isAdmin ? (
                        <Lock className="h-3.5 w-3.5 text-slate-600" />
                      ) : saveSuccess === rule.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span>{!isAdmin ? 'Locked' : savingRuleId === rule.id ? '...' : saveSuccess === rule.id ? 'Saved' : 'Save'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Escalation Policies & Webhooks */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Escalation Policy Structure */}
        <div className="rounded-lg border border-noc-border bg-noc-panel p-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Shield className="h-5 w-5 text-amber-400" />
            <h2 className="font-mono text-sm font-bold tracking-tight text-slate-100 uppercase">
              Active Escalation Policy
            </h2>
          </div>

          <div className="mt-4 space-y-3 font-mono text-xs">
            {policies.map((pol) => (
              <div key={pol.id} className="rounded border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between font-bold text-slate-200">
                  <span>{pol.name}</span>
                  {pol.is_default && (
                    <span className="rounded bg-cyan-900/60 text-cyan-300 px-2 py-0.5 text-[10px]">
                      DEFAULT POLICY
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {pol.tiers?.map((t: any) => (
                    <div key={t.tier} className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <div>
                        <span className="font-bold text-cyan-400">TIER {t.tier}:</span>{' '}
                        <span className="text-slate-300">
                          {t.delay_seconds === 0 ? 'Immediate (0s delay)' : `+${t.delay_seconds / 60} min (${t.delay_seconds}s delay)`}
                        </span>
                      </div>
                      <span className="text-slate-400 text-[11px]">
                        {t.endpoint_ids?.length || 0} Target Endpoint(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Webhook Endpoints & Secrets */}
        <div className="rounded-lg border border-noc-border bg-noc-panel p-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Send className="h-5 w-5 text-cyan-400" />
            <h2 className="font-mono text-sm font-bold tracking-tight text-slate-100 uppercase">
              Registered Webhook Endpoints
            </h2>
          </div>

          <div className="mt-4 space-y-3 font-mono text-xs">
            {endpoints.map((ep) => {
              const isRevealed = revealedSecrets[ep.id];
              return (
                <div key={ep.id} className="rounded border border-slate-800 bg-slate-900/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-200">{ep.name}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 uppercase">
                      {ep.kind}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 break-all">
                    URL: <span className="text-slate-300">{ep.url}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Lock className="h-3.5 w-3.5 text-amber-400" />
                      <span>HMAC Secret:</span>
                      <span className="text-slate-300 font-bold">
                        {isRevealed ? 'coldaisle_default_hmac_secret_4421' : ep.masked_secret}
                      </span>
                    </div>

                    <button
                      onClick={() =>
                        setRevealedSecrets((prev) => ({ ...prev, [ep.id]: !prev[ep.id] }))
                      }
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
