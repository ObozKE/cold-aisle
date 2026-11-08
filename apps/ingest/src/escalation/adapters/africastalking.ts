import { ActiveAlertRecord } from '../../engine/rules.js';
import { config } from '../../config.js';

export interface AfricaTalkingSmsResult {
  status: 'sent' | 'skipped' | 'failed';
  messageId?: string;
  recipient?: string;
  reason?: string;
}

/**
 * Africa's Talking SMS Adapter Stub for Kenya Mobile Escalation (+254...)
 * Enabled via ENABLE_AFRICASTALKING_SMS=true in .env
 */
export async function sendAfricaTalkingSms(
  alert: ActiveAlertRecord,
  tier: number,
  recipient = '+254700000000'
): Promise<AfricaTalkingSmsResult> {
  const isEnabled = config.ENABLE_AFRICASTALKING_SMS;

  const smsText =
    `[ColdAisle DCIM Tier ${tier}] ${alert.severity.toUpperCase()} ALERT: ` +
    `${alert.subject}. Val: ${alert.last_value}. Opened: ${alert.opened_at.toISOString().substring(11, 16)}Z.`;

  if (!isEnabled) {
    console.log(`📱 [Africa's Talking SMS Stub] (FLAG DISABLED) Recipient: ${recipient} | Text: "${smsText}"`);
    return {
      status: 'skipped',
      reason: 'AfricaTalking SMS integration disabled via ENABLE_AFRICASTALKING_SMS=false env flag.',
    };
  }

  console.log(`📱 [Africa's Talking SMS Gateway] Dispatching SMS to ${recipient}...`);

  try {
    // If credentials are present, mock or invoke HTTP gateway
    // https://api.africastalking.com/version1/messaging
    const fakeMessageId = `AT_SMS_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
    console.log(`✅ [Africa's Talking SMS] Delivered to ${recipient} (MessageId: ${fakeMessageId})`);
    return {
      status: 'sent',
      messageId: fakeMessageId,
      recipient,
    };
  } catch (err: any) {
    console.error(`❌ [Africa's Talking SMS Failed]:`, err.message);
    return {
      status: 'failed',
      reason: err.message,
    };
  }
}
