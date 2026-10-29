import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OutcomeModule } from '../outcome/outcome.module';
import { OutcomeProcessor } from './outcome.processor';
import { OUTCOMES_QUEUE } from './queue.constants';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    BullModule.registerQueue({
      name: OUTCOMES_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 5000 },
      },
    }),
    OutcomeModule,
  ],
  providers: [QueueService, OutcomeProcessor],
  exports: [QueueService],
})
export class QueueModule {}
