import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DemoAllowAny, Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { DemoOnlyGuard } from '../../common/demo-only.guard';
import { CurrentWorkspace } from '../../common/workspace.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Workspace } from '@ledgerly/shared';
import type { AppRequest } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(
    @CurrentWorkspace() workspace: Workspace,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('decisionId') decisionId?: string,
    @Query('type') type?: string,
    @Query('actor') actor?: string,
  ) {
    return this.auditService.list({
      workspace,
      cursor: cursor ? Number(cursor) : undefined,
      limit: limit ? Number(limit) : undefined,
      decisionId,
      type,
      actor,
    });
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUDITOR', 'ADMIN')
  @DemoAllowAny()
  async verifyChain(@CurrentWorkspace() workspace: Workspace, @Req() request: AppRequest) {
    const report = await this.auditService.verify(workspace);
    await this.prisma.$transaction((tx) =>
      this.auditService.append(tx, {
        workspace,
        type: 'CHAIN_VERIFIED',
        actorName: request.actor?.name ?? 'System',
        actorRole: request.actor?.role ?? 'ADMIN',
        message: report.ok
          ? `Chain verified OK (${report.total} events).`
          : `Chain verification FAILED at seq ${report.brokenAtSeq} (${report.reason}).`,
        data: report,
      }),
    );
    return report;
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('AUDITOR', 'ADMIN')
  @Header('Content-Disposition', 'attachment; filename="audit-export"')
  async exportEvents(
    @CurrentWorkspace() workspace: Workspace,
    @Req() request: AppRequest,
    @Query('format') format = 'json',
  ) {
    if (format !== 'csv' && format !== 'json') {
      throw new BadRequestException('format must be "csv" or "json"');
    }
    const body = await this.auditService.exportEvents(workspace, format);
    await this.prisma.$transaction((tx) =>
      this.auditService.append(tx, {
        workspace,
        type: 'EXPORT_CREATED',
        actorName: request.actor?.name ?? 'System',
        actorRole: request.actor?.role ?? 'ADMIN',
        message: `Exported audit chain as ${format}.`,
        data: { format },
      }),
    );
    return body;
  }

  @Post('demo/tamper')
  @UseGuards(DemoOnlyGuard)
  tamper(@CurrentWorkspace() workspace: Workspace) {
    return this.auditService.tamperRandomEvent(workspace);
  }

  @Post('demo/repair')
  @UseGuards(DemoOnlyGuard)
  repair(@CurrentWorkspace() workspace: Workspace) {
    return this.auditService.repairChain(workspace);
  }
}
