import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AnomalyParams,
  BudgetShiftParams,
  DecisionStatus,
  DecisionType,
  EngineConfig,
  GeneratedDecision,
  Workspace,
} from '@ledgerly/shared';
import { generateDecisions } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DataService } from '../data/data.service';
import { PolicyService } from '../policy/policy.service';
import type { PolicyTier } from '../policy/policy.types';
import type { RequestActor } from '../../common/types';
import { buildDecisionSummary } from './explanation';

const OPEN_STATUSES: DecisionStatus[] = ['PENDING_REVIEW', 'APPROVED', 'LIVE'];

export interface EngineRunResult {
  created: number;
  skipped: number;
  droppedByRules: number;
  decisionIds: string[];
}

@Injectable()
export class EngineService {
  private readonly logger = new Logger(EngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly dataService: DataService,
    private readonly policyService: PolicyService,
  ) {}

  private amountFor(decision: GeneratedDecision): number {
    return decision.type === 'BUDGET_SHIFT'
      ? (decision.params as BudgetShiftParams).shiftAmount
      : decision.expectedImpact;
  }

  /** True if an open decision already covers the same channel(s) -- the engine shouldn't propose the same move twice while one is still pending. */
  private async isDuplicate(workspace: Workspace, candidate: GeneratedDecision): Promise<boolean> {
    const open = await this.prisma.decision.findMany({
      where: { workspace, type: candidate.type, status: { in: OPEN_STATUSES } },
      select: { params: true },
    });

    return open.some((d) => {
      const params = d.params as unknown;
      if (candidate.type === 'BUDGET_SHIFT') {
        const p = params as BudgetShiftParams;
        const c = candidate.params as BudgetShiftParams;
        return p.from === c.from && p.to === c.to;
      }
      const p = params as AnomalyParams;
      const c = candidate.params as AnomalyParams;
      return p.channel === c.channel;
    });
  }

  async run(workspace: Workspace, actor: RequestActor): Promise<EngineRunResult> {
    const [rows, policy] = await Promise.all([
      this.dataService.getMetrics(workspace),
      this.policyService.ensurePolicy(workspace),
    ]);
    const metrics = this.dataService.metricsFromRows(rows);
    const engineConfig = policy.engine as unknown as EngineConfig;
    const today = new Date().toISOString().slice(0, 10);

    const { decisions, droppedByRules } = generateDecisions(metrics, engineConfig, today);

    let created = 0;
    let skipped = 0;
    const decisionIds: string[] = [];

    for (const candidate of decisions) {
      if (await this.isDuplicate(workspace, candidate)) {
        skipped += 1;
        continue;
      }

      const summary = await buildDecisionSummary(candidate);
      const amount = this.amountFor(candidate);
      const tier = this.policyService.selectTier(policy.tiers as unknown as PolicyTier[], amount);
      const deadline = new Date(Date.now() + candidate.deadlineDays * 24 * 60 * 60 * 1000);

      const decisionId = await this.prisma.$transaction(async (tx) => {
        const decision = await tx.decision.create({
          data: {
            workspace,
            type: candidate.type as DecisionType,
            title: candidate.title,
            summary,
            expectedImpact: candidate.expectedImpact,
            confidence: candidate.confidence,
            priorityScore: candidate.priorityScore,
            params: candidate.params as unknown as Prisma.InputJsonValue,
            owner: candidate.owner,
            deadline,
          },
        });

        await tx.evidenceStep.createMany({
          data: candidate.evidence.map((e) => ({
            decisionId: decision.id,
            order: e.order,
            kind: e.kind,
            title: e.title,
            detail: e.detail,
            status: e.status,
            payload: e.payload as Prisma.InputJsonValue,
          })),
        });

        await tx.approval.createMany({
          data: tier.steps.map((step, i) => ({
            decisionId: decision.id,
            step,
            order: i + 1,
          })),
        });

        await this.auditService.append(tx, {
          workspace,
          type: 'DECISION_CREATED',
          actorName: actor.name,
          actorRole: actor.role,
          decisionId: decision.id,
          message: `Engine created decision: ${decision.title}`,
          data: { type: candidate.type, amount, tier: tier.steps },
        });

        return decision.id;
      });

      decisionIds.push(decisionId);
      created += 1;
    }

    await this.prisma.$transaction((tx) =>
      this.auditService.append(tx, {
        workspace,
        type: 'ENGINE_RUN',
        actorName: actor.name,
        actorRole: actor.role,
        message: `Engine run: ${created} created, ${skipped} skipped (duplicate), ${droppedByRules} dropped by rules.`,
        data: { created, skipped, droppedByRules },
      }),
    );

    this.logger.log(
      `Engine run (${workspace}): ${created} created, ${skipped} skipped, ${droppedByRules} dropped.`,
    );
    return { created, skipped, droppedByRules, decisionIds };
  }
}
