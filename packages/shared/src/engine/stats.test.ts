import { describe, expect, it } from 'vitest';
import { coefVar, mean, round2, stdev, zScore } from './stats';

describe('mean', () => {
  it('averages a list', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
  it('is 0 for an empty list', () => {
    expect(mean([])).toBe(0);
  });
});

describe('stdev', () => {
  it('is 0 for fewer than 2 points', () => {
    expect(stdev([])).toBe(0);
    expect(stdev([5])).toBe(0);
  });
  it('computes sample stdev', () => {
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });
});

describe('zScore', () => {
  it('is 0 when stdev is 0', () => {
    expect(zScore(5, [5, 5, 5])).toBe(0);
  });
  it('computes how many stdevs from the mean', () => {
    const xs = [10, 12, 14, 16, 18];
    expect(zScore(20, xs)).toBeCloseTo((20 - mean(xs)) / stdev(xs), 5);
  });
});

describe('coefVar', () => {
  it('is 1 when mean is 0', () => {
    expect(coefVar([0, 0, 0])).toBe(1);
  });
  it('is stdev/mean otherwise', () => {
    const xs = [10, 20, 30];
    expect(coefVar(xs)).toBeCloseTo(stdev(xs) / mean(xs), 5);
  });
});

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.005)).toBe(1); // float representation; documents real behavior
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
  });
});
