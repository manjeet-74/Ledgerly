import { describe, expect, it } from 'vitest';
import { confidence } from './confidence';

describe('confidence', () => {
  it('computes the exact formula for nDays=90, cv=0.2', () => {
    // 0.5 + 0.45 * (1 - 1/(1+90/14)) * (1 - 0.2) = 0.81154... -> 0.81
    expect(confidence(90, 0.2)).toBe(0.81);
  });
  it('never goes below 0.30', () => {
    expect(confidence(0, 1)).toBeGreaterThanOrEqual(0.3);
  });
  it('never goes above 0.95', () => {
    expect(confidence(10000, 0)).toBeLessThanOrEqual(0.95);
  });
  it('increases with more days, all else equal', () => {
    expect(confidence(90, 0.3)).toBeGreaterThan(confidence(14, 0.3));
  });
  it('decreases with more noise, all else equal', () => {
    expect(confidence(90, 0.1)).toBeGreaterThan(confidence(90, 0.9));
  });
});
