import { Injectable, NotFoundException } from '@nestjs/common';
import type { DecisionStatus, DecisionType, Workspace } from '@ledgerly/shared';
import { round2 } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';

const OPEN_STATUSES: DecisionStatus[] = ['PENDING_REVIEW', 'APPROVED', 'LIVE'];

@Injectable()
export class DecisionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { workspace: Workspace; status?: string; type?: string; sort?: string }) {
    const decisions = await this.prisma.decision.findMany({
      where: {
        workspace: params.workspace,
        ...(params.status ? { status: params.status as DecisionStatus } : {}),
        ...(params.type ? { type: params.type as DecisionType } : {}),
      },
      include: { approvals: true },
      orderBy:
        params.sort === 'priority' ? { priorityScore: 'desc' } : { createdAt: 'desc' },
    });

    return decisions.map((d) => ({
      ...d,
      approvals: undefined,
      approvalProgress: {
        done: d.approvals.filter((a) => a.result === 'GRANTED').length,
        total: d.approvals.length,
      },
    }));
  }

  async findOne(workspace: Workspace, id: string) {
    const decision = await this.prisma.decision.findFirst({
      where: { id, workspace },
      include: {
        evidence: { orderBy: { order: 'asc' } },
        approvals: { orderBy: { order: 'asc' } },
        outcome: true,
      },
    });
    if (!decision) throw new NotFoundException('Decision not found.');

    const audit = await this.prisma.auditEvent.findMany({
      where: { workspace, decisionId: id },
      orderBy: { seq: 'asc' },
    });

    return { ...decision, audit };
  }

  async stats(workspace: Workspace) {
    const all = await this.prisma.decision.findMany({
      where: { workspace },
      include: { outcome: true },
    });

    const open = all.filter((d) => OPEN_STATUSES.includes(d.status as DecisionStatus));
    const completed = all.filter((d) => d.status === 'COMPLETED');
    const hits = completed.filter(
      (d) => d.outcome && Number(d.outcome.delivered) >= 0.8 * Number(d.outcome.promised),
    );

    return {
      open: open.length,
      pendingReview: all.filter((d) => d.status === 'PENDING_REVIEW').length,
      live: all.filter((d) => d.status === 'LIVE').length,
      completed: completed.length,
      rejected: all.filter((d) => d.status === 'REJECTED').length,
      rolledBack: all.filter((d) => d.status === 'ROLLED_BACK').length,
      totalExpectedImpact: round2(open.reduce((sum, d) => sum + Number(d.expectedImpact), 0)),
      avgConfidence: open.length > 0 ? round2(open.reduce((sum, d) => sum + d.confidence, 0) / open.length) : 0,
      hitRate: completed.length > 0 ? round2(hits.length / completed.length) : 0,
    };
  }
}
