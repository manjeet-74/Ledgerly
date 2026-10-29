import { Controller, Get, Param, Query } from '@nestjs/common';
import type { Workspace } from '@ledgerly/shared';
import { CurrentWorkspace } from '../../common/workspace.decorator';
import { DecisionsService } from './decisions.service';

@Controller('decisions')
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get('stats')
  stats(@CurrentWorkspace() workspace: Workspace) {
    return this.decisionsService.stats(workspace);
  }

  @Get(':id')
  findOne(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.decisionsService.findOne(workspace, id);
  }

  @Get()
  list(
    @CurrentWorkspace() workspace: Workspace,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('sort') sort?: string,
  ) {
    return this.decisionsService.list({ workspace, status, type, sort });
  }
}
