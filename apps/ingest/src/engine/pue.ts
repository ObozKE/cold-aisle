import { pool } from '../db/pool.js';

export interface PueCalculationInput {
  it_kw: number;
  cold_aisle_temp_c?: number;
  base_pump_kw?: number;
  base_aux_kw?: number;
}

export interface PueCalculationResult {
  it_kw: number;
  cooling_kw: number;
  ups_loss_kw: number;
  other_kw: number;
  total_kw: number;
  pue: number;
}

/**
 * PUE Mathematical Model:
 * Total Facility kW = IT_kW + Cooling_kW + UPS_loss_kW + Aux_kW
 * PUE = Total Facility kW / IT_kW
 *
 * Cooling power is dynamically modeled:
 * - Base CDU circulation pump: 2.5 kW
 * - Chiller work: 0.192 * IT_kW
 * - Thermal penalty for cold aisle above ASHRAE baseline (22°C):
 *   max(0, (cold_temp - 22.0) * 0.04 * IT_kW)
 *
 * UPS loss is modeled for double-conversion online UPS (94% efficiency):
 * - (1 - 0.94) / 0.94 * IT_kW ≈ 0.0638 * IT_kW
 *
 * Aux/Other overhead: 4.5 kW constant per hall.
 */
export function calculatePue(input: PueCalculationInput): PueCalculationResult {
  const it_kw = Math.max(0, Number(input.it_kw.toFixed(3)));
  const basePump = input.base_pump_kw ?? 2.5;
  const auxOther = input.base_aux_kw ?? 4.5;
  const coldTemp = input.cold_aisle_temp_c ?? 22.4;

  if (it_kw <= 0) {
    return {
      it_kw: 0,
      cooling_kw: basePump,
      ups_loss_kw: 0,
      other_kw: auxOther,
      total_kw: basePump + auxOther,
      pue: 1.0, // Indeterminate / idle floor
    };
  }

  // Dynamic Chiller & Fan Work
  const baseChillerWork = 0.192 * it_kw;
  const thermalDelta = Math.max(0, coldTemp - 22.0);
  const thermalPenalty = thermalDelta * 0.04 * it_kw;
  const cooling_kw = Number((basePump + baseChillerWork + thermalPenalty).toFixed(3));

  // Double-Conversion Online UPS Losses (94% efficiency)
  const ups_loss_kw = Number((0.0638 * it_kw).toFixed(3));

  // Other facility baseline overhead
  const other_kw = Number(auxOther.toFixed(3));

  // Total instantaneous facility power
  const total_kw = Number((it_kw + cooling_kw + ups_loss_kw + other_kw).toFixed(3));

  // PUE ratio
  const pue = Number((total_kw / it_kw).toFixed(3));

  return {
    it_kw,
    cooling_kw,
    ups_loss_kw,
    other_kw,
    total_kw,
    pue,
  };
}

/**
 * In-memory rolling window buffer for hall PUE smoothing and trend analysis.
 */
export class PueTracker {
  private samples: Array<{ ts: Date; result: PueCalculationResult }> = [];
  private readonly windowSize: number;

  constructor(windowSize = 20) {
    this.windowSize = windowSize;
  }

  public record(ts: Date, result: PueCalculationResult): void {
    this.samples.push({ ts, result });
    if (this.samples.length > this.windowSize) {
      this.samples.shift();
    }
  }

  public getRollingAveragePue(): number {
    if (this.samples.length === 0) return 1.40;
    const sum = this.samples.reduce((acc, s) => acc + s.result.pue, 0);
    return Number((sum / this.samples.length).toFixed(3));
  }

  public getLatest(): PueCalculationResult | null {
    if (this.samples.length === 0) return null;
    return this.samples[this.samples.length - 1].result;
  }
}

/**
 * Persists calculated PUE sample to PostgreSQL database
 */
export async function storePueSample(
  hallId: string,
  ts: Date,
  result: PueCalculationResult
): Promise<void> {
  await pool.query(
    `INSERT INTO pue_samples (hall_id, ts, it_kw, cooling_kw, ups_loss_kw, other_kw, total_kw, pue)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      hallId,
      ts,
      result.it_kw,
      result.cooling_kw,
      result.ups_loss_kw,
      result.other_kw,
      result.total_kw,
      result.pue,
    ]
  );
}
