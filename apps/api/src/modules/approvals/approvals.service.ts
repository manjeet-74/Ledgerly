import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ApprovalStep, BudgetShiftParams, Role, RollbackRule, Workspace } from '@ledgerly/shared';
import { canTransition } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import type { RequestActor } from '../../common/types';

const STEP_ROLES: Record<ApprovalStep, Role[]> = {
  MARKETING: ['MARKETING_DIRECTOR', 'ADMIN'],
  FINANCE: ['FINANCE', 'ADMIN'],
  EXECUTIVE: ['ADMIN'],
};

const EXECUTOR_ROLES: Role[] = ['EXECUTOR', 'ADMIN'];

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
  ) {}

  private async loadDecisionWithApprovals(workspace: Workspace, decisionId: string) {
    const decision = await this.prisma.decision.findFirst({
      where: { id: decisionId, workspace },
      include: { approvals: { orderBy: { order: 'asc' } } },
    });
    if (!decision) throw new NotFoundException('Decision not found.');
    return decision;
  }

  async approve(
    workspace: Workspace,
    decisionId: string,
    actor: RequestActor,
    body: { comment?: string; spendCap?: number },
  ) {
    const decision = await this.loadDecisionWithApprovals(workspace, decisionId);
    const nextApproval = decision.approvals.find((a) => a.result === 'PENDING');
    if (!nextApproval) {
      throw new BadRequestException('No pending approval step for this decision.');
    }
    if (!STEP_ROLES[nextApproval.step as ApprovalStep].includes(actor.role)) {
      throw new ForbiddenException(`Role ${actor.role} cannot act on the ${nextApproval.step} step.`);
    }
    if (nextApproval.step === 'FINANCE' && !(body.spendCap && body.spendCap > 0)) {
      throw new BadRequestException('Finance approval requires a positive spendCap.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (nextApproval.step === 'FINANCE') {
        await tx.decision.update({ where: { id: decisionId }, data: { spendCap: body.spendCap } });
        await this.auditService.append(tx, {
          workspace,
          type: 'SPEND_CAP_SET',
          actorName: actor.name,
          actorRole: actor.role,
          decisionId,
          message: `Spend cap set to $${body.spendCap!.toFixed(2)}.`,
          data: { spendCap: body.spendCap },
        });
      }

      await tx.approval.update({
        where: { id: nextApproval.id },
        data: {
          result: 'GRANTED',
          actorName: actor.name,
          actorRole: actor.role,
          comment: body.comment,
          decidedAt: new Date(),
        },
      });

      await this.auditService.append(tx, {
        workspace,
        type: 'APPROVAL_GRANTED',
        actorName: actor.name,
        actorRole: actor.role,
        decisionId,
        message: `${nextApproval.step} approval granted.`,
        data: { step: nextApproval.step, comment: body.comment },
      });

      const remainingPending = decision.approvals.filter(
        (a) => a.id !== nextApproval.id && a.result === 'PENDING',
      );
      if (remainingPending.length === 0) {
        await tx.decision.update({ where: { id: decisionId }, data: { status: 'APPROVED' } });
      }

      return tx.decision.findUnique({ where: { id: decisionId }, include: { approvals: true } });
    });
  }

  async reject(workspace: Workspace, decisionId: string, actor: RequestActor, comment: string) {
    if (comment.trim().length < 5) {
      throw new BadRequestException('A rejection comment of at least 5 characters is required.');
    }
    const decision = await this.loadDecisionWithApprovals(workspace, decisionId);
    const nextApproval = decision.approvals.find((a) => a.result === 'PENDING');
    if (!nextApproval) {
      throw new BadRequestException('No pending approval step for this decision.');
    }
    if (!STEP_ROLES[nextApproval.step as ApprovalStep].includes(actor.role)) {
      throw new ForbiddenException(`Role ${actor.role} cannot act on the ${nextApproval.step} step.`);
    }
    if (!canTransition(decision.status, 'REJECTED')) {
      throw new ConflictException(`Illegal transition from ${decision.status} to REJECTED`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id: nextApproval.id },
        data: { result: 'REJECTED', actorName: actor.name, actorRole: actor.role, comment, decidedAt: new Date() },
      });
      await tx.decision.update({ where: { id: decisionId }, data: { status: 'REJECTED' } });
      await this.auditService.append(tx, {
        workspace,
        type: 'APPROVAL_REJECTED',
        actorName: actor.name,
        actorRole: actor.role,
        decisionId,
        message: `${nextApproval.step} rejected: ${comment}`,
        data: { step: nextApproval.step, comment },
      });
      return tx.decision.findUnique({ where: { id: decisionId } });
    });
  }

  async execute(workspace: Workspace, decisionId: string, actor: RequestActor, rollback?: RollbackRule) {
    if (!EXECUTOR_ROLES.includes(actor.role)) {
      throw new ForbiddenException(`Role ${actor.role} cannot execute decisions.`);
    }
    const decision = await this.prisma.decision.findFirst({ where: { id: decisionId, workspace } });
    if (!decision) throw new NotFoundException('Decision not found.');
    if (!canTransition(decision.status, 'LIVE')) {
      throw new ConflictException(`Illegal transition from ${decision.status} to LIVE`);
    }
    if (!rollback) {
      throw new BadRequestException('A rollback rule is required to execute a decision.');
    }
    if (decision.type === 'BUDGET_SHIFT' && decision.spendCap) {
      const params = decision.params as unknown as BudgetShiftParams;
      if (params.shiftAmount > Number(decision.spendCap)) {
        throw new UnprocessableEntityException('Shift amount exceeds the approved spend cap.');
      }
    }

    const executedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.decision.update({
        where: { id: decisionId },
        data: {
          status: 'LIVE',
          executedAt,
          rollbackRule: rollback as unknown as object,
        },
      });
      await this.auditService.append(tx, {
        workspace,
        type: 'ROLLBACK_SET',
        actorName: actor.name,
        actorRole: actor.role,
        decisionId,
        message: `Rollback rule set: if ${rollback.channel} ${rollback.metric} < ${rollback.below} within ${rollback.afterDays} days.`,
        data: rollback,
      });
      await this.auditService.append(tx, {
        workspace,
        type: 'DECISION_EXECUTED',
        actorName: actor.name,
        actorRole: actor.role,
        decisionId,
        message: 'Decision executed and is now LIVE.',
        data: { executedAt: executedAt.toISOString() },
      });
    });

    if (workspace === 'LIVE') {
      await this.queueService.scheduleInitialCheck(decisionId);
    }

    return this.prisma.decision.findUnique({ where: { id: decisionId } });
  }

  async rollback(workspace: Workspace, decisionId: string, actor: RequestActor) {
    if (!EXECUTOR_ROLES.includes(actor.role)) {
      throw new ForbiddenException(`Role ${actor.role} cannot trigger a rollback.`);
    }
    const decision = await this.prisma.decision.findFirst({ where: { id: decisionId, workspace } });
    if (!decision) throw new NotFoundException('Decision not found.');
    if (!canTransition(decision.status, 'ROLLED_BACK')) {
      throw new ConflictException(`Illegal transition from ${decision.status} to ROLLED_BACK`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.decision.update({ where: { id: decisionId }, data: { status: 'ROLLED_BACK' } });
      await this.auditService.append(tx, {
        workspace,
        type: 'ROLLBACK_TRIGGERED',
        actorName: actor.name,
        actorRole: actor.role,
        decisionId,
        message: 'Rollback triggered; decision reverted.',
        data: {},
      });
      return tx.decision.findUnique({ where: { id: decisionId } });
    });
  }
}
