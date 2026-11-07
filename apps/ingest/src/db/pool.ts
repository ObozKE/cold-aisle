import pg from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('❌ [Database Pool Error]:', err);
});

export async function testDbConnection(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT NOW() as now;');
    console.log(`✅ [Database Connected]: PostgreSQL responding at ${res.rows[0].now}`);
    return true;
  } catch (err) {
    console.error('❌ [Database Connection Failed]:', err);
    return false;
  }
}
