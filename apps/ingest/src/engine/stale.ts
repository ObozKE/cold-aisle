import { pool } from '../db/pool.js';
import { ruleEngine, AlertRuleRecord } from './rules.js';

let staleIntervalHandle: NodeJS.Timeout | null = null;

export async function checkDeviceStaleness(): Promise<void> {
  try {
    const rules = await ruleEngine.loadRules();
    const staleRule = rules.find((r) => r.code === 'RULE_DEVICE_STALE');
    if (!staleRule || !staleRule.enabled) return;

    const res = await pool.query<{
      id: string;
      name: string;
      publish_interval_sec: number;
      last_seen_at: Date | null;
      status: string;
    }>(
      `SELECT id, name, publish_interval_sec, last_seen_at, status 
       FROM devices 
       WHERE last_seen_at IS NOT NULL`
    );

    const now = Date.now();

    for (const dev of res.rows) {
      if (!dev.last_seen_at) continue;

      const lastSeenMs = new Date(dev.last_seen_at).getTime();
      const elapsedSeconds = Number(((now - lastSeenMs) / 1000).toFixed(1));
      const warnThreshold = dev.publish_interval_sec * 3; // 15s for 5s publish
      const critThreshold = dev.publish_interval_sec * 10; // 50s for 5s publish

      const dedupeKey = `${staleRule.code}:${dev.id}`;
      const activeAlert = await ruleEngine.getActiveAlert(dedupeKey);

      if (elapsedSeconds >= warnThreshold) {
        // Mark device status stale in DB if not already
        if (dev.status === 'online') {
          await pool.query(`UPDATE devices SET status = 'stale' WHERE id = $1`, [dev.id]);
          console.warn(`⚠️ [DEVICE STALE] Device '${dev.id}' missed heartbeats (${elapsedSeconds}s elapsed).`);
        }

        const severity: 'warn' | 'critical' = elapsedSeconds >= critThreshold ? 'critical' : 'warn';

        if (!activeAlert) {
          // Open stale alert
          await pool.query(
            `INSERT INTO alerts (rule_id, subject, severity, state, opened_at, last_value, dedupe_key, metadata)
             VALUES ($1, $2, $3, 'firing', NOW(), $4, $5, $6)`,
            [
              staleRule.id,
              `${staleRule.name} [${dev.id}]`,
              severity,
              elapsedSeconds,
              dedupeKey,
              JSON.stringify({ device: dev.id, elapsed_seconds: elapsedSeconds }),
            ]
          );
        } else {
          // Escalate severity if exceeded critThreshold
          if (activeAlert.severity === 'warn' && severity === 'critical') {
            await pool.query(
              `UPDATE alerts SET severity = 'critical', last_value = $1 WHERE id = $2`,
              [elapsedSeconds, activeAlert.id]
            );
          } else {
            await pool.query(`UPDATE alerts SET last_value = $1 WHERE id = $2`, [
              elapsedSeconds,
              activeAlert.id,
            ]);
          }
        }
      } else {
        // Device is active / healthy
        if (activeAlert) {
          await ruleEngine.resolveAlert(activeAlert, elapsedSeconds);
          await pool.query(`UPDATE devices SET status = 'online' WHERE id = $1`, [dev.id]);
        }
      }
    }
  } catch (err: any) {
    console.error('❌ [Stale Detector Error]:', err.message);
  }
}

export function startStaleDetector(intervalMs = 5000): NodeJS.Timeout {
  console.log(`⏱️ [Stale Detector] Monitoring device liveness every ${intervalMs}ms...`);
  staleIntervalHandle = setInterval(() => {
    checkDeviceStaleness().catch(() => {});
  }, intervalMs);
  return staleIntervalHandle;
}

export function stopStaleDetector(): void {
  if (staleIntervalHandle) {
    clearInterval(staleIntervalHandle);
    staleIntervalHandle = null;
  }
}
