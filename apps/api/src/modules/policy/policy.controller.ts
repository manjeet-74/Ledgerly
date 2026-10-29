import { Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Workspace } from '@ledgerly/shared';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CurrentWorkspace } from '../../common/workspace.decorator';
import type { AppRequest } from '../../common/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PolicyService } from './policy.service';
import type { PolicyTier } from './policy.types';

@Controller('policies')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get()
  get(@CurrentWorkspace() workspace: Workspace) {
    return this.policyService.get(workspace);
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @CurrentWorkspace() workspace: Workspace,
    @Req() request: AppRequest,
    @Body('tiers') tiers: PolicyTier[],
  ) {
    if (!request.actor) throw new ForbiddenException();
    return this.policyService.update(workspace, tiers, request.actor);
  }
}
