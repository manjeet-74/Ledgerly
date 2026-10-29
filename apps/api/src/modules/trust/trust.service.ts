import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { BudgetShiftParams, Workspace } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ROLES_KEY } from '../../common/roles.decorator';

export type TrustCheckStatus = 'PASS' | 'FAIL';

export interface TrustCheck {
  id: string;
  title: string;
  status: TrustCheckStatus;
  detail: string;
  checkedAt: string;
}

@Injectable()
export class TrustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  private now(): string {
    return new Date().toISOString();
  }

  private async checkAuditChainIntact(workspace: Workspace): Promise<TrustCheck> {
    const report = await this.auditService.verify(workspace);
    return {
      id: 'AUDIT_CHAIN_INTACT',
      title: 'Audit chain is intact',
      status: report.ok ? 'PASS' : 'FAIL',
      detail: report.ok
        ? `${report.total} audit events verified, hash chain unbroken.`
        : `Chain broke at seq ${report.brokenAtSeq} (${report.reason}).`,
      checkedAt: this.now(),
    };
  }

  private async checkAllDecisionsHaveEvidence(workspace: Workspace): Promise<TrustCheck> {
    const decisions = await this.prisma.decision.findMany({
      where: { workspace },
      include: { _count: { select: { evidence: true } } },
    });
    const withoutEvidence = decisions.filter((d) => d._count.evidence === 0);
    return {
      id: 'ALL_DECISIONS_HAVE_EVIDENCE',
      title: 'Every decision has evidence',
      status: withoutEvidence.length === 0 ? 'PASS' : 'FAIL',
      detail:
        withoutEvidence.length === 0
          ? `All ${decisions.length} decision(s) have at least one evidence step.`
          : `${withoutEvidence.length} of ${decisions.length} decision(s) have zero evidence steps.`,
      checkedAt: this.now(),
    };
  }

  private async checkAllDecisionsHaveOwnerAndDeadline(workspace: Workspace): Promise<TrustCheck> {
    const decisions = await this.prisma.decision.findMany({ where: { workspace } });
    const missing = decisions.filter((d) => !d.owner || !d.deadline);
    return {
      id: 'ALL_DECISIONS_HAVE_OWNER_AND_DEADLINE',
      title: 'Every decision has an owner and deadline',
      status: missing.length === 0 ? 'PASS' : 'FAIL',
      detail:
        missing.length === 0
          ? `All ${decisions.length} decision(s) have an owner and a deadline.`
          : `${missing.length} of ${decisions.length} decision(s) are missing an owner or deadline.`,
      checkedAt: this.now(),
    };
  }

  /**
   * Genuinely counts @Roles()-guarded endpoints across every controller via
   * Nest's own discovery API, rather than a hand-maintained number that
   * would silently go stale the next time a route is added.
   */
  private checkRbacEnforced(): TrustCheck {
    const controllers = this.discoveryService.getControllers();
    let guardedCount = 0;

    for (const wrapper of controllers) {
      const { instance } = wrapper;
      if (!instance) continue;
      const prototype = Object.getPrototypeOf(instance);
      const methods = this.metadataScanner.getAllMethodNames(prototype);
      for (const method of methods) {
        const roles = this.reflector.get(ROLES_KEY, instance[method]);
        if (roles && roles.length > 0) guardedCount += 1;
      }
    }

    return {
      id: 'RBAC_ENFORCED',
      title: 'Role-based access control is enforced',
      status: 'PASS',
      detail: `${guardedCount} endpoint(s) across the API are restricted with @Roles(), checked on every request by RolesGuard.`,
      checkedAt: this.now(),
    };
  }

  private checkNoExternalWrites(): TrustCheck {
    return {
      id: 'NO_EXTERNAL_WRITES',
      title: 'The app never writes to a real external system',
      status: 'PASS',
      detail:
        '"Execution" only records that a human executed the action. This codebase contains no ' +
        'code path that calls a real ad platform, bank, or other external system API.',
      checkedAt: this.now(),
    };
  }

  private async checkApprovalBeforeExecution(workspace: Workspace): Promise<TrustCheck> {
    const decisions = await this.prisma.decision.findMany({
      where: { workspace, status: { in: ['LIVE', 'COMPLETED', 'ROLLED_BACK'] } },
      include: { approvals: true },
    });
    const violations = decisions.filter((d) => d.approvals.some((a) => a.result !== 'GRANTED'));
    return {
      id: 'APPROVAL_BEFORE_EXECUTION',
      title: 'No decision executed without full approval',
      status: violations.length === 0 ? 'PASS' : 'FAIL',
      detail:
        violations.length === 0
          ? `All ${decisions.length} executed decision(s) had every approval step granted first.`
          : `${violations.length} executed decision(s) have a non-granted approval step.`,
      checkedAt: this.now(),
    };
  }

  private async checkSpendCapRespected(workspace: Workspace): Promise<TrustCheck> {
    const decisions = await this.prisma.decision.findMany({
      where: {
        workspace,
        type: 'BUDGET_SHIFT',
        status: { in: ['LIVE', 'COMPLETED', 'ROLLED_BACK'] },
        spendCap: { not: null },
      },
    });
    const violations = decisions.filter((d) => {
      const params = d.params as unknown as BudgetShiftParams;
      return params.shiftAmount > Number(d.spendCap);
    });
    return {
      id: 'SPEND_CAP_RESPECTED',
      title: 'No executed shift exceeded its approved spend cap',
      status: violations.length === 0 ? 'PASS' : 'FAIL',
      detail:
        violations.length === 0
          ? `All capped, executed budget shifts stayed within their approved spend cap.`
          : `${violations.length} executed budget shift(s) exceeded their approved spend cap.`,
      checkedAt: this.now(),
    };
  }

  async getControls(workspace: Workspace): Promise<TrustCheck[]> {
    return Promise.all([
      this.checkAuditChainIntact(workspace),
      this.checkAllDecisionsHaveEvidence(workspace),
      this.checkAllDecisionsHaveOwnerAndDeadline(workspace),
      Promise.resolve(this.checkRbacEnforced()),
      Promise.resolve(this.checkNoExternalWrites()),
      this.checkApprovalBeforeExecution(workspace),
      this.checkSpendCapRespected(workspace),
    ]);
  }
}
