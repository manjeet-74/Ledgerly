import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { OutcomeModule } from '../outcome/outcome.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [QueueModule, OutcomeModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
