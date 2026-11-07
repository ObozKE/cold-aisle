export type ScenarioName =
  | 'normal'
  | 'thermal_spike'
  | 'cdu_leak'
  | 'power_cut'
  | 'fuel_depletion'
  | 'sensor_dropout'
  | 'recovery';

export interface TelemetryReadings {
  cold_aisle_temp_c: number;
  cold_aisle_rh: number;
  hot_aisle_temp_c: number;
  hot_aisle_rh: number;
  coolant_pressure_bar: number;
  cdu_reservoir_distance_cm: number;
  diesel_distance_cm: number;
  rack_it_kw: number;
}

export interface SimState {
  currentScenario: ScenarioName;
  stepCount: number;
  scenarioStep: number;
  readings: TelemetryReadings;
  isSilent: boolean; // For sensor_dropout
}
