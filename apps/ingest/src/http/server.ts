import express from 'express';
import cors from 'cors';
import { ingestRouter } from './routes/ingest.js';
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

  // REST API v1
  app.use('/api/v1', ingestRouter);

  return app;
}
