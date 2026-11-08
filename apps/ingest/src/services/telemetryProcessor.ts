import { EventEmitter } from 'node:events';
import { pool } from '../db/pool.js';
import {
  RawTelemetryPayload,
  RawTelemetryPayloadSchema,
  sanitizeTimestamp,
} from '../schema/telemetry.js';
import { getDevice, DeviceMetadata } from './deviceAuth.js';
import {
  calculateTankLevel,
  calculateDeltaT,
  calculateDieselBurnRate,
  calculateDieselRuntimeHours,
  TankGeometryConfig,
} from '../engine/derivation.js';
import { calculatePue, storePueSample, PueCalculationResult } from '../engine/pue.js';
import { ruleEngine } from '../engine/rules.js';

export interface ProcessedTelemetryEvent {
  device: DeviceMetadata;
  ts: Date;
  raw: RawTelemetryPayload['readings'];
  derived: {
    cdu_reservoir_fill_cm: number;
    cdu_reservoir_level_pct: number;
    cdu_reservoir_litres: number;
    diesel_fill_cm: number;
    diesel_level_pct: number;
    diesel_litres: number;
    diesel_burn_rate_lph: number;
    diesel_runtime_hours: number;
    aisle_delta_t_c: number;
  };
  pue?: PueCalculationResult;
}

export const telemetryEventEmitter = new EventEmitter();

// Default fallback geometry in case DB asset record is missing
const DEFAULT_CDU_CONFIG: TankGeometryConfig = {
  tank_height_cm: 40.0,
  usable_height_cm: 35.0,
  deadzone_cm: 5.0,
  capacity_litres: 80.0,
};

const DEFAULT_DIESEL_CONFIG: TankGeometryConfig = {
  tank_height_cm: 150.0,
  usable_height_cm: 135.0,
  deadzone_cm: 15.0,
  capacity_litres: 2000.0,
  nominal_burn_rate_lph: 65.0,
  full_load_burn_rate_lph: 110.0,
};

// Cache for sensor mappings: Map<deviceId, Map<code, sensorId>>
const sensorCache = new Map<string, Map<string, string>>();

async function getSensorMap(deviceId: string): Promise<Map<string, string>> {
  const cached = sensorCache.get(deviceId);
  if (cached) return cached;

  const res = await pool.query<{ id: string; code: string }>(
    `SELECT id, code FROM sensors WHERE device_id = $1`,
    [deviceId]
  );

  const map = new Map<string, string>();
  for (const row of res.rows) {
    map.set(row.code, row.id);
  }
  sensorCache.set(deviceId, map);
  return map;
}

// Cache for asset geometry
let assetConfigsCache: {
  cduConfig: TankGeometryConfig;
  dieselConfig: TankGeometryConfig;
  expiresAt: number;
} | null = null;

async function getAssetConfigs(): Promise<{
  cduConfig: TankGeometryConfig;
  dieselConfig: TankGeometryConfig;
}> {
  const now = Date.now();
  if (assetConfigsCache && assetConfigsCache.expiresAt > now) {
    return assetConfigsCache;
  }

  const res = await pool.query<{ type: string; geometry_config: TankGeometryConfig }>(
    `SELECT type, geometry_config FROM assets WHERE type IN ('cdu', 'diesel_tank')`
  );

  let cduConfig = DEFAULT_CDU_CONFIG;
  let dieselConfig = DEFAULT_DIESEL_CONFIG;

  for (const row of res.rows) {
    if (row.type === 'cdu' && row.geometry_config) {
      cduConfig = { ...DEFAULT_CDU_CONFIG, ...row.geometry_config };
    } else if (row.type === 'diesel_tank' && row.geometry_config) {
      dieselConfig = { ...DEFAULT_DIESEL_CONFIG, ...row.geometry_config };
    }
  }

  assetConfigsCache = { cduConfig, dieselConfig, expiresAt: now + 300000 };
  return { cduConfig, dieselConfig };
}

/**
 * Core Ingestion Pipeline:
 * Validates, authenticates, derives physics, calculates PUE, evaluates alert rules,
 * and stores time-series readings.
 */
export async function processTelemetry(
  rawInput: unknown,
  source: 'mqtt' | 'http' = 'mqtt'
): Promise<ProcessedTelemetryEvent> {
  // 1. Zod Validation
  const validated = RawTelemetryPayloadSchema.parse(rawInput);
  const ts = sanitizeTimestamp(validated.ts);

  // 2. Device Lookup
  const device = await getDevice(validated.device);
  if (!device) {
    throw new Error(`Device '${validated.device}' is not registered in the DCIM catalog.`);
  }

  // 3. Compute Derived Physics
  const { cduConfig, dieselConfig } = await getAssetConfigs();

  const cduDerivation = calculateTankLevel(
    validated.readings.cdu_reservoir_distance_cm,
    cduConfig
  );

  const dieselDerivation = calculateTankLevel(
    validated.readings.diesel_distance_cm,
    dieselConfig
  );

  const deltaT = calculateDeltaT(
    validated.readings.cold_aisle_temp_c,
    validated.readings.hot_aisle_temp_c
  );

  const burnRate = calculateDieselBurnRate(validated.readings.rack_it_kw, {
    nominal_burn_rate_lph: dieselConfig.nominal_burn_rate_lph,
    full_load_burn_rate_lph: dieselConfig.full_load_burn_rate_lph,
  });

  const runtimeHours = calculateDieselRuntimeHours(
    dieselDerivation.current_litres,
    burnRate
  );

  const derived = {
    cdu_reservoir_fill_cm: cduDerivation.fill_cm,
    cdu_reservoir_level_pct: cduDerivation.level_pct,
    cdu_reservoir_litres: cduDerivation.current_litres,
    diesel_fill_cm: dieselDerivation.fill_cm,
    diesel_level_pct: dieselDerivation.level_pct,
    diesel_litres: dieselDerivation.current_litres,
    diesel_burn_rate_lph: burnRate,
    diesel_runtime_hours: runtimeHours,
    aisle_delta_t_c: deltaT,
  };

  // 4. Compute Dynamic PUE
  const pueResult = calculatePue({
    it_kw: validated.readings.rack_it_kw,
    cold_aisle_temp_c: validated.readings.cold_aisle_temp_c,
  });

  // 5. Look up Authoritative Sensor IDs
  const sensorMap = await getSensorMap(device.id);

  // 6. Batch Insert Readings & PUE into PostgreSQL
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update device heartbeat and status
    await client.query(
      `UPDATE devices 
       SET last_seen_at = $1, status = 'online' 
       WHERE id = $2`,
      [ts, device.id]
    );

    // Map metrics to store
    const readingsToInsert: Array<{ sensorId: string; value: number }> = [];

    const metricsToRecord: Record<string, number> = {
      cold_aisle_temp_c: validated.readings.cold_aisle_temp_c,
      cold_aisle_rh: validated.readings.cold_aisle_rh,
      hot_aisle_temp_c: validated.readings.hot_aisle_temp_c,
      hot_aisle_rh: validated.readings.hot_aisle_rh,
      coolant_pressure_bar: validated.readings.coolant_pressure_bar,
      cdu_reservoir_distance_cm: validated.readings.cdu_reservoir_distance_cm,
      diesel_distance_cm: validated.readings.diesel_distance_cm,
      rack_it_kw: validated.readings.rack_it_kw,
    };

    for (const [code, val] of Object.entries(metricsToRecord)) {
      const sensorId = sensorMap.get(code);
      if (sensorId) {
        readingsToInsert.push({ sensorId, value: val });
      }
    }

    if (readingsToInsert.length > 0) {
      const valueClauses: string[] = [];
      const params: any[] = [ts];
      let paramIdx = 2;

      for (const item of readingsToInsert) {
        valueClauses.push(`($${paramIdx}, $1, $${paramIdx + 1})`);
        params.push(item.sensorId, item.value);
        paramIdx += 2;
      }

      const insertSql = `INSERT INTO readings (sensor_id, ts, value) VALUES ${valueClauses.join(', ')}`;
      await client.query(insertSql, params);
    }

    // Persist PUE sample
    await client.query(
      `INSERT INTO pue_samples (hall_id, ts, it_kw, cooling_kw, ups_loss_kw, other_kw, total_kw, pue)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        device.hall_id,
        ts,
        pueResult.it_kw,
        pueResult.cooling_kw,
        pueResult.ups_loss_kw,
        pueResult.other_kw,
        pueResult.total_kw,
        pueResult.pue,
      ]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const processedEvent: ProcessedTelemetryEvent = {
    device,
    ts,
    raw: validated.readings,
    derived,
    pue: pueResult,
  };

  // 7. Evaluate Rule Engine with Debounce & Hysteresis
  await ruleEngine.evaluateTelemetry(processedEvent, pueResult.pue);

  // Auto-resolve any active device stale alert since telemetry was received
  const staleDedupe = `RULE_DEVICE_STALE:${device.id}`;
  const staleAlert = await ruleEngine.getActiveAlert(staleDedupe);
  if (staleAlert) {
    await ruleEngine.resolveAlert(staleAlert, 0);
  }

  // 8. Emit to in-memory event bus
  telemetryEventEmitter.emit('telemetry', processedEvent);

  return processedEvent;
}
