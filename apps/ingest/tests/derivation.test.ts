import { describe, it, expect } from 'vitest';
import {
  calculateTankLevel,
  calculateDeltaT,
  calculateDieselBurnRate,
  calculateDieselRuntimeHours,
  TankGeometryConfig,
} from '../src/engine/derivation.js';

describe('Physics & Telemetry Derivation Mathematics', () => {
  describe('CDU Coolant Reservoir Geometry', () => {
    const cduConfig: TankGeometryConfig = {
      tank_height_cm: 40.0,
      usable_height_cm: 35.0,
      deadzone_cm: 5.0,
      capacity_litres: 80.0,
    };

    it('calculates 100% capacity at top deadzone distance (5 cm)', () => {
      const res = calculateTankLevel(5.0, cduConfig);
      expect(res.fill_cm).toBe(35.0);
      expect(res.level_pct).toBe(100.0);
      expect(res.current_litres).toBe(80.0);
    });

    it('calculates 0% capacity when completely empty (distance >= 40 cm)', () => {
      const res = calculateTankLevel(40.0, cduConfig);
      expect(res.fill_cm).toBe(0.0);
      expect(res.level_pct).toBe(0.0);
      expect(res.current_litres).toBe(0.0);
    });

    it('clamps gracefully when ultrasonic distance exceeds tank depth (aberrant bounce)', () => {
      const res = calculateTankLevel(55.0, cduConfig);
      expect(res.fill_cm).toBe(0.0);
      expect(res.level_pct).toBe(0.0);
      expect(res.current_litres).toBe(0.0);
    });

    it('clamps to usable height when distance is smaller than deadzone (sensor submerged/splashed)', () => {
      const res = calculateTankLevel(1.0, cduConfig);
      expect(res.fill_cm).toBe(35.0);
      expect(res.level_pct).toBe(100.0);
      expect(res.current_litres).toBe(80.0);
    });

    it('accurately resolves telemetry contract example distance (14.2 cm)', () => {
      // raw fill = 40.0 - 14.2 = 25.8 cm
      // level pct = (25.8 / 35.0) * 100 = 73.714% -> 73.71%
      // litres = (73.714 / 100) * 80 = 58.97 L
      const res = calculateTankLevel(14.2, cduConfig);
      expect(res.fill_cm).toBe(25.8);
      expect(res.level_pct).toBe(73.71);
      expect(res.current_litres).toBe(58.97);
    });
  });

  describe('Diesel Generator Fuel Day-Tank Geometry', () => {
    const dieselConfig: TankGeometryConfig = {
      tank_height_cm: 150.0,
      usable_height_cm: 135.0,
      deadzone_cm: 15.0,
      capacity_litres: 2000.0,
      nominal_burn_rate_lph: 65.0,
      full_load_burn_rate_lph: 110.0,
    };

    it('resolves contract example distance (31.0 cm)', () => {
      // fill = 150 - 31 = 119 cm
      // pct = (119 / 135) * 100 = 88.15%
      // litres = 0.88148 * 2000 = 1762.96 L
      const res = calculateTankLevel(31.0, dieselConfig);
      expect(res.fill_cm).toBe(119.0);
      expect(res.level_pct).toBe(88.15);
      expect(res.current_litres).toBe(1762.96);
    });

    it('models diesel burn rate dynamically by IT load', () => {
      // 0 kW IT load -> base idle 65 L/h
      expect(calculateDieselBurnRate(0, { rated_gen_kw: 800, nominal_burn_rate_lph: 65, full_load_burn_rate_lph: 110 })).toBe(65.0);

      // 400 kW IT load (50% factor) -> 65 + 0.5 * (110 - 65) = 87.5 L/h
      expect(calculateDieselBurnRate(400, { rated_gen_kw: 800, nominal_burn_rate_lph: 65, full_load_burn_rate_lph: 110 })).toBe(87.5);

      // 800 kW IT load (100% factor) -> 110 L/h
      expect(calculateDieselBurnRate(800, { rated_gen_kw: 800, nominal_burn_rate_lph: 65, full_load_burn_rate_lph: 110 })).toBe(110.0);
    });

    it('computes standby autonomy runtime hours from litres and burn rate', () => {
      const litres = 1762.96;
      const burnRate = 65.0; // L/h
      // 1762.96 / 65.0 = 27.12 hours
      const runtime = calculateDieselRuntimeHours(litres, burnRate);
      expect(runtime).toBe(27.12);
    });

    it('returns 0 hours runtime when tank is dry or burn rate is 0', () => {
      expect(calculateDieselRuntimeHours(0, 65.0)).toBe(0);
      expect(calculateDieselRuntimeHours(1000, 0)).toBe(0);
    });
  });

  describe('Thermal Differential (Delta-T)', () => {
    it('computes positive delta-T for typical airflow (hot exhaust - cold supply)', () => {
      const deltaT = calculateDeltaT(22.4, 35.1);
      expect(deltaT).toBe(12.7);
    });

    it('detects severe thermal containment breach or airflow starvation', () => {
      const deltaT = calculateDeltaT(21.0, 44.5);
      expect(deltaT).toBe(23.5);
    });

    it('handles equal temperatures when server equipment is unpowered', () => {
      const deltaT = calculateDeltaT(22.0, 22.0);
      expect(deltaT).toBe(0.0);
    });
  });
});
