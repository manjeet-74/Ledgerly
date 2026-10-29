export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

/** Sample standard deviation (n-1 denominator). 0 if fewer than 2 points. */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** How many standard deviations `value` sits from the mean of `xs`. 0 if stdev is 0. */
export function zScore(value: number, xs: number[]): number {
  const s = stdev(xs);
  if (s === 0) return 0;
  return (value - mean(xs)) / s;
}

/** Coefficient of variation: relative spread of the data. 1 if mean is 0. */
export function coefVar(xs: number[]): number {
  const m = mean(xs);
  if (m === 0) return 1;
  return stdev(xs) / m;
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
