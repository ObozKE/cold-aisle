'use client';

import React, { useState, useEffect } from 'react';
import { useSSE } from '../../hooks/useSSE';
import { formatEATDateTime, formatEAT } from '../../lib/utils';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  UserCheck,
  Send,
  X,
  FileText,
  Filter,
} from 'lucide-react';
import { useAuthRole } from '../../context/AuthRoleContext';

export default function AlertsPage() {
  const { latestAlert } = useSSE();
  const { isAdmin } = useAuthRole();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Modal states
  const [selectedAlertForAck, setSelectedAlertForAck] = useState<any | null>(null);
  const [ackName, setAckName] = useState('NOC Operator');
  const [ackNote, setAckNote] = useState('Field team inspecting physical asset');
  const [acking, setAcking] = useState(false);

  const [selectedAlertForDeliveries, setSelectedAlertForDeliveries] = useState<any | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const ingestUrl = process.env.NEXT_PUBLIC_INGEST_URL || 'http://localhost:4000';

  const fetchAlerts = async () => {
    try {
      let query = `${ingestUrl}/api/v1/alerts?limit=100`;
      if (filterState !== 'all') query += `&state=${filterState}`;
      if (filterSeverity !== 'all') query += `&severity=${filterSeverity}`;

      const res = await fetch(query);
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [filterState, filterSeverity, ingestUrl]);

  // Handle SSE live alert updates
  useEffect(() => {
    if (latestAlert) {
      fetchAlerts();
    }
  }, [latestAlert]);

  // Acknowledge alert
  const handleAcknowledge = async () => {
    if (!selectedAlertForAck) return;
    setAcking(true);
    try {
      const res = await fetch(`${ingestUrl}/api/v1/alerts/${selectedAlertForAck.id}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acked_by: ackName, note: ackNote }),
      });

      if (res.ok) {
        setSelectedAlertForAck(null);
        await fetchAlerts();
      }
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    } finally {
      setAcking(false);
    }
  };

  // View webhook deliveries for an alert
  const openDeliveriesModal = async (alert: any) => {
    setSelectedAlertForDeliveries(alert);
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`${ingestUrl}/api/v1/alerts/${alert.id}/deliveries`);
      const data = await res.json();
      setDeliveries(data.deliveries || []);
    } catch (err) {
      console.error('Failed to load webhook deliveries', err);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-noc-border bg-noc-panel p-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-slate-100">
            NOC ALERT INCIDENT MANAGEMENT
          </h1>
          <p className="text-xs text-slate-400">
            Real-time state machine • Deduplicated active incidents & HMAC-signed escalation logs
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900/60 p-1 text-xs font-mono">
            <Filter className="h-3.5 w-3.5 text-slate-400 ml-1" />
            <button
              onClick={() => setFilterState('all')}
              className={`rounded px-2 py-0.5 ${filterState === 'all' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'}`}
            >
              All States
            </button>
            <button
              onClick={() => setFilterState('firing')}
              className={`rounded px-2 py-0.5 ${filterState === 'firing' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400'}`}
            >
              Firing
            </button>
            <button
              onClick={() => setFilterState('acknowledged')}
              className={`rounded px-2 py-0.5 ${filterState === 'acknowledged' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'}`}
            >
              Acked
            </button>
            <button
              onClick={() => setFilterState('resolved')}
              className={`rounded px-2 py-0.5 ${filterState === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'}`}
            >
              Resolved
            </button>
          </div>

          <div className="flex items-center gap-1 rounded border border-slate-700 bg-slate-900/60 p-1 text-xs font-mono">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`rounded px-2 py-0.5 ${filterSeverity === 'all' ? 'bg-slate-700 text-slate-200' : 'text-slate-400'}`}
            >
              All Sev
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`rounded px-2 py-0.5 ${filterSeverity === 'critical' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400'}`}
            >
              Critical
            </button>
            <button
              onClick={() => setFilterSeverity('warn')}
              className={`rounded px-2 py-0.5 ${filterSeverity === 'warn' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'}`}
            >
              Warn
            </button>
          </div>
        </div>
      </div>

      {/* Main Alerts Table */}
      <div className="overflow-hidden rounded-lg border border-noc-border bg-noc-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-noc-border bg-slate-900/80 text-[11px] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">State</th>
                <th className="py-3 px-4">Subject & Trigger</th>
                <th className="py-3 px-4">Value</th>
                <th className="py-3 px-4">Opened (EAT)</th>
                <th className="py-3 px-4">Resolution Note</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No matching incidents found for the selected filter.
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => {
                  const isFiring = alert.state === 'firing';
                  const isAcked = alert.state === 'acknowledged';
                  const isCritical = alert.severity === 'critical';

                  return (
                    <tr
                      key={alert.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isFiring ? (isCritical ? 'bg-rose-950/20' : 'bg-amber-950/20') : ''
                      }`}
                    >
                      {/* Severity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isCritical ? 'bg-rose-500 text-white' : 'bg-amber-500 text-black'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </td>

                      {/* State */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`flex items-center gap-1.5 text-xs font-semibold ${
                            isFiring
                              ? 'text-rose-400 animate-pulse'
                              : isAcked
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isFiring ? 'bg-rose-400' : isAcked ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                          />
                          {alert.state.toUpperCase()}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">{alert.subject}</div>
                        <div className="text-[11px] text-slate-500">
                          Rule: {alert.metadata?.rule_code || alert.dedupe_key}
                        </div>
                      </td>

                      {/* Value */}
                      <td className="py-3 px-4 text-slate-300 font-bold tabular-nums">
                        {alert.last_value !== null ? Number(alert.last_value).toFixed(2) : '—'}
                      </td>

                      {/* Opened At */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {formatEATDateTime(alert.opened_at)}
                      </td>

                      {/* Resolution Note */}
                      <td className="py-3 px-4 text-slate-400 text-[11px] max-w-xs truncate">
                        {alert.ack_note ? (
                          <span>
                            <strong className="text-slate-300">{alert.acked_by}:</strong> {alert.ack_note}
                          </span>
                        ) : alert.state === 'resolved' ? (
                          <span className="text-emerald-400/80">Auto-resolved via hysteresis</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isFiring && (
                            <button
                              disabled={!isAdmin}
                              onClick={() => setSelectedAlertForAck(alert)}
                              title={isAdmin ? 'Acknowledge alert' : 'Admin role required to acknowledge alerts (Current: Viewer)'}
                              className={`rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                isAdmin
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                  : 'border-slate-800 bg-slate-900 text-slate-600 cursor-not-allowed opacity-60'
                              }`}
                            >
                              {isAdmin ? 'Ack' : 'Ack (Locked)'}
                            </button>
                          )}

                          <button
                            onClick={() => openDeliveriesModal(alert)}
                            className="rounded border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700/60"
                          >
                            Webhooks
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Acknowledge Alert */}
      {selectedAlertForAck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-noc-border bg-noc-panel p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-amber-400" />
                <h3 className="font-mono text-sm font-bold text-slate-100">
                  ACKNOWLEDGE INCIDENT
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlertForAck(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 font-mono text-xs">
              <div className="rounded border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-[11px] text-slate-400">Target Incident:</div>
                <div className="font-bold text-slate-200 mt-0.5">{selectedAlertForAck.subject}</div>
                <div className="text-amber-400 text-[11px] mt-1">
                  Acknowledging will instantly cancel scheduled Tier 2 & Tier 3 escalations.
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">On-Call Operator Name:</label>
                <input
                  type="text"
                  value={ackName}
                  onChange={(e) => setAckName(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Investigation / Triage Note:</label>
                <textarea
                  rows={3}
                  value={ackNote}
                  onChange={(e) => setAckNote(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSelectedAlertForAck(null)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={acking}
                onClick={handleAcknowledge}
                className="flex items-center gap-1.5 rounded bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{acking ? 'Saving...' : 'Confirm Ack & Halt Escalation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Webhook Delivery Audit Log */}
      {selectedAlertForDeliveries && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-lg border border-noc-border bg-noc-panel p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-cyan-400" />
                <div>
                  <h3 className="font-mono text-sm font-bold text-slate-100">
                    WEBHOOK ESCALATION AUDIT LOG
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {selectedAlertForDeliveries.subject}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlertForDeliveries(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto space-y-2 font-mono text-xs">
              {loadingDeliveries ? (
                <div className="py-8 text-center text-slate-400">Loading delivery attempts...</div>
              ) : deliveries.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  No webhook delivery attempts recorded for this incident yet.
                </div>
              ) : (
                deliveries.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col gap-1 rounded border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-cyan-900/60 text-cyan-300 px-1.5 py-0.5 text-[10px] font-bold">
                          TIER {d.tier}
                        </span>
                        <span className="font-semibold text-slate-200">{d.endpoint_name}</span>
                        <span className="text-[10px] text-slate-400 uppercase">({d.kind})</span>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          d.status_code === 200
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        HTTP {d.status_code || 'ERR'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span>URL: {d.url}</span>
                      <span>Latency: {d.response_ms}ms • Attempt #{d.attempt}</span>
                    </div>

                    <div className="text-[10px] text-slate-500">
                      Dispatched: {formatEATDateTime(d.sent_at)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-800 pt-3">
              <button
                onClick={() => setSelectedAlertForDeliveries(null)}
                className="rounded border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
