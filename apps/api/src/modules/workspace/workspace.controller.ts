import { Controller, Delete, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { DemoOnlyGuard } from '../../common/demo-only.guard';
import { CurrentWorkspace } from '../../common/workspace.decorator';
import type { Workspace } from '@ledgerly/shared';
import type { AppRequest } from '../../common/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceService } from './workspace.service';

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('info')
  getInfo(@CurrentWorkspace() workspace: Workspace) {
    return this.workspaceService.getInfo(workspace);
  }

  @Post('demo/reset')
  @UseGuards(DemoOnlyGuard)
  resetDemo() {
    return this.workspaceService.resetDemo();
  }

  @Delete('live/data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  clearLive(@Req() request: AppRequest) {
    if (!request.actor) throw new ForbiddenException();
    return this.workspaceService.clearLive(request.actor);
  }
}
