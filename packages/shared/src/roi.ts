import { round2 } from './engine/stats';

export interface RoiInputs {
  monthlyAdSpend: number;
  analystHoursPerWeek: number;
  hourlyCost: number;
  wastePct?: number; // default 12
  recoveryPct?: number; // default 25
  timeSavedPct?: number; // default 60
  monthlyPlatformCost?: number; // default 0
}

export interface RoiResult {
  spendRecovered: number;
  hoursSaved: number;
  laborSaved: number;
  monthlyBenefit: number;
  netMonthly: number;
  annualNet: number;
  paybackMonths: number;
}

function nonNegative(x: number): number {
  return Math.max(0, x);
}

/**
 * Estimated savings from catching wasted ad spend earlier and from
 * automating analyst busywork. Every input is clamped to >= 0 since a
 * negative spend or hourly rate makes no real-world sense.
 */
export function calculateRoi(inputs: RoiInputs): RoiResult {
  const monthlyAdSpend = nonNegative(inputs.monthlyAdSpend);
  const analystHoursPerWeek = nonNegative(inputs.analystHoursPerWeek);
  const hourlyCost = nonNegative(inputs.hourlyCost);
  const wastePct = nonNegative(inputs.wastePct ?? 12);
  const recoveryPct = nonNegative(inputs.recoveryPct ?? 25);
  const timeSavedPct = nonNegative(inputs.timeSavedPct ?? 60);
  const monthlyPlatformCost = nonNegative(inputs.monthlyPlatformCost ?? 0);

  const spendRecovered = round2(monthlyAdSpend * (wastePct / 100) * (recoveryPct / 100));
  const hoursSaved = round2(analystHoursPerWeek * 4.33 * (timeSavedPct / 100));
  const laborSaved = round2(hoursSaved * hourlyCost);
  const monthlyBenefit = round2(spendRecovered + laborSaved);
  const netMonthly = round2(monthlyBenefit - monthlyPlatformCost);
  const annualNet = round2(netMonthly * 12);
  const paybackMonths =
    monthlyPlatformCost > 0 && monthlyBenefit > 0
      ? round2(monthlyPlatformCost / monthlyBenefit)
      : 0;

  return {
    spendRecovered,
    hoursSaved,
    laborSaved,
    monthlyBenefit,
    netMonthly,
    annualNet,
    paybackMonths,
  };
}
