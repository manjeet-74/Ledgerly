import { describe, expect, it } from 'vitest';
import { calculateRoi } from './roi';

describe('calculateRoi', () => {
  it('matches a hand-computed example', () => {
    // monthlyAdSpend=50000, wastePct=12, recoveryPct=25
    // spendRecovered = 50000 * 0.12 * 0.25 = 1500
    // hoursSaved = 10 * 4.33 * 0.60 = 25.98
    // laborSaved = 25.98 * 50 = 1299
    // monthlyBenefit = 1500 + 1299 = 2799
    // netMonthly = 2799 - 200 = 2599
    // annualNet = 2599 * 12 = 31188
    // paybackMonths = 200 / 2799 = 0.0714...
    const result = calculateRoi({
      monthlyAdSpend: 50000,
      analystHoursPerWeek: 10,
      hourlyCost: 50,
      monthlyPlatformCost: 200,
    });
    expect(result.spendRecovered).toBe(1500);
    expect(result.hoursSaved).toBe(25.98);
    expect(result.laborSaved).toBe(1299);
    expect(result.monthlyBenefit).toBe(2799);
    expect(result.netMonthly).toBe(2599);
    expect(result.annualNet).toBe(31188);
    expect(result.paybackMonths).toBeCloseTo(0.07, 2);
  });

  it('clamps negative inputs to 0', () => {
    const result = calculateRoi({
      monthlyAdSpend: -100,
      analystHoursPerWeek: -5,
      hourlyCost: -10,
    });
    expect(result.spendRecovered).toBe(0);
    expect(result.laborSaved).toBe(0);
  });

  it('payback is 0 when there is no platform cost', () => {
    const result = calculateRoi({ monthlyAdSpend: 1000, analystHoursPerWeek: 1, hourlyCost: 10 });
    expect(result.paybackMonths).toBe(0);
  });
});
