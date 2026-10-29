import { describe, expect, it } from 'vitest';
import { anomalyRevenueAtRisk, budgetShiftImpact } from './impact';

describe('budgetShiftImpact', () => {
  it('applies the 0.7 dampening by default', () => {
    // 1000 * (4.0 - 2.0) * 0.7 = 1400
    expect(budgetShiftImpact({ shiftAmount: 1000, roasHigh: 4.0, roasLow: 2.0 })).toBe(1400);
  });
  it('accepts a custom dampening', () => {
    expect(budgetShiftImpact({ shiftAmount: 1000, roasHigh: 4.0, roasLow: 2.0, dampening: 1 })).toBe(2000);
  });
});

describe('anomalyRevenueAtRisk', () => {
  it('computes the gap times weekly spend', () => {
    // (3.0 - 1.5) * 900 = 1350
    expect(anomalyRevenueAtRisk({ baselineRoas: 3.0, currentRoas: 1.5, weeklySpend: 900 })).toBe(1350);
  });
  it('clamps to 0 when current ROAS exceeds baseline', () => {
    expect(anomalyRevenueAtRisk({ baselineRoas: 1.5, currentRoas: 3.0, weeklySpend: 900 })).toBe(0);
  });
});
