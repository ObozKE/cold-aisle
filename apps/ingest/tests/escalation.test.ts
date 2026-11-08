import { describe, it, expect } from 'vitest';
import {
  signWebhookPayload,
  verifyWebhookSignature,
} from '../src/escalation/signer.js';
import { buildGenericPayload } from '../src/escalation/adapters/generic.js';
import { buildSlackPayload } from '../src/escalation/adapters/slack.js';
import { sendAfricaTalkingSms } from '../src/escalation/adapters/africastalking.js';
import { ActiveAlertRecord } from '../src/engine/rules.js';

describe('HMAC-SHA256 Webhook Security & Signatures', () => {
  const secret = 'coldaisle_default_hmac_secret_4421';
  const timestamp = '2026-11-08T08:45:00.000Z';
  const bodyJson = JSON.stringify({
    alert_id: 'test-alert-123',
    severity: 'critical',
    subject: 'Cold Aisle High [hall-alpha]',
  });

  it('generates a valid sha256= hex signature', () => {
    const sig = signWebhookPayload(secret, timestamp, bodyJson);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it('verifies successfully with matching secret, timestamp, and body', () => {
    const sig = signWebhookPayload(secret, timestamp, bodyJson);
    const isValid = verifyWebhookSignature(secret, timestamp, bodyJson, sig);
    expect(isValid).toBe(true);
  });

  it('rejects signature if payload body has been tampered with', () => {
    const sig = signWebhookPayload(secret, timestamp, bodyJson);
    const tamperedBody = JSON.stringify({
      alert_id: 'test-alert-123',
      severity: 'warn', // Tampered severity
      subject: 'Cold Aisle High [hall-alpha]',
    });
    const isValid = verifyWebhookSignature(secret, timestamp, tamperedBody, sig);
    expect(isValid).toBe(false);
  });

  it('rejects signature if timestamp header differs', () => {
    const sig = signWebhookPayload(secret, timestamp, bodyJson);
    const alteredTimestamp = '2026-11-08T08:46:00.000Z';
    const isValid = verifyWebhookSignature(secret, alteredTimestamp, bodyJson, sig);
    expect(isValid).toBe(false);
  });

  it('rejects signature with incorrect endpoint secret', () => {
    const sig = signWebhookPayload('wrong_secret', timestamp, bodyJson);
    const isValid = verifyWebhookSignature(secret, timestamp, bodyJson, sig);
    expect(isValid).toBe(false);
  });

  it('rejects malformed signature headers missing sha256= prefix', () => {
    const isValid = verifyWebhookSignature(secret, timestamp, bodyJson, 'invalid_header');
    expect(isValid).toBe(false);
  });
});

describe('Webhook Format Adapters', () => {
  const mockAlert: ActiveAlertRecord = {
    id: 'alert-uuid-1',
    rule_id: 'rule-uuid-1',
    subject: 'Cold Aisle Supply Temperature High [hall-alpha]',
    severity: 'critical',
    state: 'firing',
    opened_at: new Date('2026-11-08T08:00:00Z'),
    acked_at: null,
    acked_by: null,
    ack_note: null,
    resolved_at: null,
    last_value: 33.5,
    dedupe_key: 'RULE_COLD_TEMP:hall-alpha',
    metadata: {
      metric: 'cold_aisle_temp_c',
      runbook: 'Check CRAH units and chilled water valve.',
    },
  };

  it('formats Generic Webhook payload strictly adhering to contract', () => {
    const payload = buildGenericPayload(mockAlert, 1, {
      metric: 'cold_aisle_temp_c',
      threshold: 32.0,
    });

    expect(payload.event).toBe('alert.firing');
    expect(payload.alert_id).toBe('alert-uuid-1');
    expect(payload.severity).toBe('critical');
    expect(payload.tier).toBe(1);
    expect(payload.metric).toBe('cold_aisle_temp_c');
    expect(payload.value).toBe(33.5);
    expect(payload.threshold).toBe(32.0);
    expect(payload.runbook_url).toBe('Check CRAH units and chilled water valve.');
  });

  it('formats Slack-compatible payload with attachments and high-contrast color', () => {
    const payload = buildSlackPayload(mockAlert, 2);

    expect(payload.text).toContain('CRITICAL');
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].color).toBe('#ef4444'); // Critical red
    expect(payload.attachments[0].title).toContain('Tier 2 Escalation');
  });

  it('handles AfricaTalking SMS stub gracefully when flag is false', async () => {
    const res = await sendAfricaTalkingSms(mockAlert, 1);
    expect(res.status).toBe('skipped');
    expect(res.reason).toContain('disabled');
  });
});
