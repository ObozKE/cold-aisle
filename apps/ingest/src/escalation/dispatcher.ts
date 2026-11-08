import { pool } from '../db/pool.js';
import { ActiveAlertRecord } from '../engine/rules.js';
import { signWebhookPayload } from './signer.js';
import { buildGenericPayload } from './adapters/generic.js';
import { buildSlackPayload } from './adapters/slack.js';
import { sendAfricaTalkingSms } from './adapters/africastalking.js';

export interface WebhookEndpointRecord {
  id: string;
  name: string;
  url: string;
  secret: string;
  kind: 'generic' | 'slack' | 'africastalking_sms';
  enabled: boolean;
}

export interface DispatchResult {
  endpointId: string;
  success: boolean;
  statusCode?: number;
  attempts: number;
  error?: string;
}

const MAX_RETRIES = 5;

/**
 * Exponential backoff sleep helper
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Dispatches an alert to a single webhook endpoint with HMAC signature and exponential retry.
 */
export async function dispatchAlertToEndpoint(
  alert: ActiveAlertRecord,
  endpoint: WebhookEndpointRecord,
  tier: number
): Promise<DispatchResult> {
  if (!endpoint.enabled) {
    return { endpointId: endpoint.id, success: false, attempts: 0, error: 'Endpoint disabled' };
  }

  // Handle Africa's Talking SMS integration
  if (endpoint.kind === 'africastalking_sms') {
    const smsRes = await sendAfricaTalkingSms(alert, tier);
    await logDeliveryAttempt({
      alertId: alert.id,
      endpointId: endpoint.id,
      tier,
      attempt: 1,
      statusCode: smsRes.status === 'sent' ? 200 : 204,
      responseMs: 15,
      error: smsRes.reason || null,
      payload: { sms: true, ...smsRes },
    });
    return {
      endpointId: endpoint.id,
      success: smsRes.status === 'sent',
      attempts: 1,
      error: smsRes.reason,
    };
  }

  // Format payload according to endpoint kind
  const payloadData =
    endpoint.kind === 'slack'
      ? buildSlackPayload(alert, tier)
      : buildGenericPayload(alert, tier);

  const payloadJson = JSON.stringify(payloadData);
  let attempt = 0;
  let lastError: string | null = null;
  let lastStatus = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    const timestamp = new Date().toISOString();
    const signature = signWebhookPayload(endpoint.secret, timestamp, payloadJson);

    const startMs = Date.now();
    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp,
          'X-Signature': signature,
          'User-Agent': 'ColdAisle-DCIM-Dispatcher/1.0',
        },
        body: payloadJson,
        signal: AbortSignal.timeout(5000), // 5s request timeout
      });

      const responseMs = Date.now() - startMs;
      lastStatus = response.status;

      // Log attempt to PostgreSQL audit table
      await logDeliveryAttempt({
        alertId: alert.id,
        endpointId: endpoint.id,
        tier,
        attempt,
        statusCode: lastStatus,
        responseMs,
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
        payload: payloadData,
      });

      if (response.ok) {
        console.log(
          `📬 [Webhook Sent] Tier ${tier} -> [${endpoint.name}] (HTTP ${lastStatus}, ${responseMs}ms, attempt ${attempt})`
        );
        return {
          endpointId: endpoint.id,
          success: true,
          statusCode: lastStatus,
          attempts: attempt,
        };
      }

      lastError = `HTTP ${response.status} ${response.statusText}`;
    } catch (err: any) {
      const responseMs = Date.now() - startMs;
      lastError = err.message;

      await logDeliveryAttempt({
        alertId: alert.id,
        endpointId: endpoint.id,
        tier,
        attempt,
        statusCode: 0,
        responseMs,
        error: lastError,
        payload: payloadData,
      });

      console.warn(
        `⚠️ [Webhook Delivery Failed] Endpoint '${endpoint.name}' attempt ${attempt}/${MAX_RETRIES}: ${err.message}`
      );
    }

    // Exponential backoff if attempts remaining
    if (attempt < MAX_RETRIES) {
      const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s
      await sleep(backoffMs);
    }
  }

  return {
    endpointId: endpoint.id,
    success: false,
    statusCode: lastStatus,
    attempts: attempt,
    error: lastError || 'Max retries exhausted',
  };
}

/**
 * Persists delivery attempt record in webhook_deliveries
 */
async function logDeliveryAttempt(record: {
  alertId: string;
  endpointId: string;
  tier: number;
  attempt: number;
  statusCode: number;
  responseMs: number;
  error: string | null;
  payload: any;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO webhook_deliveries (
         alert_id, endpoint_id, tier, attempt, status_code, response_ms, error, payload, sent_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        record.alertId,
        record.endpointId,
        record.tier,
        record.attempt,
        record.statusCode,
        record.responseMs,
        record.error,
        JSON.stringify(record.payload),
      ]
    );
  } catch (err: any) {
    console.error('❌ Failed to log webhook delivery:', err.message);
  }
}
