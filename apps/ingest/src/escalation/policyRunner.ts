import { pool } from '../db/pool.js';
import { alertEventEmitter, ActiveAlertRecord } from '../engine/rules.js';
import {
  dispatchAlertToEndpoint,
  WebhookEndpointRecord,
} from './dispatcher.js';

export interface EscalationTier {
  tier: number;
  delay_seconds: number;
  endpoint_ids: string[];
}

export interface EscalationPolicyRecord {
  id: string;
  name: string;
  tiers: EscalationTier[];
  is_default: boolean;
}

// Active escalation timers: alertId -> Array<NodeJS.Timeout>
const activeEscalationTimers = new Map<string, NodeJS.Timeout[]>();

/**
 * Loads default escalation policy and enabled endpoints
 */
export async function getEscalationConfig(): Promise<{
  policy: EscalationPolicyRecord | null;
  endpoints: Map<string, WebhookEndpointRecord>;
}> {
  const policyRes = await pool.query<EscalationPolicyRecord>(
    `SELECT * FROM escalation_policies WHERE is_default = true LIMIT 1`
  );
  const endpointsRes = await pool.query<WebhookEndpointRecord>(
    `SELECT * FROM webhook_endpoints WHERE enabled = true`
  );

  const endpointsMap = new Map<string, WebhookEndpointRecord>();
  for (const ep of endpointsRes.rows) {
    endpointsMap.set(ep.id, ep);
  }

  return {
    policy: policyRes.rows.length > 0 ? policyRes.rows[0] : null,
    endpoints: endpointsMap,
  };
}

/**
 * Starts multi-tier escalation chain for an alert
 */
export async function runAlertEscalation(
  alert: ActiveAlertRecord,
  accelerationFactor = 1.0
): Promise<void> {
  const { policy, endpoints } = await getEscalationConfig();
  if (!policy || !policy.tiers || policy.tiers.length === 0) {
    console.warn(`⚠️ [Escalation] No default escalation policy configured.`);
    return;
  }

  // Clear any existing timers for this alert
  cancelAlertEscalation(alert.id);
  const timers: NodeJS.Timeout[] = [];

  for (const tierConfig of policy.tiers) {
    const delayMs = Math.round((tierConfig.delay_seconds / accelerationFactor) * 1000);

    if (delayMs === 0) {
      // Tier 1: Immediate dispatch
      executeTier(alert, tierConfig, endpoints).catch((err) =>
        console.error(`❌ [Escalation Tier ${tierConfig.tier} Failed]:`, err.message)
      );
    } else {
      // Tier 2 & Tier 3: Scheduled with state validation check
      const timer = setTimeout(async () => {
        try {
          // Check database to verify alert is still unacknowledged and firing
          const alertCheck = await pool.query<{ state: string }>(
            `SELECT state FROM alerts WHERE id = $1`,
            [alert.id]
          );

          if (alertCheck.rows.length === 0 || alertCheck.rows[0].state !== 'firing') {
            const state = alertCheck.rows[0]?.state || 'unknown';
            console.log(
              `🛑 [Escalation Aborted] Alert '${alert.subject}' is now '${state}'. Halting Tier ${tierConfig.tier}.`
            );
            return;
          }

          console.log(
            `⏰ [Escalation Scheduled Trigger] Alert '${alert.subject}' remains unacknowledged. Triggering Tier ${tierConfig.tier}...`
          );
          await executeTier(alert, tierConfig, endpoints);
        } catch (err: any) {
          console.error(`❌ [Escalation Tier ${tierConfig.tier} Error]:`, err.message);
        }
      }, delayMs);

      timers.push(timer);
    }
  }

  activeEscalationTimers.set(alert.id, timers);
}

/**
 * Dispatches an alert to all endpoints configured in a tier
 */
async function executeTier(
  alert: ActiveAlertRecord,
  tierConfig: EscalationTier,
  endpoints: Map<string, WebhookEndpointRecord>
): Promise<void> {
  console.log(
    `📣 [Escalation Tier ${tierConfig.tier}] Dispatching for alert: '${alert.subject}' (${tierConfig.endpoint_ids.length} targets)`
  );

  for (const endpointId of tierConfig.endpoint_ids) {
    const endpoint = endpoints.get(endpointId);
    if (!endpoint) {
      console.warn(`⚠️ [Escalation] Endpoint ID '${endpointId}' not found or disabled.`);
      continue;
    }

    await dispatchAlertToEndpoint(alert, endpoint, tierConfig.tier);
  }
}

/**
 * Cancels all pending timers when an alert is acknowledged or resolved
 */
export function cancelAlertEscalation(alertId: string): void {
  const timers = activeEscalationTimers.get(alertId);
  if (timers && timers.length > 0) {
    for (const t of timers) {
      clearTimeout(t);
    }
    activeEscalationTimers.delete(alertId);
    console.log(`⏹️ [Escalation Cancelled] Timers cleared for alert ${alertId}`);
  }
}

/**
 * Initializes listeners for alert lifecycle events
 */
export function initEscalationPolicyRunner(accelerationFactor = 1.0): void {
  console.log(`🛡️ [Escalation Runner] Initialized (Acceleration: ${accelerationFactor}x).`);

  alertEventEmitter.on('alert:opened', (alert: ActiveAlertRecord) => {
    runAlertEscalation(alert, accelerationFactor).catch((err) =>
      console.error('❌ Failed to run alert escalation:', err.message)
    );
  });

  alertEventEmitter.on('alert:resolved', (alert: ActiveAlertRecord) => {
    cancelAlertEscalation(alert.id);
  });
}
