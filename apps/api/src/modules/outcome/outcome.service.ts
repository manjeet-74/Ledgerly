import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Workspace } from '@ledgerly/shared';
import { mulberry32, round2 } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Turns a decision's UUID into a stable numeric seed, so each decision's simulated outcome is deterministic but different from every other decision's. */
function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return hash;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OutcomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * The ONE place that turns "promised vs. delivered" into a finished
   * Outcome record. Used by both the DEMO fast-forward (`simulate`) and the
   * real 7-day LIVE check (the BullMQ processor) -- they compute
   * `delivered` completely differently, but what happens once you have
   * that number is identical: confidence adjusts toward reality, the
   * decision closes out as COMPLETED, and it's all written to the audit
   * trail in the same transaction.
   */
  async finalizeOutcome(workspace: Workspace, decisionId: string, delivered: number, note: string) {
    const decision = await this.prisma.decision.findFirst({ where: { id: decisionId, workspace } });
    if (!decision) throw new NotFoundException('Decision not found.');
    if (decision.status !== 'LIVE') {
      throw new BadRequestException(`Cannot finalize an outcome for a decision in status ${decision.status}.`);
    }

    const promised = Number(decision.expectedImpact);
    const confidenceBefore = decision.confidence;
    const confidenceAfter =
      promised === 0
        ? confidenceBefore
        : round2(clamp(confidenceBefore + 0.1 * (delivered / promised - 1), 0.3, 0.95));

    return this.prisma.$transaction(async (tx) => {
      await tx.outcome.create({
        data: {
          decisionId,
          promised,
          delivered: round2(delivered),
          confidenceBefore,
          confidenceAfter,
          note,
        },
      });

      await tx.decision.update({ where: { id: decisionId }, data: { status: 'COMPLETED' } });

      await this.auditService.append(tx, {
        workspace,
        type: 'OUTCOME_RECORDED',
        actorName: 'System',
        actorRole: 'SYSTEM',
        decisionId,
        message: `Outcome recorded: promised $${promised.toFixed(2)}, delivered $${round2(delivered).toFixed(2)}. ${note}`,
        data: { promised, delivered: round2(delivered), confidenceBefore, confidenceAfter },
      });

      return tx.decision.findUnique({ where: { id: decisionId }, include: { outcome: true } });
    });
  }

  /** DEMO only: skip the 7-day wait. A deterministic "how did it actually go" factor in [0.55, 1.10] of what was promised. */
  async simulate(workspace: Workspace, decisionId: string) {
    const decision = await this.prisma.decision.findFirst({ where: { id: decisionId, workspace } });
    if (!decision) throw new NotFoundException('Decision not found.');

    const rand = mulberry32(seedFromId(decisionId));
    const factor = 0.55 + 0.55 * rand();
    const delivered = Number(decision.expectedImpact) * factor;

    return this.finalizeOutcome(workspace, decisionId, delivered, 'Simulated outcome (demo fast-forward).');
  }

  /**
   * LIVE: compares net contribution (revenue - spend, summed across all
   * channels) in the 7 days after execution against the 7 days before it.
   * Returns `null` when the post-period isn't fully in yet -- the caller
   * (the queue processor) reschedules in that case rather than guessing.
   */
  async checkLiveOutcome(decisionId: string) {
    const decision = await this.prisma.decision.findFirst({ where: { id: decisionId, workspace: 'LIVE' } });
    if (!decision) throw new NotFoundException('Decision not found.');
    if (!decision.executedAt) throw new BadRequestException('Decision has no executedAt.');

    const executedAt = decision.executedAt;
    const postStart = executedAt;
    const postEnd = new Date(executedAt.getTime() + 7 * DAY_MS);
    const preStart = new Date(executedAt.getTime() - 7 * DAY_MS);
    const preEnd = executedAt;

    const latestRow = await this.prisma.metricRow.findFirst({
      where: { workspace: 'LIVE' },
      orderBy: { date: 'desc' },
    });
    if (!latestRow || latestRow.date < postEnd) {
      return null; // post-period data not uploaded yet
    }

    const [postRows, preRows] = await Promise.all([
      this.prisma.metricRow.findMany({ where: { workspace: 'LIVE', date: { gte: postStart, lt: postEnd } } }),
      this.prisma.metricRow.findMany({ where: { workspace: 'LIVE', date: { gte: preStart, lt: preEnd } } }),
    ]);

    const netOf = (rows: typeof postRows) =>
      rows.reduce((sum, r) => sum + (Number(r.revenue) - Number(r.spend)), 0);

    const delivered = netOf(postRows) - netOf(preRows);
    await this.finalizeOutcome('LIVE', decisionId, delivered, 'Outcome measured from uploaded post-period data.');
    return delivered;
  }

  async markOutcomeCheckFailed(decisionId: string) {
    await this.prisma.$transaction((tx) =>
      this.auditService.append(tx, {
        workspace: 'LIVE',
        type: 'OUTCOME_RECORDED',
        actorName: 'System',
        actorRole: 'SYSTEM',
        decisionId,
        message: 'Outcome check failed; manual review needed.',
        data: {},
      }),
    );
  }
}
