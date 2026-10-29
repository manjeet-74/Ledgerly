import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BudgetShiftParams, Metric } from '@ledgerly/shared';
import { mulberry32, round2 } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EngineService } from '../engine/engine.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { OutcomeService } from '../outcome/outcome.service';
import { PolicyService } from '../policy/policy.service';
import type { RequestActor } from '../../common/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const CHANNELS = [
  { name: 'Google Search', baseRoas: 4.2, baseSpend: 1200 },
  { name: 'Meta Ads', baseRoas: 2.6, baseSpend: 900 },
  { name: 'Email', baseRoas: 7.5, baseSpend: 150 },
  { name: 'Display', baseRoas: 1.4, baseSpend: 400 },
] as const;

const SYSTEM_ACTOR: RequestActor = { name: 'System', role: 'ADMIN' };
const DIRECTOR: RequestActor = { name: 'Dev Director', role: 'MARKETING_DIRECTOR' };
const FINANCE: RequestActor = { name: 'Fiona Finance', role: 'FINANCE' };
const EXECUTOR: RequestActor = { name: 'Eli Executor', role: 'EXECUTOR' };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Builds the 90-day, 4-channel deterministic demo dataset, including the
 * planted "Meta Ads anomaly / Google Search uplift" story in the last 7
 * days -- the exact story `generateDecisions` is designed to catch.
 */
export function generateDemoMetrics(today: Date): Metric[] {
  const lastDay = new Date(today.getTime() - DAY_MS); // "ending 1 day before today"
  const metrics: Metric[] = [];

  for (let dayIndex = 0; dayIndex < 90; dayIndex += 1) {
    const date = new Date(lastDay.getTime() - (89 - dayIndex) * DAY_MS);
    const isLastWeek = dayIndex >= 83; // last 7 of the 90 days

    CHANNELS.forEach((channel, channelIndex) => {
      const rand = mulberry32(20260101 + dayIndex * 10 + channelIndex)();
      const spend = round2(channel.baseSpend * (0.9 + 0.2 * rand));
      let roas = channel.baseRoas * (0.9 + 0.2 * rand);

      if (isLastWeek && channel.name === 'Meta Ads') roas *= 0.55; // the anomaly
      if (isLastWeek && channel.name === 'Google Search') roas *= 1.1; // the uplift

      const revenue = round2(spend * roas);
      const clicks = Math.round(spend / 1.2);
      const impressions = Math.round(clicks * 30);
      const conversions = Math.round(revenue / 80);

      metrics.push({ date: isoDate(date), channel: channel.name, spend, revenue, impressions, clicks, conversions });
    });
  }

  return metrics;
}

interface HistoricalStory {
  from: string;
  to: string;
  shiftAmount: number;
  promised: number;
  confidence: number;
  delivered: number;
  daysAgoCreated: number;
}

/** 3 older, already-resolved decisions -- one deliberately under-delivers, so the Evidence/Outcome UI has something honest to show, not just wins. */
const HISTORICAL_STORIES: HistoricalStory[] = [
  { from: 'Display', to: 'Google Search', shiftAmount: 1800, promised: 6000, confidence: 0.75, delivered: 4000, daysAgoCreated: 45 },
  { from: 'Meta Ads', to: 'Email', shiftAmount: 700, promised: 3000, confidence: 0.82, delivered: 3200, daysAgoCreated: 30 },
  { from: 'Display', to: 'Email', shiftAmount: 450, promised: 1500, confidence: 0.7, delivered: 1450, daysAgoCreated: 20 },
];

@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineService: EngineService,
    private readonly approvalsService: ApprovalsService,
    private readonly outcomeService: OutcomeService,
    private readonly policyService: PolicyService,
  ) {}

  private async clearDemoData(): Promise<void> {
    // AuditEvent and Decision first (Decision cascades EvidenceStep/Approval/
    // Outcome); order doesn't matter for correctness here since neither has
    // a DB-enforced FK to the other, but doing it this way keeps the delete
    // list readable top-to-bottom by "what depends on what".
    await this.prisma.auditEvent.deleteMany({ where: { workspace: 'DEMO' } });
    await this.prisma.decision.deleteMany({ where: { workspace: 'DEMO' } });
    await this.prisma.metricRow.deleteMany({ where: { workspace: 'DEMO' } });
    await this.prisma.upload.deleteMany({ where: { workspace: 'DEMO' } });
    await this.prisma.policy.deleteMany({ where: { workspace: 'DEMO' } });
  }

  private async seedMetrics(): Promise<void> {
    const metrics = generateDemoMetrics(new Date());
    const values = metrics.map(
      (m) => Prisma.sql`(
        ${randomUUID()}, 'DEMO'::"Workspace", ${m.date}::date, ${m.channel},
        ${m.spend}, ${m.revenue}, ${m.impressions}, ${m.clicks}, ${m.conversions}
      )`,
    );
    // Chunked the same way DataService does, for the same reason: Postgres
    // caps how much a single INSERT can reasonably hold.
    const BATCH_SIZE = 500;
    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      await this.prisma.$executeRaw`
        INSERT INTO "MetricRow" (id, workspace, date, channel, spend, revenue, impressions, clicks, conversions)
        VALUES ${Prisma.join(values.slice(i, i + BATCH_SIZE))}
      `;
    }
  }

  /** Plays each historical story through the REAL approve/execute/outcome services, so its audit trail and hash chain are indistinguishable from a decision a real user walked through. */
  private async seedHistoricalDecision(story: HistoricalStory): Promise<void> {
    const createdAt = new Date(Date.now() - story.daysAgoCreated * DAY_MS);
    const params: BudgetShiftParams = {
      from: story.from,
      to: story.to,
      shiftAmount: story.shiftAmount,
      shiftPct: 20,
      roasHigh: 4.0,
      roasLow: 2.0,
      weeklyDonorSpend: story.shiftAmount * 5,
    };

    const decision = await this.prisma.decision.create({
      data: {
        workspace: 'DEMO',
        type: 'BUDGET_SHIFT',
        title: `Shift $${story.shiftAmount}/week from ${story.from} to ${story.to}`,
        summary: `Historical decision: moved $${story.shiftAmount}/week from ${story.from} to ${story.to}.`,
        status: 'PENDING_REVIEW',
        expectedImpact: story.promised,
        confidence: story.confidence,
        priorityScore: round2(story.promised * story.confidence),
        params: params as unknown as Prisma.InputJsonValue,
        owner: 'MARKETING_DIRECTOR',
        deadline: new Date(createdAt.getTime() + 5 * DAY_MS),
        createdAt,
      },
    });

    await this.prisma.evidenceStep.create({
      data: {
        decisionId: decision.id,
        order: 1,
        kind: 'DATA',
        title: 'Historical record',
        detail: `This decision was made ${story.daysAgoCreated} days ago, before the current data window.`,
        status: 'INFO',
        payload: { daysAgoCreated: story.daysAgoCreated },
      },
    });

    await this.prisma.approval.createMany({
      data: [
        { decisionId: decision.id, step: 'MARKETING', order: 1 },
        { decisionId: decision.id, step: 'FINANCE', order: 2 },
      ],
    });

    await this.approvalsService.approve('DEMO', decision.id, DIRECTOR, { comment: 'Approved.' });
    await this.approvalsService.approve('DEMO', decision.id, FINANCE, { spendCap: story.shiftAmount * 2 });
    await this.approvalsService.execute('DEMO', decision.id, EXECUTOR, {
      metric: 'ROAS',
      channel: story.to,
      below: 1,
      afterDays: 7,
    });
    await this.outcomeService.finalizeOutcome('DEMO', decision.id, story.delivered, 'Historical outcome (seed data).');
  }

  /** Full demo seed: metrics, policy, one live engine run, and 3 resolved historical decisions. */
  async seedDemo(): Promise<void> {
    await this.clearDemoData();
    await this.policyService.ensurePolicy('DEMO');
    await this.seedMetrics();

    for (const story of HISTORICAL_STORIES) {
      await this.seedHistoricalDecision(story);
    }

    const result = await this.engineService.run('DEMO', SYSTEM_ACTOR);
    this.logger.log(`Demo seed complete: ${result.created} fresh decision(s) created by the engine.`);
  }
}
