import type { EngineConfig, StepStatus } from '../types';
import { DEFAULT_ENGINE_CONFIG } from '../types';

export { DEFAULT_ENGINE_CONFIG };

export interface RuleResult {
  status: StepStatus;
  title: string;
  detail: string;
  payload: unknown;
}

/** Everything a budget-shift candidate's rules need to check it. */
export interface BudgetShiftRuleContext {
  engine: EngineConfig;
  nDays: number;
  donorChannel: string;
  donorRecentSpend: number; // last-7-day spend of the donor (low-ROAS) channel
  receiverChannel: string;
  roasHigh: number;
  roasLow: number;
  shiftPct: number;
  shiftAmount: number;
  totalWeeklySpend: number; // across all channels, before the shift
  receiverWeeklySpend: number; // the receiver channel's own weekly spend, before the shift
}

export type Rule = (ctx: BudgetShiftRuleContext) => RuleResult;

/** Enough history to trust the numbers at all. */
export const ruleMinData: Rule = (ctx) => {
  const pass = ctx.nDays >= ctx.engine.minDataDays;
  return {
    status: pass ? 'PASS' : 'FAIL',
    title: 'Minimum data history',
    detail: `${ctx.nDays} days of data (need >= ${ctx.engine.minDataDays}).`,
    payload: { nDays: ctx.nDays, minDataDays: ctx.engine.minDataDays },
  };
};

/** The donor channel must actually be spending enough for a shift to be meaningful. */
export const ruleMinSpend: Rule = (ctx) => {
  const pass = ctx.donorRecentSpend >= ctx.engine.minWeeklySpend;
  return {
    status: pass ? 'PASS' : 'FAIL',
    title: 'Minimum donor spend',
    detail: `${ctx.donorChannel} spent $${ctx.donorRecentSpend.toFixed(2)} last 7 days (need >= $${ctx.engine.minWeeklySpend}).`,
    payload: { donorRecentSpend: ctx.donorRecentSpend, minWeeklySpend: ctx.engine.minWeeklySpend },
  };
};

/** The performance gap between channels must be large enough to be worth acting on. */
export const ruleRoasGap: Rule = (ctx) => {
  const gapPct = ((ctx.roasHigh - ctx.roasLow) / ctx.roasLow) * 100;
  const pass = gapPct >= ctx.engine.minRoasGapPct;
  return {
    status: pass ? 'PASS' : 'FAIL',
    title: 'ROAS gap large enough',
    detail: `Gap is ${gapPct.toFixed(1)}% (need >= ${ctx.engine.minRoasGapPct}%).`,
    payload: { gapPct, minRoasGapPct: ctx.engine.minRoasGapPct },
  };
};

/**
 * The engine already clamps shiftPct to maxShiftPct when it computes it, so
 * this always passes — it exists to leave a recorded, auditable check.
 */
export const ruleMaxShift: Rule = (ctx) => {
  const pass = ctx.shiftPct <= ctx.engine.maxShiftPct;
  return {
    status: pass ? 'PASS' : 'FAIL',
    title: 'Shift within max percent',
    detail: `Shift is ${ctx.shiftPct}% (cap ${ctx.engine.maxShiftPct}%).`,
    payload: { shiftPct: ctx.shiftPct, maxShiftPct: ctx.engine.maxShiftPct },
  };
};

/** Don't let one channel end up holding too much of the total budget. */
export const ruleConcentration: Rule = (ctx) => {
  const receiverAfter = ctx.receiverWeeklySpend + ctx.shiftAmount;
  const sharePct = (receiverAfter / ctx.totalWeeklySpend) * 100;
  const pass = sharePct <= ctx.engine.maxSingleChannelSharePct;
  return {
    status: pass ? 'PASS' : 'FAIL',
    title: 'Spend concentration limit',
    detail: `${ctx.receiverChannel} would hold ${sharePct.toFixed(1)}% of total spend (cap ${ctx.engine.maxSingleChannelSharePct}%).`,
    payload: { sharePct, maxSingleChannelSharePct: ctx.engine.maxSingleChannelSharePct },
  };
};

export const BUDGET_SHIFT_RULES: Rule[] = [
  ruleMinData,
  ruleMinSpend,
  ruleRoasGap,
  ruleMaxShift,
  ruleConcentration,
];
