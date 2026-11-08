import { describe, it, expect } from 'vitest';
import { RawTelemetryPayloadSchema } from '../src/schema/telemetry.js';

describe('Stage 7: Firmware Telemetry Contract Verification', () => {
  it('validates standard nominal payload from wokwi-esp32-01', () => {
    const wokwiPayload = {
      device: 'wokwi-esp32-01',
      ts: new Date().toISOString(),
      readings: {
        cold_aisle_temp_c: 22.4,
        cold_aisle_rh: 46.0,
        hot_aisle_temp_c: 35.1,
        hot_aisle_rh: 28.0,
        coolant_pressure_bar: 2.65,
        cdu_reservoir_distance_cm: 14.2,
        diesel_distance_cm: 31.0,
        rack_it_kw: 7.8,
      },
    };

    const parsed = RawTelemetryPayloadSchema.safeParse(wokwiPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.device).toBe('wokwi-esp32-01');
      expect(parsed.data.readings.coolant_pressure_bar).toBe(2.65);
      expect(parsed.data.readings.cdu_reservoir_distance_cm).toBe(14.2);
    }
  });

  it('validates payload with omitted timestamp (handled by ingest server clock fallback)', () => {
    const wokwiPayloadNoTs = {
      device: 'wokwi-esp32-01',
      readings: {
        cold_aisle_temp_c: 21.9,
        cold_aisle_rh: 45.2,
        hot_aisle_temp_c: 34.8,
        hot_aisle_rh: 29.1,
        coolant_pressure_bar: 2.45,
        cdu_reservoir_distance_cm: 15.0,
        diesel_distance_cm: 32.5,
        rack_it_kw: 8.1,
      },
    };

    const parsed = RawTelemetryPayloadSchema.safeParse(wokwiPayloadNoTs);
    expect(parsed.success).toBe(true);
  });

  it('rejects payload if any sensor value exceeds physical boundaries', () => {
    const invalidPayload = {
      device: 'wokwi-esp32-01',
      readings: {
        cold_aisle_temp_c: 99.9, // Exceeds max 60°C
        cold_aisle_rh: 45.0,
        hot_aisle_temp_c: 35.0,
        hot_aisle_rh: 28.0,
        coolant_pressure_bar: 2.5,
        cdu_reservoir_distance_cm: 15.0,
        diesel_distance_cm: 30.0,
        rack_it_kw: 8.0,
      },
    };

    const parsed = RawTelemetryPayloadSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });
});
