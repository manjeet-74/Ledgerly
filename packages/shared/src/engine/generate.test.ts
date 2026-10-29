import { describe, expect, it } from 'vitest';
import type { Metric } from '../types';
import { DEFAULT_ENGINE_CONFIG } from '../types';
import { generateDecisions } from './generate';

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(startIso: string, n: number): string {
  const d = new Date(`${startIso}T00:00:00Z`);
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Builds `days` consecutive daily rows for one channel ending the day before `today`. */
function buildChannel(
  channel: string,
  today: string,
  days: number,
  spendByDayIndex: (i: number) => number,
  roasByDayIndex: (i: number) => number,
): Metric[] {
  const start = addDays(today, -days);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i + 1);
    const spend = spendByDayIndex(i);
    const roas = roasByDayIndex(i);
    const revenue = spend * roas;
    return {
      date,
      channel,
      spend,
      revenue,
      impressions: Math.round(spend * 30),
      clicks: Math.round(spend),
      conversions: Math.round(revenue / 80),
    };
  });
}

const TODAY = '2026-02-11';

describe('generateDecisions', () => {
  it('creates one BUDGET_SHIFT from the worst to the best channel (hand-verified)', () => {
    // A: ROAS 4.0 constant, 42 days, $1000/day -> recentSpend $7000
    // B: ROAS 2.0 constant, 42 days, $1000/day -> recentSpend $7000
    // gapPct = (4-2)/2*100 = 100% ; shiftPct = min(20, round(100/5)) = 20
    // shiftAmount = 7000 * 20/100 = 1400
    // impact = 1400 * (4-2) * 0.7 = 1960
    const a = buildChannel('A', TODAY, 42, () => 1000, () => 4.0);
    const b = buildChannel('B', TODAY, 42, () => 1000, () => 2.0);

    const { decisions, droppedByRules } = generateDecisions(
      [...a, ...b],
      DEFAULT_ENGINE_CONFIG,
      TODAY,
    );

    expect(droppedByRules).toBe(0);
    const shift = decisions.find((d) => d.type === 'BUDGET_SHIFT');
    expect(shift).toBeDefined();
    const params = shift!.params as { from: string; to: string; shiftAmount: number; shiftPct: number };
    expect(params.from).toBe('B');
    expect(params.to).toBe('A');
    expect(params.shiftPct).toBe(20);
    expect(params.shiftAmount).toBe(1400);
    expect(shift!.expectedImpact).toBe(1960);
  });

  it('creates one ANOMALY_ALERT when a channel falls hard versus its baseline', () => {
    // Baseline ROAS oscillates 2.9/3.1 (mean ~3.0, small stdev).
    // Recent 7 days drop to a constant 1.5 -> large negative z-score.
    const c = buildChannel(
      'C',
      TODAY,
      42,
      () => 200,
      (i) => (i < 35 ? (i % 2 === 0 ? 2.9 : 3.1) : 1.5),
    );

    const { decisions, droppedByRules } = generateDecisions(c, DEFAULT_ENGINE_CONFIG, TODAY);

    expect(droppedByRules).toBe(0);
    const anomaly = decisions.find((d) => d.type === 'ANOMALY_ALERT');
    expect(anomaly).toBeDefined();
    const params = anomaly!.params as { channel: string; z: number };
    expect(params.channel).toBe('C');
    expect(params.z).toBeLessThanOrEqual(DEFAULT_ENGINE_CONFIG.anomalyZ);
  });

  it('produces no decisions with fewer than minDataDays of history', () => {
    const d = buildChannel('D', TODAY, 10, () => 500, () => 3.0);
    const { decisions, droppedByRules } = generateDecisions(d, DEFAULT_ENGINE_CONFIG, TODAY);
    expect(decisions).toEqual([]);
    expect(droppedByRules).toBe(0);
  });

  it('is deterministic: same inputs always produce the same output', () => {
    const a = buildChannel('A', TODAY, 42, () => 1000, () => 4.0);
    const b = buildChannel('B', TODAY, 42, () => 1000, () => 2.0);
    const run1 = generateDecisions([...a, ...b], DEFAULT_ENGINE_CONFIG, TODAY);
    const run2 = generateDecisions([...a, ...b], DEFAULT_ENGINE_CONFIG, TODAY);
    expect(run1).toEqual(run2);
  });
});
