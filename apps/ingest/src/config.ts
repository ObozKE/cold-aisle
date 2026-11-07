import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace or monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('postgres://coldaisle_admin:coldaisle_secret_dev@localhost:5432/coldaisle_telemetry'),
  MQTT_URL: z.string().default('mqtt://localhost:1883'),
  MQTT_TOPIC: z.string().default('dcim/+/+/+/telemetry'),
  INGEST_API_KEY: z.string().default('dcim_dev_ingest_key_9921'),
  HMAC_WEBHOOK_SECRET: z.string().default('coldaisle_default_hmac_secret_4421'),
  WEBHOOK_MAX_RETRIES: z.coerce.number().default(5),
  STALE_CHECK_INTERVAL_MS: z.coerce.number().default(5000),
  ENABLE_AFRICASTALKING_SMS: z.enum(['true', 'false']).transform(v => v === 'true').default('false'),
  AFRICASTALKING_USERNAME: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_SENDER_ID: z.string().optional(),
});

export const config = envSchema.parse(process.env);
