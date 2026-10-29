import { describe, expect, it } from 'vitest';
import { DEFAULT_ENGINE_CONFIG } from '../types';
import {
  BUDGET_SHIFT_RULES,
  ruleConcentration,
  ruleMaxShift,
  ruleMinData,
  ruleMinSpend,
  ruleRoasGap,
  type BudgetShiftRuleContext,
} from './rules';

function baseCtx(overrides: Partial<BudgetShiftRuleContext> = {}): BudgetShiftRuleContext {
  return {
    engine: DEFAULT_ENGINE_CONFIG,
    nDays: 42,
    donorChannel: 'B',
    donorRecentSpend: 7000,
    receiverChannel: 'A',
    roasHigh: 4.0,
    roasLow: 2.0,
    shiftPct: 20,
    shiftAmount: 1400,
    totalWeeklySpend: 14000,
    receiverWeeklySpend: 7000,
    ...overrides,
  };
}

describe('individual rules', () => {
  it('ruleMinData fails below the threshold', () => {
    expect(ruleMinData(baseCtx({ nDays: 5 })).status).toBe('FAIL');
    expect(ruleMinData(baseCtx({ nDays: 14 })).status).toBe('PASS');
  });

  it('ruleMinSpend fails below the threshold', () => {
    expect(ruleMinSpend(baseCtx({ donorRecentSpend: 50 })).status).toBe('FAIL');
    expect(ruleMinSpend(baseCtx({ donorRecentSpend: 100 })).status).toBe('PASS');
  });

  it('ruleRoasGap fails when channels are too similar', () => {
    expect(ruleRoasGap(baseCtx({ roasHigh: 2.1, roasLow: 2.0 })).status).toBe('FAIL');
    expect(ruleRoasGap(baseCtx({ roasHigh: 4.0, roasLow: 2.0 })).status).toBe('PASS');
  });

  it('ruleMaxShift fails when shiftPct exceeds the cap', () => {
    expect(ruleMaxShift(baseCtx({ shiftPct: 25 })).status).toBe('FAIL');
    expect(ruleMaxShift(baseCtx({ shiftPct: 20 })).status).toBe('PASS');
  });

  it('ruleConcentration fails when the receiver would hold too much share', () => {
    expect(
      ruleConcentration(baseCtx({ receiverWeeklySpend: 12000, shiftAmount: 1400, totalWeeklySpend: 14000 }))
        .status,
    ).toBe('FAIL');
    expect(ruleConcentration(baseCtx()).status).toBe('PASS');
  });

  it('BUDGET_SHIFT_RULES contains exactly the 5 rules in order', () => {
    expect(BUDGET_SHIFT_RULES).toHaveLength(5);
  });
});
