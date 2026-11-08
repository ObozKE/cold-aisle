import { Router, Request, Response } from 'express';
import { telemetryEventEmitter, ProcessedTelemetryEvent } from '../../services/telemetryProcessor.js';
import { alertEventEmitter, ActiveAlertRecord } from '../../engine/rules.js';

export const streamRouter = Router();

// Active SSE client connections
const sseClients = new Set<Response>();

// Broadcast helper
export function broadcastSse(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Hook up internal event listeners once
telemetryEventEmitter.on('telemetry', (event: ProcessedTelemetryEvent) => {
  broadcastSse('telemetry', {
    device: event.device.id,
    ts: event.ts.toISOString(),
    raw: event.raw,
    derived: event.derived,
    pue: event.pue,
  });
});

alertEventEmitter.on('alert:opened', (alert: ActiveAlertRecord) => {
  broadcastSse('alert', { type: 'opened', alert });
});

alertEventEmitter.on('alert:escalated', (alert: ActiveAlertRecord) => {
  broadcastSse('alert', { type: 'escalated', alert });
});

alertEventEmitter.on('alert:resolved', (alert: ActiveAlertRecord) => {
  broadcastSse('alert', { type: 'resolved', alert });
});

streamRouter.get('/stream', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', ts: new Date().toISOString() })}\n\n`);

  sseClients.add(res);

  // Heartbeat ping every 15s to keep connections alive through proxies
  const heartbeatTimer = setInterval(() => {
    res.write(`:ping\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
});
