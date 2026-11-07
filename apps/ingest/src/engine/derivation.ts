export interface TankGeometryConfig {
  tank_height_cm: number;
  usable_height_cm: number;
  deadzone_cm?: number;
  capacity_litres: number;
  nominal_burn_rate_lph?: number;
  full_load_burn_rate_lph?: number;
}

export interface TankDerivationResult {
  fill_cm: number;
  level_pct: number;
  current_litres: number;
}

/**
 * Calculates tank fill height, percentage, and stored litres from ultrasonic distance.
 * Formula:
 *   fill_cm = tank_height_cm - distance_cm
 *   clamped_fill = clamp(fill_cm, 0, usable_height_cm)
 *   level_pct = (clamped_fill / usable_height_cm) * 100
 *   litres = (level_pct / 100) * capacity_litres
 */
export function calculateTankLevel(
  distance_cm: number,
  config: TankGeometryConfig
): TankDerivationResult {
  const rawFill = config.tank_height_cm - distance_cm;
  const clampedFill = Math.max(0, Math.min(rawFill, config.usable_height_cm));
  const levelPct = config.usable_height_cm > 0 ? (clampedFill / config.usable_height_cm) * 100 : 0;
  const currentLitres = (levelPct / 100) * config.capacity_litres;

  return {
    fill_cm: Number(clampedFill.toFixed(2)),
    level_pct: Number(levelPct.toFixed(2)),
    current_litres: Number(currentLitres.toFixed(2)),
  };
}

/**
 * Calculates delta-T between exhaust hot aisle and supply cold aisle.
 * Delta-T = T_hot - T_cold
 */
export function calculateDeltaT(cold_temp_c: number, hot_temp_c: number): number {
  return Number((hot_temp_c - cold_temp_c).toFixed(2));
}

/**
 * Models generator diesel burn rate as a function of current electrical load.
 * Burn rate scales between base idle burn rate and full-load burn rate.
 */
export function calculateDieselBurnRate(
  it_kw: number,
  options: {
    rated_gen_kw?: number;
    nominal_burn_rate_lph?: number;
    full_load_burn_rate_lph?: number;
  } = {}
): number {
  const ratedGenKw = options.rated_gen_kw ?? 800.0;
  const idleBurnLph = options.nominal_burn_rate_lph ?? 65.0;
  const fullBurnLph = options.full_load_burn_rate_lph ?? 110.0;

  const loadFactor = Math.min(1.0, Math.max(0.0, it_kw / ratedGenKw));
  const burnRate = idleBurnLph + loadFactor * (fullBurnLph - idleBurnLph);
  return Number(burnRate.toFixed(2));
}

/**
 * Calculates remaining standby generator autonomy in hours.
 * Runtime (hours) = Current Litres / Hourly Burn Rate
 */
export function calculateDieselRuntimeHours(
  dieselLitres: number,
  burnRateLph: number
): number {
  if (burnRateLph <= 0 || dieselLitres <= 0) return 0;
  return Number((dieselLitres / burnRateLph).toFixed(2));
}
