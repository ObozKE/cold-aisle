import crypto from 'node:crypto';
import { pool } from '../db/pool.js';

export interface DeviceMetadata {
  id: string;
  site_id: string;
  hall_id: string;
  name: string;
  api_key_hash: string;
  publish_interval_sec: number;
  status: string;
}

// In-memory cache for device credentials with 60s TTL
const deviceCache = new Map<string, { device: DeviceMetadata; expiresAt: number }>();

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

export async function getDevice(deviceId: string): Promise<DeviceMetadata | null> {
  const now = Date.now();
  const cached = deviceCache.get(deviceId);
  if (cached && cached.expiresAt > now) {
    return cached.device;
  }

  const res = await pool.query<DeviceMetadata>(
    `SELECT id, site_id, hall_id, name, api_key_hash, publish_interval_sec, status 
     FROM devices WHERE id = $1`,
    [deviceId]
  );

  if (res.rows.length === 0) return null;

  const device = res.rows[0];
  deviceCache.set(deviceId, { device, expiresAt: now + 60000 });
  return device;
}

export async function authenticateDeviceKey(
  deviceId: string,
  providedKey: string
): Promise<boolean> {
  const device = await getDevice(deviceId);
  if (!device) return false;

  const providedHash = hashApiKey(providedKey);
  return crypto.timingSafeEqual(
    Buffer.from(providedHash, 'hex'),
    Buffer.from(device.api_key_hash, 'hex')
  );
}
