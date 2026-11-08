import { ActiveAlertRecord } from '../../engine/rules.js';

export interface GenericWebhookPayload {
  event: 'alert.firing' | 'alert.escalated' | 'alert.resolved';
  alert_id: string;
  severity: 'warn' | 'critical';
  subject: string;
  metric: string;
  value: number;
  threshold: number | null;
  tier: number;
  opened_at: string;
  runbook_url: string | null;
  site: string;
  metadata: Record<string, any>;
}

export function buildGenericPayload(
  alert: ActiveAlertRecord,
  tier: number,
  ruleData?: { metric: string; threshold: number | null; runbook?: string }
): GenericWebhookPayload {
  return {
    event: alert.state === 'resolved' ? 'alert.resolved' : 'alert.firing',
    alert_id: alert.id,
    severity: alert.severity,
    subject: alert.subject,
    metric: ruleData?.metric || alert.metadata?.metric || 'unknown',
    value: alert.last_value,
    threshold: ruleData?.threshold ?? null,
    tier,
    opened_at: alert.opened_at.toISOString(),
    runbook_url: alert.metadata?.runbook || ruleData?.runbook || null,
    site: 'NBO1 (Nairobi DC1)',
    metadata: alert.metadata || {},
  };
}
