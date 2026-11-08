import { EventEmitter } from 'node:events';
import { pool } from '../db/pool.js';
import { ProcessedTelemetryEvent } from '../services/telemetryProcessor.js';

export interface AlertRuleRecord {
  id: string;
  name: string;
  code: string;
  scope: string; // 'global', 'hall', 'rack', 'asset', 'device'
  metric: string;
  operator: '>' | '<' | 'outside' | 'compound';
  warn_threshold: number | null;
  crit_threshold: number | null;
  for_seconds: number;
  hysteresis: number;
  enabled: boolean;
  metadata: Record<string, any>;
}

export interface ActiveAlertRecord {
  id: string;
  rule_id: string;
  subject: string;
  severity: 'warn' | 'critical';
  state: 'firing' | 'acknowledged' | 'resolved';
  opened_at: Date;
  acked_at: Date | null;
  acked_by: string | null;
  ack_note: string | null;
  resolved_at: Date | null;
  last_value: number;
  dedupe_key: string;
  metadata: Record<string, any>;
}

export const alertEventEmitter = new EventEmitter();

export class RuleEngine {
  private rulesCache: AlertRuleRecord[] = [];
  private rulesCacheExpiresAt = 0;

  // Debounce tracking: dedupeKey -> first breach timestamp (ms)
  private debounceBreachTimestamps = new Map<string, number>();

  // Sliding history for compound rate-of-change calculation:
  // asset/device tag -> Array<{ ts: number; level_pct: number; pressure_bar: number }>
  private levelHistory = new Map<
    string,
    Array<{ ts: number; level_pct: number; pressure_bar: number }>
  >();

  /**
   * Refreshes rules from DB with 60s cache TTL
   */
  public async loadRules(): Promise<AlertRuleRecord[]> {
    const now = Date.now();
    if (this.rulesCache.length > 0 && this.rulesCacheExpiresAt > now) {
      return this.rulesCache;
    }

    const res = await pool.query<AlertRuleRecord>(
      `SELECT id, name, code, scope, metric, operator, 
              warn_threshold::float, crit_threshold::float, 
              for_seconds, hysteresis::float, enabled, metadata 
       FROM alert_rules 
       WHERE enabled = true`
    );

    this.rulesCache = res.rows;
    this.rulesCacheExpiresAt = now + 60000;
    return this.rulesCache;
  }

  /**
   * Computes rate of drop of reservoir level (%/minute)
   */
  public recordAndGetLevelDropRate(
    subject: string,
    levelPct: number,
    pressureBar: number
  ): { dropRatePctMin: number; pressure: number } {
    const now = Date.now();
    let history = this.levelHistory.get(subject);
    if (!history) {
      history = [];
      this.levelHistory.set(subject, history);
    }

    history.push({ ts: now, level_pct: levelPct, pressure_bar: pressureBar });

    // Keep up to 60 seconds of history
    while (history.length > 0 && now - history[0].ts > 60000) {
      history.shift();
    }

    if (history.length < 2) {
      return { dropRatePctMin: 0, pressure: pressureBar };
    }

    const oldest = history[0];
    const newest = history[history.length - 1];
    const deltaMinutes = (newest.ts - oldest.ts) / 60000;

    if (deltaMinutes <= 0) return { dropRatePctMin: 0, pressure: pressureBar };

    // Drop rate: positive if level is falling: (oldest - newest) / deltaMinutes
    const dropRatePctMin = Number(
      ((oldest.level_pct - newest.level_pct) / deltaMinutes).toFixed(2)
    );

    return { dropRatePctMin, pressure: newest.pressure_bar };
  }

  /**
   * Evaluates rules against an incoming telemetry event
   */
  public async evaluateTelemetry(
    event: ProcessedTelemetryEvent,
    currentPue?: number
  ): Promise<void> {
    const rules = await this.loadRules();

    // Context metrics map for evaluation
    const metrics: Record<string, { value: number; subject: string }> = {
      cold_aisle_temp_c: {
        value: event.raw.cold_aisle_temp_c,
        subject: event.device.hall_id,
      },
      delta_t_c: {
        value: event.derived.aisle_delta_t_c,
        subject: event.device.hall_id,
      },
      cold_aisle_rh: {
        value: event.raw.cold_aisle_rh,
        subject: event.device.hall_id,
      },
      coolant_pressure_bar: {
        value: event.raw.coolant_pressure_bar,
        subject: 'CDU-01',
      },
      cdu_reservoir_level_pct: {
        value: event.derived.cdu_reservoir_level_pct,
        subject: 'CDU-01',
      },
      diesel_level_pct: {
        value: event.derived.diesel_level_pct,
        subject: 'DIESEL-TK-01',
      },
      diesel_runtime_hours: {
        value: event.derived.diesel_runtime_hours,
        subject: 'DIESEL-TK-01',
      },
    };

    if (currentPue !== undefined) {
      metrics['pue'] = {
        value: currentPue,
        subject: event.device.hall_id,
      };
    }

    // Compound rule: record level history
    const leakStats = this.recordAndGetLevelDropRate(
      'CDU-01',
      event.derived.cdu_reservoir_level_pct,
      event.raw.coolant_pressure_bar
    );

    metrics['cdu_leak_suspicion'] = {
      value: leakStats.dropRatePctMin,
      subject: 'CDU-01',
    };

    const now = Date.now();

    for (const rule of rules) {
      const metricData = metrics[rule.metric];
      if (!metricData) continue;

      const { value, subject } = metricData;
      const dedupeKey = `${rule.code}:${subject}`;

      // Check violation status
      const violation = this.checkViolation(rule, value, leakStats);

      // Fetch any existing open alert for this dedupe_key
      const activeAlert = await this.getActiveAlert(dedupeKey);

      if (violation.isBreached) {
        // --- DEBOUNCE LOGIC ---
        let breachStart = this.debounceBreachTimestamps.get(dedupeKey);
        if (!breachStart) {
          breachStart = now;
          this.debounceBreachTimestamps.set(dedupeKey, breachStart);
        }

        const elapsedSeconds = (now - breachStart) / 1000;
        const debounced = elapsedSeconds >= rule.for_seconds;

        if (debounced) {
          if (!activeAlert) {
            // Open new alert
            await this.openAlert(rule, subject, dedupeKey, violation.severity, value);
          } else {
            // Update last_value and escalate severity if escalated to critical
            await this.updateActiveAlert(
              activeAlert,
              violation.severity,
              value,
              rule.for_seconds
            );
          }
        }
      } else {
        // Condition does not meet the breach threshold.
        // Reset debounce timer
        this.debounceBreachTimestamps.delete(dedupeKey);

        // --- HYSTERESIS & AUTO-RESOLVE LOGIC ---
        if (activeAlert) {
          const isCleared = this.checkRecovery(rule, value, leakStats);
          if (isCleared) {
            await this.resolveAlert(activeAlert, value);
          }
        }
      }
    }
  }

  /**
   * Determines if a metric value violates the rule threshold
   */
  public checkViolation(
    rule: AlertRuleRecord,
    value: number,
    leakStats?: { dropRatePctMin: number; pressure: number }
  ): { isBreached: boolean; severity: 'warn' | 'critical' } {
    if (rule.operator === 'compound' && rule.code === 'RULE_CDU_LEAK_COMPOUND') {
      const dropRate = leakStats ? leakStats.dropRatePctMin : value;
      const pressure = leakStats ? leakStats.pressure : 2.6;

      // Leak suspicion: rapid level drop AND low pressure (< 1.8 bar)
      const isDroppingFast = dropRate >= (rule.crit_threshold ?? 2.0);
      const isPressureLow = pressure < 1.80;

      if (isDroppingFast && isPressureLow) {
        return { isBreached: true, severity: 'critical' };
      }
      if (dropRate >= (rule.warn_threshold ?? 1.5)) {
        return { isBreached: true, severity: 'warn' };
      }
      return { isBreached: false, severity: 'warn' };
    }

    if (rule.operator === '>') {
      if (rule.crit_threshold !== null && value >= rule.crit_threshold) {
        return { isBreached: true, severity: 'critical' };
      }
      if (rule.warn_threshold !== null && value >= rule.warn_threshold) {
        return { isBreached: true, severity: 'warn' };
      }
      return { isBreached: false, severity: 'warn' };
    }

    if (rule.operator === '<') {
      if (rule.crit_threshold !== null && value <= rule.crit_threshold) {
        return { isBreached: true, severity: 'critical' };
      }
      if (rule.warn_threshold !== null && value <= rule.warn_threshold) {
        return { isBreached: true, severity: 'warn' };
      }
      return { isBreached: false, severity: 'warn' };
    }

    if (rule.operator === 'outside') {
      const low = rule.warn_threshold ?? 20.0;
      const high = rule.crit_threshold ?? 80.0;
      if (value < low || value > high) {
        return { isBreached: true, severity: 'warn' };
      }
      return { isBreached: false, severity: 'warn' };
    }

    return { isBreached: false, severity: 'warn' };
  }

  /**
   * Applies hysteresis margin to verify if metric has safely recovered
   */
  public checkRecovery(
    rule: AlertRuleRecord,
    value: number,
    leakStats?: { dropRatePctMin: number; pressure: number }
  ): boolean {
    const h = rule.hysteresis;

    if (rule.operator === 'compound') {
      const dropRate = leakStats ? leakStats.dropRatePctMin : value;
      return dropRate < (rule.warn_threshold ?? 1.5) - h;
    }

    if (rule.operator === '>') {
      const clearThreshold = (rule.warn_threshold ?? 0) - h;
      return value <= clearThreshold;
    }

    if (rule.operator === '<') {
      const clearThreshold = (rule.warn_threshold ?? 0) + h;
      return value >= clearThreshold;
    }

    if (rule.operator === 'outside') {
      const low = (rule.warn_threshold ?? 20.0) + h;
      const high = (rule.crit_threshold ?? 80.0) - h;
      return value >= low && value <= high;
    }

    return true;
  }

  /**
   * Look up active (firing or acknowledged) alert by dedupe key
   */
  public async getActiveAlert(dedupeKey: string): Promise<ActiveAlertRecord | null> {
    const res = await pool.query<ActiveAlertRecord>(
      `SELECT * FROM alerts WHERE dedupe_key = $1 AND state != 'resolved' LIMIT 1`,
      [dedupeKey]
    );
    return res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Insert a new alert record into PostgreSQL
   */
  private async openAlert(
    rule: AlertRuleRecord,
    subject: string,
    dedupeKey: string,
    severity: 'warn' | 'critical',
    value: number
  ): Promise<void> {
    const res = await pool.query<ActiveAlertRecord>(
      `INSERT INTO alerts (
         rule_id, subject, severity, state, opened_at, last_value, dedupe_key, metadata
       ) VALUES ($1, $2, $3, 'firing', NOW(), $4, $5, $6)
       RETURNING *`,
      [
        rule.id,
        `${rule.name} [${subject}]`,
        severity,
        value,
        dedupeKey,
        JSON.stringify({
          rule_code: rule.code,
          metric: rule.metric,
          runbook: rule.metadata?.runbook || null,
        }),
      ]
    );

    const created = res.rows[0];
    console.log(
      `🚨 [ALERT FIRING] [${severity.toUpperCase()}] ${created.subject} (Metric: ${rule.metric}=${value})`
    );

    alertEventEmitter.emit('alert:opened', created);
  }

  /**
   * Update active alert value and escalate severity if condition worsened
   */
  private async updateActiveAlert(
    alert: ActiveAlertRecord,
    severity: 'warn' | 'critical',
    value: number,
    forSeconds: number
  ): Promise<void> {
    let newSeverity = alert.severity;
    let escalated = false;

    if (alert.severity === 'warn' && severity === 'critical') {
      newSeverity = 'critical';
      escalated = true;
    }

    await pool.query(
      `UPDATE alerts 
       SET last_value = $1, severity = $2 
       WHERE id = $3`,
      [value, newSeverity, alert.id]
    );

    if (escalated) {
      console.log(`⚠️ [ALERT ESCALATED] ${alert.subject} -> CRITICAL (Value: ${value})`);
      alertEventEmitter.emit('alert:escalated', { ...alert, severity: newSeverity, last_value: value });
    }
  }

  /**
   * Auto-resolve active alert following hysteresis clearance
   */
  public async resolveAlert(alert: ActiveAlertRecord, value: number): Promise<void> {
    const res = await pool.query<ActiveAlertRecord>(
      `UPDATE alerts 
       SET state = 'resolved', resolved_at = NOW(), last_value = $1 
       WHERE id = $2 
       RETURNING *`,
      [value, alert.id]
    );

    const resolved = res.rows[0];
    console.log(`✅ [ALERT RESOLVED] ${resolved.subject} (Cleared at: ${value})`);
    alertEventEmitter.emit('alert:resolved', resolved);
  }
}

export const ruleEngine = new RuleEngine();
