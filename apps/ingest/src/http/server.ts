import express from 'express';
import cors from 'cors';
import { ingestRouter } from './routes/ingest.js';
import { alertsRouter } from './routes/alerts.js';
import { mockOncallRouter } from './routes/mockOncall.js';
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

  // Mock On-Call Receiver endpoint (both /api/mock-oncall and root /mock-oncall)
  app.use('/api', mockOncallRouter);
  app.use(mockOncallRouter);

  // REST API v1
  app.use('/api/v1', ingestRouter);
  app.use('/api/v1', alertsRouter);

  return app;
}
