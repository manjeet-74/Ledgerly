import type {
  AnomalyParams,
  BudgetShiftParams,
  EngineConfig,
  EvidenceDraft,
  GeneratedDecision,
  Metric,
} from '../types';
import { coefVar, mean, round2, stdev, zScore } from './stats';
import { confidence } from './confidence';
import { anomalyRevenueAtRisk, budgetShiftImpact } from './impact';
import { BUDGET_SHIFT_RULES, type BudgetShiftRuleContext } from './rules';

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(toUtcDate(iso).getTime() + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

function inRange(date: string, startInclusive: string, endInclusive: string): boolean {
  return date >= startInclusive && date <= endInclusive;
}

interface ChannelStats {
  channel: string;
  nDays: number;
  recentSpend: number;
  recentRevenue: number;
  recentRoas: number;
  dailyRoasBaseline: number[];
  baselineRoas: number;
  cv: number;
}

function computeChannelStats(
  channel: string,
  rows: Metric[],
  recentStart: string,
  lastDay: string,
  baselineStart: string,
  baselineEnd: string,
): ChannelStats {
  const nDays = new Set(rows.map((r) => r.date)).size;

  const recentRows = rows.filter((r) => inRange(r.date, recentStart, lastDay));
  const recentSpend = round2(recentRows.reduce((s, r) => s + r.spend, 0));
  const recentRevenue = round2(recentRows.reduce((s, r) => s + r.revenue, 0));
  const recentRoas = recentSpend > 0 ? recentRevenue / recentSpend : 0;

  const baselineRows = rows.filter((r) => inRange(r.date, baselineStart, baselineEnd));
  const dailyRoasBaseline = baselineRows
    .filter((r) => r.spend > 0)
    .map((r) => r.revenue / r.spend);
  const baselineRoas = mean(dailyRoasBaseline);
  const cv = coefVar(dailyRoasBaseline);

  return { channel, nDays, recentSpend, recentRevenue, recentRoas, dailyRoasBaseline, baselineRoas, cv };
}

function dataOverviewEvidence(order: number, metrics: Metric[]): EvidenceDraft {
  const channels = Array.from(new Set(metrics.map((m) => m.channel)));
  const dates = metrics.map((m) => m.date).sort();
  return {
    order,
    kind: 'DATA',
    title: 'Data in scope',
    detail: `${metrics.length} rows across ${channels.length} channel(s), from ${dates[0]} to ${dates[dates.length - 1]}.`,
    status: 'INFO',
    payload: { rowCount: metrics.length, channels, from: dates[0], to: dates[dates.length - 1] },
  };
}

function recentVsBaselineEvidence(order: number, stats: ChannelStats): EvidenceDraft {
  return {
    order,
    kind: 'DATA',
    title: 'Recent vs. baseline',
    detail: `${stats.channel}: recent 7-day ROAS ${stats.recentRoas.toFixed(2)} vs. baseline average ${stats.baselineRoas.toFixed(2)}.`,
    status: 'INFO',
    payload: {
      channel: stats.channel,
      recentSpend: stats.recentSpend,
      recentRevenue: stats.recentRevenue,
      recentRoas: round2(stats.recentRoas),
      baselineRoas: round2(stats.baselineRoas),
      baselineSamples: stats.dailyRoasBaseline.length,
    },
  };
}

function confidenceCalcEvidence(order: number, nDays: number, cv: number, result: number): EvidenceDraft {
  return {
    order,
    kind: 'CALC',
    title: 'Confidence formula',
    detail: `confidence(nDays=${nDays}, cv=${cv.toFixed(2)}) = ${result.toFixed(2)}`,
    status: 'INFO',
    payload: { nDays, cv: round2(cv), confidence: result },
  };
}

function buildAnomalyCandidate(
  stats: ChannelStats,
  engine: EngineConfig,
  order0: number,
  baseOverview: EvidenceDraft,
): GeneratedDecision | null {
  if (stats.recentSpend < engine.minWeeklySpend) return null;
  const sd = stdev(stats.dailyRoasBaseline);
  if (sd <= 0) return null;

  const z = zScore(stats.recentRoas, stats.dailyRoasBaseline);
  if (z > engine.anomalyZ) return null;

  const expectedImpact = anomalyRevenueAtRisk({
    baselineRoas: stats.baselineRoas,
    currentRoas: stats.recentRoas,
    weeklySpend: stats.recentSpend,
  });
  const pct = Math.round(((stats.baselineRoas - stats.recentRoas) / stats.baselineRoas) * 100);
  const conf = confidence(stats.nDays, stats.cv);
  const params: AnomalyParams = {
    channel: stats.channel,
    baselineRoas: round2(stats.baselineRoas),
    recentRoas: round2(stats.recentRoas),
    z: round2(z),
    weeklySpend: stats.recentSpend,
  };

  let order = order0;
  const evidence: EvidenceDraft[] = [
    { ...baseOverview, order: order++ },
    recentVsBaselineEvidence(order++, stats),
    {
      order: order++,
      kind: 'MODEL',
      title: 'Z-score',
      detail: `z = (${stats.recentRoas.toFixed(2)} - ${stats.baselineRoas.toFixed(2)}) / ${sd.toFixed(2)} = ${z.toFixed(2)} (threshold ${engine.anomalyZ})`,
      status: 'INFO',
      payload: { z: round2(z), threshold: engine.anomalyZ, stdev: round2(sd) },
    },
    {
      order: order++,
      kind: 'CALC',
      title: 'Revenue at risk formula',
      detail: `max(0, ${stats.baselineRoas.toFixed(2)} - ${stats.recentRoas.toFixed(2)}) * $${stats.recentSpend.toFixed(2)} = $${expectedImpact.toFixed(2)}`,
      status: 'INFO',
      payload: { baselineRoas: round2(stats.baselineRoas), recentRoas: round2(stats.recentRoas), weeklySpend: stats.recentSpend, expectedImpact },
    },
    confidenceCalcEvidence(order++, stats.nDays, stats.cv, conf),
  ];

  return {
    type: 'ANOMALY_ALERT',
    title: `${stats.channel} ROAS dropped ${pct}% below its normal`,
    summary: `${stats.channel}'s return on ad spend fell to ${stats.recentRoas.toFixed(2)} this week, well below its ${stats.baselineRoas.toFixed(2)} baseline, putting roughly $${expectedImpact.toFixed(2)}/week of revenue at risk.`,
    expectedImpact,
    confidence: conf,
    priorityScore: round2(expectedImpact * conf),
    params,
    owner: 'MARKETING_DIRECTOR',
    deadlineDays: 3,
    evidence,
  };
}

function buildBudgetShiftCandidate(
  channelStats: ChannelStats[],
  engine: EngineConfig,
  order0: number,
  baseOverview: EvidenceDraft,
): { decision: GeneratedDecision | null; dropped: boolean } {
  if (channelStats.length < 2) return { decision: null, dropped: false };

  const sorted = [...channelStats].sort((a, b) => b.recentRoas - a.recentRoas);
  const high = sorted[0];
  const low = sorted[sorted.length - 1];
  if (!high || !low || high.channel === low.channel) return { decision: null, dropped: false };
  if (low.recentRoas <= 0) return { decision: null, dropped: false };

  const gapPct = ((high.recentRoas - low.recentRoas) / low.recentRoas) * 100;
  const shiftPct = Math.min(engine.maxShiftPct, Math.round(gapPct / 5));
  const shiftAmount = round2((low.recentSpend * shiftPct) / 100);
  const totalWeeklySpend = round2(channelStats.reduce((s, c) => s + c.recentSpend, 0));

  const ctx: BudgetShiftRuleContext = {
    engine,
    nDays: low.nDays,
    donorChannel: low.channel,
    donorRecentSpend: low.recentSpend,
    receiverChannel: high.channel,
    roasHigh: round2(high.recentRoas),
    roasLow: round2(low.recentRoas),
    shiftPct,
    shiftAmount,
    totalWeeklySpend,
    receiverWeeklySpend: high.recentSpend,
  };

  const ruleResults = BUDGET_SHIFT_RULES.map((rule) => rule(ctx));
  const anyFail = ruleResults.some((r) => r.status === 'FAIL');
  if (anyFail) return { decision: null, dropped: true };

  const expectedImpact = budgetShiftImpact({
    shiftAmount,
    roasHigh: ctx.roasHigh,
    roasLow: ctx.roasLow,
  });
  const conf = confidence(low.nDays, low.cv);
  const params: BudgetShiftParams = {
    from: low.channel,
    to: high.channel,
    shiftAmount,
    shiftPct,
    roasHigh: ctx.roasHigh,
    roasLow: ctx.roasLow,
    weeklyDonorSpend: low.recentSpend,
  };

  let order = order0;
  const evidence: EvidenceDraft[] = [
    { ...baseOverview, order: order++ },
    recentVsBaselineEvidence(order++, low),
    recentVsBaselineEvidence(order++, high),
    {
      order: order++,
      kind: 'MODEL',
      title: 'ROAS ranking',
      detail: `${high.channel} (${ctx.roasHigh.toFixed(2)}) outperforms ${low.channel} (${ctx.roasLow.toFixed(2)}) by ${gapPct.toFixed(1)}%.`,
      status: 'INFO' as const,
      payload: { ranking: sorted.map((c) => ({ channel: c.channel, roas: round2(c.recentRoas) })), gapPct: round2(gapPct) },
    },
    ...ruleResults.map((r, i) => ({
      order: order + i,
      kind: 'RULE' as const,
      title: r.title,
      detail: r.detail,
      status: r.status,
      payload: r.payload,
    })),
  ];
  order += ruleResults.length;
  evidence.push({
    order: order++,
    kind: 'CALC',
    title: 'Impact formula',
    detail: `$${shiftAmount.toFixed(2)} * (${ctx.roasHigh.toFixed(2)} - ${ctx.roasLow.toFixed(2)}) * 0.7 = $${expectedImpact.toFixed(2)}`,
    status: 'INFO',
    payload: { shiftAmount, roasHigh: ctx.roasHigh, roasLow: ctx.roasLow, dampening: 0.7, expectedImpact },
  });
  evidence.push(confidenceCalcEvidence(order++, low.nDays, low.cv, conf));

  const decision: GeneratedDecision = {
    type: 'BUDGET_SHIFT',
    title: `Shift $${shiftAmount.toFixed(2)}/week from ${low.channel} to ${high.channel}`,
    summary: `${low.channel} is returning $${ctx.roasLow.toFixed(2)} per dollar spent, well below ${high.channel}'s $${ctx.roasHigh.toFixed(2)}. Moving $${shiftAmount.toFixed(2)}/week is projected to add $${expectedImpact.toFixed(2)}/week in revenue.`,
    expectedImpact,
    confidence: conf,
    priorityScore: round2(expectedImpact * conf),
    params,
    owner: 'MARKETING_DIRECTOR',
    deadlineDays: 5,
    evidence,
  };

  return { decision, dropped: false };
}

export interface GenerateDecisionsResult {
  decisions: GeneratedDecision[];
  droppedByRules: number;
}

/**
 * The engine. Pure and deterministic: everything it needs comes in through
 * `metrics`, `engine`, and `today` — no clock, no randomness, no I/O. Same
 * inputs always produce the same decisions, which is what makes it testable
 * and what makes the evidence chain trustworthy (the "why" never changes
 * retroactively).
 */
export function generateDecisions(
  metrics: Metric[],
  engine: EngineConfig,
  today: string,
): GenerateDecisionsResult {
  const inScope = metrics.filter((m) => m.date <= today);
  if (inScope.length === 0) return { decisions: [], droppedByRules: 0 };

  const lastDay = inScope.reduce((max, m) => (m.date > max ? m.date : max), inScope[0]!.date);
  const recentStart = addDaysIso(lastDay, -6);
  const baselineEnd = addDaysIso(recentStart, -1);
  const baselineStart = addDaysIso(baselineEnd, -27);

  const byChannel = new Map<string, Metric[]>();
  for (const row of inScope) {
    const list = byChannel.get(row.channel) ?? [];
    list.push(row);
    byChannel.set(row.channel, list);
  }

  const channelStats = Array.from(byChannel.entries()).map(([channel, rows]) =>
    computeChannelStats(channel, rows, recentStart, lastDay, baselineStart, baselineEnd),
  );

  const baseOverview = dataOverviewEvidence(1, inScope);

  const decisions: GeneratedDecision[] = [];
  let droppedByRules = 0;

  for (const stats of channelStats) {
    if (stats.nDays < engine.minDataDays) continue;
    const anomaly = buildAnomalyCandidate(stats, engine, 1, baseOverview);
    if (anomaly) decisions.push(anomaly);
  }

  const eligibleForShift = channelStats.filter((c) => c.nDays >= engine.minDataDays);
  const { decision: shift, dropped } = buildBudgetShiftCandidate(eligibleForShift, engine, 1, baseOverview);
  if (shift) decisions.push(shift);
  if (dropped) droppedByRules += 1;

  decisions.sort((a, b) => b.priorityScore - a.priorityScore);

  return { decisions, droppedByRules };
}
