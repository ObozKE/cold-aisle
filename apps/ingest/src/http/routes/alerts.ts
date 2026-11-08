import { Router, Request, Response } from 'express';
import { pool } from '../../db/pool.js';
import { cancelAlertEscalation } from '../../escalation/policyRunner.js';

export const alertsRouter = Router();

// List active/historical alerts with filters
alertsRouter.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const state = req.query.state as string;
    const severity = req.query.severity as string;
    const limit = Math.min(100, parseInt((req.query.limit as string) || '50', 10));

    let query = `
      SELECT a.*, r.name as rule_name, r.metric, r.code as rule_code
      FROM alerts a
      LEFT JOIN alert_rules r ON a.rule_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (state) {
      params.push(state);
      query += ` AND a.state = $${params.length}`;
    }

    if (severity) {
      params.push(severity);
      query += ` AND a.severity = $${params.length}`;
    }

    query += ` ORDER BY a.opened_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.status(200).json({ alerts: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Acknowledge an alert with note
alertsRouter.post('/alerts/:id/ack', async (req: Request, res: Response): Promise<void> => {
  try {
    const alertId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { acked_by = 'NOC Operator', note = 'Investigating issue' } = req.body || {};

    const result = await pool.query(
      `UPDATE alerts 
       SET state = 'acknowledged', acked_at = NOW(), acked_by = $1, ack_note = $2 
       WHERE id = $3 AND state = 'firing'
       RETURNING *`,
      [acked_by, note, alertId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alert not found or already acknowledged/resolved' });
      return;
    }

    const updated = result.rows[0];
    console.log(`👤 [ALERT ACKNOWLEDGED] ${updated.subject} by ${acked_by} (Note: ${note})`);

    // Stop escalation chain immediately
    cancelAlertEscalation(alertId);

    res.status(200).json({ alert: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get delivery audit history for an alert
alertsRouter.get('/alerts/:id/deliveries', async (req: Request, res: Response): Promise<void> => {
  try {
    const alertId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await pool.query(
      `SELECT d.*, e.name as endpoint_name, e.url, e.kind
       FROM webhook_deliveries d
       JOIN webhook_endpoints e ON d.endpoint_id = e.id
       WHERE d.alert_id = $1
       ORDER BY d.sent_at ASC`,
      [alertId]
    );

    res.status(200).json({ deliveries: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
