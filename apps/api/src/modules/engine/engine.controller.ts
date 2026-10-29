import { Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import type { Workspace } from '@ledgerly/shared';
import { DemoAllowAny, Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CurrentWorkspace } from '../../common/workspace.decorator';
import type { AppRequest } from '../../common/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EngineService } from './engine.service';

@Controller('engine')
export class EngineController {
  constructor(private readonly engineService: EngineService) {}

  @Post('run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING_DIRECTOR')
  @DemoAllowAny()
  run(@CurrentWorkspace() workspace: Workspace, @Req() request: AppRequest) {
    if (!request.actor) throw new ForbiddenException();
    return this.engineService.run(workspace, request.actor);
  }
}
