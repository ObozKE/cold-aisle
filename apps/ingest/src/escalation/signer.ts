import crypto from 'node:crypto';

/**
 * Signs webhook payload using HMAC-SHA256 with timestamp.
 * Signature format: sha256=<hex_digest>
 */
export function signWebhookPayload(
  secret: string,
  timestamp: string,
  bodyJson: string
): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${timestamp}.${bodyJson}`);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Timing-safe signature verification for receivers.
 */
export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  bodyJson: string,
  signatureHeader: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = signWebhookPayload(secret, timestamp, bodyJson);

  try {
    const expectedBuf = Buffer.from(expectedSignature);
    const providedBuf = Buffer.from(signatureHeader);

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}
