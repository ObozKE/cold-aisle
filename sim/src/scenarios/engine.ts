import { ScenarioName, SimState, TelemetryReadings } from './types.js';

export const BASELINE_READINGS: TelemetryReadings = {
  cold_aisle_temp_c: 22.4,
  cold_aisle_rh: 46.0,
  hot_aisle_temp_c: 35.1,
  hot_aisle_rh: 28.0,
  coolant_pressure_bar: 2.60,
  cdu_reservoir_distance_cm: 14.2, // ~73.7% fill (usable 35cm, tank 40cm)
  diesel_distance_cm: 31.0,        // ~88.1% fill (usable 135cm, tank 150cm)
  rack_it_kw: 7.8,
};

function jitter(base: number, range: number): number {
  return Number((base + (Math.random() * 2 - 1) * range).toFixed(2));
}

export class ScenarioEngine {
  private state: SimState;

  constructor(initialScenario: ScenarioName = 'normal') {
    this.state = {
      currentScenario: initialScenario,
      stepCount: 0,
      scenarioStep: 0,
      readings: { ...BASELINE_READINGS },
      isSilent: false,
    };
  }

  public setScenario(scenario: ScenarioName): void {
    if (this.state.currentScenario !== scenario) {
      this.state.currentScenario = scenario;
      this.state.scenarioStep = 0;
      if (scenario !== 'sensor_dropout') {
        this.state.isSilent = false;
      }
    }
  }

  public getScenario(): ScenarioName {
    return this.state.currentScenario;
  }

  public nextTick(): { readings: TelemetryReadings; isSilent: boolean } {
    this.state.stepCount++;
    this.state.scenarioStep++;

    const s = this.state.scenarioStep;
    const current = { ...this.state.readings };

    switch (this.state.currentScenario) {
      case 'normal': {
        this.state.isSilent = false;
        current.cold_aisle_temp_c = jitter(22.4, 0.3);
        current.cold_aisle_rh = jitter(46.0, 1.0);
        current.hot_aisle_temp_c = jitter(35.1, 0.4);
        current.hot_aisle_rh = jitter(28.0, 0.8);
        current.coolant_pressure_bar = jitter(2.60, 0.03);
        current.cdu_reservoir_distance_cm = jitter(14.2, 0.1);
        current.diesel_distance_cm = jitter(31.0, 0.1);
        current.rack_it_kw = jitter(7.8, 0.3);
        break;
      }

      case 'thermal_spike': {
        this.state.isSilent = false;
        // CRAH failure: Cold aisle warms up rapidly towards 38°C
        current.cold_aisle_temp_c = Math.min(38.0, Number((22.4 + s * 1.3).toFixed(2)));
        // Hot aisle climbs up towards 56°C
        current.hot_aisle_temp_c = Math.min(56.0, Number((35.1 + s * 1.8).toFixed(2)));
        current.cold_aisle_rh = Math.max(18.0, Number((46.0 - s * 1.2).toFixed(2)));
        current.hot_aisle_rh = Math.max(15.0, Number((28.0 - s * 0.8).toFixed(2)));
        current.coolant_pressure_bar = jitter(2.65, 0.04);
        current.rack_it_kw = jitter(8.2, 0.2);
        break;
      }

      case 'cdu_leak': {
        this.state.isSilent = false;
        // Coolant reservoir drops rapidly (distance increases from 14.2cm towards 38cm)
        current.cdu_reservoir_distance_cm = Math.min(
          38.5,
          Number((14.2 + s * 1.5).toFixed(2))
        );
        // Coolant loop pressure collapses simultaneously (from 2.6 bar down towards 0.6 bar)
        current.coolant_pressure_bar = Math.max(
          0.6,
          Number((2.60 - s * 0.15).toFixed(2))
        );
        // Temperatures climb slightly due to degraded heat extraction
        current.cold_aisle_temp_c = Math.min(27.5, Number((22.4 + s * 0.3).toFixed(2)));
        current.hot_aisle_temp_c = Math.min(40.0, Number((35.1 + s * 0.4).toFixed(2)));
        break;
      }

      case 'power_cut': {
        this.state.isSilent = false;
        // Standby diesel generator engaging under full hall load
        current.rack_it_kw = s < 3 ? 6.2 : jitter(8.5, 0.4);
        // Diesel fuel starts burning steadily (distance increases)
        current.diesel_distance_cm = Math.min(
          140.0,
          Number((31.0 + s * 0.6).toFixed(2))
        );
        current.coolant_pressure_bar = jitter(2.55, 0.05);
        current.cold_aisle_temp_c = jitter(23.0, 0.3);
        current.hot_aisle_temp_c = jitter(36.0, 0.4);
        break;
      }

      case 'fuel_depletion': {
        this.state.isSilent = false;
        // Accelerated fuel drain / severe day tank breach
        current.diesel_distance_cm = Math.min(
          145.0,
          Number((31.0 + s * 5.0).toFixed(2))
        );
        current.rack_it_kw = jitter(8.0, 0.3);
        current.coolant_pressure_bar = jitter(2.58, 0.03);
        break;
      }

      case 'sensor_dropout': {
        // Device hardware drops off the network / brownout
        this.state.isSilent = true;
        break;
      }

      case 'recovery': {
        this.state.isSilent = false;
        // Smooth asymptotic recovery back towards baseline values
        const lerp = (cur: number, target: number, rate = 0.25) =>
          Number((cur + (target - cur) * rate).toFixed(2));

        current.cold_aisle_temp_c = lerp(current.cold_aisle_temp_c, BASELINE_READINGS.cold_aisle_temp_c);
        current.hot_aisle_temp_c = lerp(current.hot_aisle_temp_c, BASELINE_READINGS.hot_aisle_temp_c);
        current.cold_aisle_rh = lerp(current.cold_aisle_rh, BASELINE_READINGS.cold_aisle_rh);
        current.hot_aisle_rh = lerp(current.hot_aisle_rh, BASELINE_READINGS.hot_aisle_rh);
        current.coolant_pressure_bar = lerp(current.coolant_pressure_bar, BASELINE_READINGS.coolant_pressure_bar);
        current.cdu_reservoir_distance_cm = lerp(current.cdu_reservoir_distance_cm, BASELINE_READINGS.cdu_reservoir_distance_cm);
        current.diesel_distance_cm = lerp(current.diesel_distance_cm, BASELINE_READINGS.diesel_distance_cm);
        current.rack_it_kw = lerp(current.rack_it_kw, BASELINE_READINGS.rack_it_kw);

        // If very close to baseline, transition to 'normal' automatically
        if (
          Math.abs(current.cold_aisle_temp_c - BASELINE_READINGS.cold_aisle_temp_c) < 0.2 &&
          Math.abs(current.coolant_pressure_bar - BASELINE_READINGS.coolant_pressure_bar) < 0.05
        ) {
          this.state.currentScenario = 'normal';
          this.state.scenarioStep = 0;
        }
        break;
      }
    }

    this.state.readings = current;
    return {
      readings: current,
      isSilent: this.state.isSilent,
    };
  }
}
