import { ActiveAlertRecord } from '../../engine/rules.js';

export interface SlackWebhookPayload {
  text: string;
  attachments: Array<{
    color: string;
    title: string;
    text: string;
    fields: Array<{ title: string; value: string; short: boolean }>;
    footer: string;
    ts: number;
  }>;
}

export function buildSlackPayload(
  alert: ActiveAlertRecord,
  tier: number,
  ruleData?: { metric: string; threshold: number | null; runbook?: string }
): SlackWebhookPayload {
  const isCritical = alert.severity === 'critical';
  const color = alert.state === 'resolved' ? '#10b981' : isCritical ? '#ef4444' : '#f59e0b';
  const emoji = alert.state === 'resolved' ? '✅' : isCritical ? '🚨' : '⚠️';

  const title = `${emoji} [Tier ${tier} Escalation] ${alert.subject}`;
  const summaryText = `${alert.severity.toUpperCase()} Alert: ${alert.subject}`;

  return {
    text: summaryText,
    attachments: [
      {
        color,
        title,
        text: `*Status:* ${alert.state.toUpperCase()} | *Severity:* ${alert.severity.toUpperCase()}`,
        fields: [
          {
            title: 'Facility / Campus',
            value: 'Nairobi DC1 (NBO1)',
            short: true,
          },
          {
            title: 'Escalation Tier',
            value: `Tier ${tier}`,
            short: true,
          },
          {
            title: 'Trigger Metric',
            value: `${alert.metadata?.metric || 'value'}: *${alert.last_value}*`,
            short: true,
          },
          {
            title: 'Opened At (UTC)',
            value: alert.opened_at.toISOString().replace('T', ' ').substring(0, 19),
            short: true,
          },
          {
            title: 'Operator Runbook',
            value: alert.metadata?.runbook || 'Follow standard NOC escalation SOP.',
            short: false,
          },
        ],
        footer: 'ColdAisle DCIM Telemetry Twin | Nairobi EAT',
        ts: Math.floor(alert.opened_at.getTime() / 1000),
      },
    ],
  };
}
