import express from 'express';
import cors from 'cors';
import { ingestRouter } from './routes/ingest.js';
import { alertsRouter } from './routes/alerts.js';
import { mockOncallRouter } from './routes/mockOncall.js';
import { streamRouter } from './routes/stream.js';
import { scenarioRouter } from './routes/scenario.js';
import { telemetryQueryRouter } from './routes/telemetry.js';
import { pool } from '../db/pool.js';

export function createHttpServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Healthcheck endpoint
  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1;');
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'coldaisle-ingest',
      });
    } catch (err: any) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
        error: err.message,
      });
    }
  });

  // Mock On-Call Receiver endpoints
  app.use('/api', mockOncallRouter);
  app.use(mockOncallRouter);

  // Realtime Server-Sent Events (SSE) Stream
  app.use('/api/v1', streamRouter);

  // Scenario Remote Control API
  app.use('/api/v1', scenarioRouter);

  // REST API v1
  app.use('/api/v1', ingestRouter);
  app.use('/api/v1', alertsRouter);
  app.use('/api/v1', telemetryQueryRouter);

  return app;
}
