import { z } from 'zod';

// Physical range validator ensuring finite numbers within plausible bounds
const finiteNumberBetween = (min: number, max: number, fieldName: string) =>
  z
    .number()
    .refine((v) => Number.isFinite(v), {
      message: `${fieldName} must be a finite number`,
    })
    .refine((v) => v >= min && v <= max, {
      message: `${fieldName} must be between ${min} and ${max}`,
    });

export const TelemetryReadingsSchema = z.object({
  cold_aisle_temp_c: finiteNumberBetween(0, 60, 'cold_aisle_temp_c'),
  cold_aisle_rh: finiteNumberBetween(0, 100, 'cold_aisle_rh'),
  hot_aisle_temp_c: finiteNumberBetween(0, 80, 'hot_aisle_temp_c'),
  hot_aisle_rh: finiteNumberBetween(0, 100, 'hot_aisle_rh'),
  coolant_pressure_bar: finiteNumberBetween(0, 10, 'coolant_pressure_bar'),
  cdu_reservoir_distance_cm: finiteNumberBetween(0, 100, 'cdu_reservoir_distance_cm'),
  diesel_distance_cm: finiteNumberBetween(0, 300, 'diesel_distance_cm'),
  rack_it_kw: finiteNumberBetween(0, 50, 'rack_it_kw'),
});

export const RawTelemetryPayloadSchema = z.object({
  device: z.string().min(1).max(64),
  ts: z.string().optional(),
  readings: TelemetryReadingsSchema,
});

export type RawTelemetryPayload = z.infer<typeof RawTelemetryPayloadSchema>;
export type TelemetryReadings = z.infer<typeof TelemetryReadingsSchema>;

const MAX_DRIFT_SECONDS = 300; // 5 minutes

/**
 * Validates and normalizes timestamp.
 * If missing, invalid, or drifted > 5 minutes from server clock, returns server time.
 */
export function sanitizeTimestamp(rawTs?: string): Date {
  const now = new Date();
  if (!rawTs) return now;

  const parsed = new Date(rawTs);
  if (isNaN(parsed.getTime())) return now;

  const driftSeconds = Math.abs((now.getTime() - parsed.getTime()) / 1000);
  if (driftSeconds > MAX_DRIFT_SECONDS) {
    return now;
  }

  return parsed;
}
