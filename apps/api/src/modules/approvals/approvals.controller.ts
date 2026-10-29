import { Body, Controller, ForbiddenException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { RollbackRule, Workspace } from '@ledgerly/shared';
import { DemoOnlyGuard } from '../../common/demo-only.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CurrentWorkspace } from '../../common/workspace.decorator';
import type { AppRequest } from '../../common/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OutcomeService } from '../outcome/outcome.service';
import { ApprovalsService } from './approvals.service';

@Controller('decisions')
export class ApprovalsController {
  constructor(
    private readonly approvalsService: ApprovalsService,
    private readonly outcomeService: OutcomeService,
  ) {}

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  approve(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Req() request: AppRequest,
    @Body() body: { comment?: string; spendCap?: number },
  ) {
    if (!request.actor) throw new ForbiddenException();
    return this.approvalsService.approve(workspace, id, request.actor, body);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  reject(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Req() request: AppRequest,
    @Body('comment') comment: string,
  ) {
    if (!request.actor) throw new ForbiddenException();
    return this.approvalsService.reject(workspace, id, request.actor, comment ?? '');
  }

  @Post(':id/execute')
  @UseGuards(JwtAuthGuard, RolesGuard)
  execute(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Req() request: AppRequest,
    @Body('rollback') rollback?: RollbackRule,
  ) {
    if (!request.actor) throw new ForbiddenException();
    return this.approvalsService.execute(workspace, id, request.actor, rollback);
  }

  @Post(':id/rollback')
  @UseGuards(JwtAuthGuard, RolesGuard)
  rollback(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string, @Req() request: AppRequest) {
    if (!request.actor) throw new ForbiddenException();
    return this.approvalsService.rollback(workspace, id, request.actor);
  }

  @Post(':id/outcome/simulate')
  @UseGuards(DemoOnlyGuard)
  simulate(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.outcomeService.simulate(workspace, id);
  }
}
