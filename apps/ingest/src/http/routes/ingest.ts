import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { authenticateDeviceKey } from '../../services/deviceAuth.js';
import { processTelemetry } from '../../services/telemetryProcessor.js';

export const ingestRouter = Router();

// Simple in-memory sliding window rate limiter: max 10 requests per second per device
const requestCounts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(deviceId: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(deviceId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(deviceId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}

ingestRouter.post('/ingest', async (req: Request, res: Response): Promise<void> => {
  const rawBody = req.body;
  const deviceKey = req.header('X-Device-Key');

  if (!rawBody || typeof rawBody !== 'object' || !rawBody.device) {
    res.status(400).json({
      error: 'Invalid request payload. Must include "device" identifier.',
    });
    return;
  }

  const deviceId = String(rawBody.device);

  // Authenticate device API key
  if (!deviceKey) {
    res.status(401).json({
      error: 'Unauthorized. Missing required header: X-Device-Key',
    });
    return;
  }

  const isAuthenticated = await authenticateDeviceKey(deviceId, deviceKey);
  if (!isAuthenticated) {
    res.status(401).json({
      error: `Unauthorized. Invalid API key for device '${deviceId}'.`,
    });
    return;
  }

  // Rate Limiting Check
  if (!checkRateLimit(deviceId)) {
    res.status(429).json({
      error: 'Rate limit exceeded. Maximum 10 requests per second per device.',
    });
    return;
  }

  try {
    const result = await processTelemetry(rawBody, 'http');
    res.status(200).json({
      status: 'success',
      device: result.device.id,
      ts: result.ts.toISOString(),
      raw: result.raw,
      derived: result.derived,
    });
  } catch (err: any) {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: 'Telemetry validation failed.',
        issues: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    console.error('❌ [HTTP Ingest Error]:', err);
    res.status(500).json({
      error: 'Internal processing error.',
      message: err.message,
    });
  }
});
