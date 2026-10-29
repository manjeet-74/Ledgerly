import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { CHECK_OUTCOME_JOB, INITIAL_DELAY_MS, OUTCOMES_QUEUE, type CheckOutcomeJobData } from './queue.constants';

@Injectable()
export class QueueService {
  constructor(@InjectQueue(OUTCOMES_QUEUE) private readonly queue: Queue<CheckOutcomeJobData>) {}

  /** Called once, right when a decision executes, with the default 7-day delay. */
  async scheduleInitialCheck(decisionId: string): Promise<void> {
    await this.scheduleCheckOutcome(decisionId, INITIAL_DELAY_MS, 1);
  }

  async scheduleCheckOutcome(decisionId: string, delayMs: number, attempt: number): Promise<void> {
    await this.queue.add(
      CHECK_OUTCOME_JOB,
      { decisionId, workspace: 'LIVE', attempt },
      { delay: delayMs },
    );
  }
}
