import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Workspace } from '@ledgerly/shared';
import { DEFAULT_ENGINE_CONFIG } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestActor } from '../../common/types';
import { DEFAULT_TIERS, type PolicyTier } from './policy.types';

@Injectable()
export class PolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Every workspace gets a Policy row lazily, the first time anything needs one -- there's nothing to configure before that. */
  async ensurePolicy(workspace: Workspace) {
    const existing = await this.prisma.policy.findUnique({ where: { workspace } });
    if (existing) return existing;

    return this.prisma.policy.create({
      data: {
        workspace,
        name: 'Default',
        tiers: DEFAULT_TIERS as unknown as Prisma.InputJsonValue,
        engine: DEFAULT_ENGINE_CONFIG as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async get(workspace: Workspace) {
    return this.ensurePolicy(workspace);
  }

  async update(workspace: Workspace, tiers: PolicyTier[], actor: RequestActor) {
    this.validateTiers(tiers);
    await this.ensurePolicy(workspace);

    const updated = await this.prisma.policy.update({
      where: { workspace },
      data: { tiers: tiers as unknown as Prisma.InputJsonValue },
    });

    await this.prisma.$transaction((tx) =>
      this.auditService.append(tx, {
        workspace,
        type: 'POLICY_CHANGED',
        actorName: actor.name,
        actorRole: actor.role,
        message: `Approval tiers updated (${tiers.length} tier(s)).`,
        data: { tiers },
      }),
    );

    return updated;
  }

  /** Tiers must be ascending by maxAmount with exactly one open-ended (null) tier, last. */
  private validateTiers(tiers: PolicyTier[]): void {
    if (tiers.length === 0) throw new BadRequestException('At least one tier is required.');
    const last = tiers[tiers.length - 1]!;
    if (last.maxAmount !== null) {
      throw new BadRequestException('The last tier must have maxAmount: null (open-ended).');
    }
    for (let i = 0; i < tiers.length - 1; i += 1) {
      const current = tiers[i]!.maxAmount;
      if (current === null) {
        throw new BadRequestException('Only the last tier may have maxAmount: null.');
      }
      const next = tiers[i + 1]!.maxAmount;
      if (next !== null && next <= current) {
        throw new BadRequestException('Tiers must be strictly ascending by maxAmount.');
      }
    }
  }

  /** First tier whose maxAmount is null or >= amount, scanning ascending tiers in order. */
  selectTier(tiers: PolicyTier[], amount: number): PolicyTier {
    const match = tiers.find((t) => t.maxAmount === null || amount <= t.maxAmount);
    return match ?? tiers[tiers.length - 1]!;
  }
}
