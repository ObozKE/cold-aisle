import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePue, PueTracker } from '../src/engine/pue.js';
import { RuleEngine, AlertRuleRecord } from '../src/engine/rules.js';

describe('PUE Mathematical Model', () => {
  it('calculates nominal PUE for typical 45 kW IT load at 22°C', () => {
    // 45 kW IT load:
    // Base pump: 2.5 kW
    // Chiller work: 0.192 * 45 = 8.64 kW
    // Thermal penalty: 0 (cold aisle <= 22°C)
    // Cooling kW = 2.5 + 8.64 = 11.14 kW
    // UPS loss kW = 0.0638 * 45 = 2.871 kW
    // Aux/Other kW = 4.5 kW
    // Total facility kW = 45 + 11.14 + 2.871 + 4.5 = 63.511 kW
    // PUE = 63.511 / 45 = 1.411
    const res = calculatePue({ it_kw: 45.0, cold_aisle_temp_c: 22.0 });
    expect(res.it_kw).toBe(45.0);
    expect(res.cooling_kw).toBe(11.14);
    expect(res.ups_loss_kw).toBe(2.871);
    expect(res.other_kw).toBe(4.5);
    expect(res.total_kw).toBe(63.511);
    expect(res.pue).toBe(1.411);
  });

  it('applies thermal cooling penalty when cold aisle exceeds ASHRAE baseline (e.g. 30°C)', () => {
    // At 30°C, thermal delta = 8.0°C
    // Thermal penalty = 8.0 * 0.04 * 45 = 14.4 kW
    // Cooling kW = 2.5 + 8.64 + 14.4 = 25.54 kW
    const nominal = calculatePue({ it_kw: 45.0, cold_aisle_temp_c: 22.0 });
    const stressed = calculatePue({ it_kw: 45.0, cold_aisle_temp_c: 30.0 });

    expect(stressed.cooling_kw).toBeGreaterThan(nominal.cooling_kw);
    expect(stressed.pue).toBeGreaterThan(nominal.pue);
    expect(stressed.pue).toBe(1.731);
  });

  it('handles idle/zero IT load safely', () => {
    const idle = calculatePue({ it_kw: 0, cold_aisle_temp_c: 22.0 });
    expect(idle.it_kw).toBe(0);
    expect(idle.pue).toBe(1.0);
  });

  it('tracks rolling average PUE over time window', () => {
    const tracker = new PueTracker(5);
    tracker.record(new Date(), calculatePue({ it_kw: 45.0, cold_aisle_temp_c: 22.0 })); // 1.411
    tracker.record(new Date(), calculatePue({ it_kw: 45.0, cold_aisle_temp_c: 22.0 })); // 1.411
    tracker.record(new Date(), calculatePue({ it_kw: 45.0, cold_aisle_temp_c: 28.0 })); // 1.651

    const avg = tracker.getRollingAveragePue();
    expect(avg).toBeGreaterThan(1.411);
    expect(avg).toBeLessThan(1.651);
  });
});

describe('Rule Engine: Violation, Hysteresis & Compound Logic', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    engine = new RuleEngine();
  });

  describe('Threshold Violation Checking', () => {
    const coldTempRule: AlertRuleRecord = {
      id: 'rule-1',
      name: 'Cold Aisle High',
      code: 'RULE_COLD_TEMP',
      scope: 'hall',
      metric: 'cold_aisle_temp_c',
      operator: '>',
      warn_threshold: 27.0,
      crit_threshold: 32.0,
      for_seconds: 5,
      hysteresis: 0.5,
      enabled: true,
      metadata: {},
    };

    it('returns not breached when within normal envelope', () => {
      const v = engine.checkViolation(coldTempRule, 24.5);
      expect(v.isBreached).toBe(false);
    });

    it('detects warning breach when exceeding warn_threshold', () => {
      const v = engine.checkViolation(coldTempRule, 28.5);
      expect(v.isBreached).toBe(true);
      expect(v.severity).toBe('warn');
    });

    it('detects critical breach when exceeding crit_threshold', () => {
      const v = engine.checkViolation(coldTempRule, 33.2);
      expect(v.isBreached).toBe(true);
      expect(v.severity).toBe('critical');
    });
  });

  describe('Hysteresis Clearing Margin', () => {
    const coldTempRule: AlertRuleRecord = {
      id: 'rule-1',
      name: 'Cold Aisle High',
      code: 'RULE_COLD_TEMP',
      scope: 'hall',
      metric: 'cold_aisle_temp_c',
      operator: '>',
      warn_threshold: 27.0,
      crit_threshold: 32.0,
      for_seconds: 5,
      hysteresis: 0.5, // Must drop <= 26.5 to clear
      enabled: true,
      metadata: {},
    };

    it('does NOT clear if reading drops below threshold but within hysteresis band', () => {
      // 26.8 is below 27.0, but above (27.0 - 0.5 = 26.5)
      const cleared = engine.checkRecovery(coldTempRule, 26.8);
      expect(cleared).toBe(false);
    });

    it('clears when reading drops completely past hysteresis margin', () => {
      // 26.4 <= 26.5
      const cleared = engine.checkRecovery(coldTempRule, 26.4);
      expect(cleared).toBe(true);
    });

    const pressureRule: AlertRuleRecord = {
      id: 'rule-2',
      name: 'Coolant Pressure Low',
      code: 'RULE_COOLANT_PRESSURE',
      scope: 'asset',
      metric: 'coolant_pressure_bar',
      operator: '<',
      warn_threshold: 1.50,
      crit_threshold: 1.00,
      for_seconds: 5,
      hysteresis: 0.15, // Must rise >= 1.65 to clear
      enabled: true,
      metadata: {},
    };

    it('clears low pressure alert only when recovered past hysteresis deadband', () => {
      expect(engine.checkRecovery(pressureRule, 1.55)).toBe(false); // < 1.65
      expect(engine.checkRecovery(pressureRule, 1.66)).toBe(true);  // >= 1.65
    });
  });

  describe('Compound CDU Leak Detection Rule', () => {
    const leakRule: AlertRuleRecord = {
      id: 'rule-compound-1',
      name: 'CDU Coolant Leak Suspicion',
      code: 'RULE_CDU_LEAK_COMPOUND',
      scope: 'asset',
      metric: 'cdu_leak_suspicion',
      operator: 'compound',
      warn_threshold: 1.5, // 1.5 %/min drop rate
      crit_threshold: 2.0, // 2.0 %/min drop rate
      for_seconds: 5,
      hysteresis: 0.2,
      enabled: true,
      metadata: {},
    };

    it('does not trigger leak alert when reservoir level is steady', () => {
      const v = engine.checkViolation(leakRule, 0.0, {
        dropRatePctMin: 0.1,
        pressure: 2.55,
      });
      expect(v.isBreached).toBe(false);
    });

    it('triggers warning if level is dropping but loop pressure is still maintained', () => {
      const v = engine.checkViolation(leakRule, 1.7, {
        dropRatePctMin: 1.7,
        pressure: 2.50, // Normal pressure
      });
      expect(v.isBreached).toBe(true);
      expect(v.severity).toBe('warn');
    });

    it('triggers CRITICAL compound leak alert when level drops fast AND pressure collapses', () => {
      // Rapid level loss (3.5 %/min) AND loop pressure dropping (1.45 bar < 1.80 bar)
      const v = engine.checkViolation(leakRule, 3.5, {
        dropRatePctMin: 3.5,
        pressure: 1.45,
      });
      expect(v.isBreached).toBe(true);
      expect(v.severity).toBe('critical');
    });
  });
});
