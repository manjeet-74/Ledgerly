import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { OutcomeModule } from '../outcome/outcome.module';
import { PolicyModule } from '../policy/policy.module';
import { DemoSeedService } from './demo-seed.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [EngineModule, ApprovalsModule, OutcomeModule, PolicyModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, DemoSeedService],
})
export class WorkspaceModule {}
