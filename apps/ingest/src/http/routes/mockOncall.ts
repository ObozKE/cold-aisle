import { Router, Request, Response } from 'express';
import { verifyWebhookSignature } from '../../escalation/signer.js';
import { config } from '../../config.js';

export const mockOncallRouter = Router();

export interface InboundWebhookRecord {
  id: string;
  receivedAt: string;
  timestampHeader: string;
  signatureHeader: string;
  isSignatureValid: boolean;
  contentType: string;
  sink: string;
  payload: any;
}

// In-memory ring buffer of recent delivered webhooks
const recentDeliveries: InboundWebhookRecord[] = [];
const MAX_BUFFER = 50;

mockOncallRouter.post('/mock-oncall', (req: Request, res: Response): void => {
  const timestampHeader = (req.header('X-Timestamp') || '').trim();
  const signatureHeader = (req.header('X-Signature') || '').trim();
  const rawBodyJson = JSON.stringify(req.body);
  const sink = (req.query.sink as string) || 'generic';

  const secret = config.HMAC_WEBHOOK_SECRET;
  const isSignatureValid = verifyWebhookSignature(
    secret,
    timestampHeader,
    rawBodyJson,
    signatureHeader
  );

  const record: InboundWebhookRecord = {
    id: `rec_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
    receivedAt: new Date().toISOString(),
    timestampHeader,
    signatureHeader,
    isSignatureValid,
    contentType: req.header('Content-Type') || 'application/json',
    sink,
    payload: req.body,
  };

  recentDeliveries.unshift(record);
  if (recentDeliveries.length > MAX_BUFFER) {
    recentDeliveries.pop();
  }

  console.log(
    `📥 [Mock On-Call Sink] Received Webhook (Valid Sig: ${isSignatureValid}, Sink: ${sink})`
  );

  res.status(200).json({
    status: 'delivered',
    id: record.id,
    signature_verified: isSignatureValid,
    received_at: record.receivedAt,
  });
});

mockOncallRouter.get('/mock-oncall', (req: Request, res: Response): void => {
  res.status(200).json({
    count: recentDeliveries.length,
    deliveries: recentDeliveries,
  });
});

mockOncallRouter.delete('/mock-oncall', (req: Request, res: Response): void => {
  recentDeliveries.length = 0;
  res.status(200).json({ status: 'cleared' });
});
