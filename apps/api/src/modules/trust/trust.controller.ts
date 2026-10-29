import { Controller, Get } from '@nestjs/common';
import type { Workspace } from '@ledgerly/shared';
import { CurrentWorkspace } from '../../common/workspace.decorator';
import { TrustService } from './trust.service';

@Controller('trust')
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  @Get('controls')
  getControls(@CurrentWorkspace() workspace: Workspace) {
    return this.trustService.getControls(workspace);
  }
}
