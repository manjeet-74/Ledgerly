import { round2 } from './stats';

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * How much to trust a decision, given how many days of data back it and how
 * noisy (volatile) that data is.
 * More days -> more trust (with diminishing returns via nDays/14).
 * More noise (cv, coefficient of variation) -> less trust.
 */
export function confidence(nDays: number, cv: number): number {
  const dataWeight = 1 - 1 / (1 + nDays / 14);
  const noisePenalty = 1 - Math.min(cv, 1);
  const raw = 0.5 + 0.45 * dataWeight * noisePenalty;
  return round2(clamp(raw, 0.3, 0.95));
}
