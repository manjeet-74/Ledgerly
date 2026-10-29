import { round2 } from './stats';

export interface BudgetShiftImpactInput {
  shiftAmount: number;
  roasHigh: number;
  roasLow: number;
  dampening?: number; // default 0.7
}

/**
 * Projected extra revenue from moving `shiftAmount` of weekly spend from the
 * worse-performing channel (roasLow) to the better one (roasHigh).
 * Dampened by 0.7 because real-world diminishing returns mean a channel
 * rarely keeps its exact ROAS once it receives more budget.
 */
export function budgetShiftImpact(input: BudgetShiftImpactInput): number {
  const dampening = input.dampening ?? 0.7;
  return round2(input.shiftAmount * (input.roasHigh - input.roasLow) * dampening);
}

export interface AnomalyRevenueAtRiskInput {
  baselineRoas: number;
  currentRoas: number;
  weeklySpend: number;
}

/** Weekly revenue being lost right now because ROAS dropped below its baseline. */
export function anomalyRevenueAtRisk(input: AnomalyRevenueAtRiskInput): number {
  const gap = Math.max(0, input.baselineRoas - input.currentRoas);
  return round2(gap * input.weeklySpend);
}
