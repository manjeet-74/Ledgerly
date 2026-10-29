import { Injectable } from '@nestjs/common';
import type { Workspace } from '@ledgerly/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestActor } from '../../common/types';
import { DemoSeedService } from './demo-seed.service';

export interface WorkspaceInfo {
  workspace: Workspace;
  hasData: boolean;
  metricRows: number;
  decisions: number;
  lastUpload: { id: string; filename: string; createdAt: Date } | null;
}

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly demoSeedService: DemoSeedService,
  ) {}

  async getInfo(workspace: Workspace): Promise<WorkspaceInfo> {
    const [metricRows, decisions, lastUpload] = await Promise.all([
      this.prisma.metricRow.count({ where: { workspace } }),
      this.prisma.decision.count({ where: { workspace } }),
      this.prisma.upload.findFirst({
        where: { workspace },
        orderBy: { createdAt: 'desc' },
        select: { id: true, filename: true, createdAt: true },
      }),
    ]);

    return {
      workspace,
      hasData: metricRows > 0,
      metricRows,
      decisions,
      lastUpload,
    };
  }

  async resetDemo(): Promise<WorkspaceInfo> {
    await this.demoSeedService.seedDemo();
    return this.getInfo('DEMO');
  }

  /**
   * LIVE audit history is permanently append-only (enforced by the database
   * trigger) -- by design, nothing can ever delete or renumber it, even
   * this endpoint. So "clearing LIVE data" means deleting the actual
   * business data (metrics, decisions and everything that cascades from
   * them) while the audit chain simply keeps growing, now recording this
   * wipe as its newest event. That's a stronger guarantee than literally
   * restarting the chain at seq 1 would be: you can always see, forever,
   * exactly when LIVE was cleared and by whom.
   */
  async clearLive(actor: RequestActor): Promise<WorkspaceInfo> {
    await this.prisma.decision.deleteMany({ where: { workspace: 'LIVE' } });
    await this.prisma.metricRow.deleteMany({ where: { workspace: 'LIVE' } });
    await this.prisma.upload.deleteMany({ where: { workspace: 'LIVE' } });

    await this.prisma.$transaction((tx) =>
      this.auditService.append(tx, {
        workspace: 'LIVE',
        type: 'WORKSPACE_RESET',
        actorName: actor.name,
        actorRole: actor.role,
        message: `LIVE data cleared by ${actor.name}.`,
        data: {},
      }),
    );

    return this.getInfo('LIVE');
  }
}
