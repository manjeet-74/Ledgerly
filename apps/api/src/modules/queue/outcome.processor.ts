import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { OutcomeService } from '../outcome/outcome.service';
import {
  CHECK_OUTCOME_JOB,
  MAX_RESCHEDULE_ATTEMPTS,
  OUTCOMES_QUEUE,
  RESCHEDULE_DELAY_MS,
  type CheckOutcomeJobData,
} from './queue.constants';
import { QueueService } from './queue.service';

/**
 * Runs 7 days after a LIVE decision executes. Each run either
 * finds the post-period data already uploaded (and finalizes the outcome)
 * or doesn't (and reschedules itself +24h, up to 14 times) -- it never
 * guesses a number from data that isn't there yet.
 */
@Processor(OUTCOMES_QUEUE, { concurrency: 2 })
export class OutcomeProcessor extends WorkerHost {
  private readonly logger = new Logger(OutcomeProcessor.name);

  constructor(
    private readonly outcomeService: OutcomeService,
    private readonly queueService: QueueService,
  ) {
    super();
  }

  async process(job: Job<CheckOutcomeJobData>): Promise<void> {
    if (job.name !== CHECK_OUTCOME_JOB) return;
    const { decisionId, attempt } = job.data;

    // Two distinct failure modes, handled differently:
    //  - "data not ready yet" is EXPECTED and isn't an error -- it's the
    //    explicit +24h/14-attempt reschedule loop below, ending in a
    //    delivered=0 COMPLETED outcome.
    //  - an actual thrown error (DB down, bug) is a real failure -- BullMQ's
    //    own retry (attempts:3, fixed 5s backoff, set in QueueModule) kicks
    //    in instead, and only once THAT'S exhausted do we give up and leave
    //    the decision LIVE for manual review.
    try {
      const delivered = await this.outcomeService.checkLiveOutcome(decisionId);

      if (delivered !== null) {
        this.logger.log(`Outcome finalized for decision ${decisionId}: delivered $${delivered.toFixed(2)}.`);
        return;
      }

      if (attempt >= MAX_RESCHEDULE_ATTEMPTS) {
        this.logger.warn(`Decision ${decisionId}: no post-period data after ${attempt} attempts; giving up.`);
        await this.outcomeService.finalizeOutcome('LIVE', decisionId, 0, 'No post-period data uploaded.');
        return;
      }

      this.logger.log(`Decision ${decisionId}: post-period data not ready yet; rescheduling (+24h).`);
      await this.queueService.scheduleCheckOutcome(decisionId, RESCHEDULE_DELAY_MS, attempt + 1);
    } catch (error) {
      const isLastBullmqAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (!isLastBullmqAttempt) throw error; // let BullMQ retry

      this.logger.error(`Decision ${decisionId}: outcome check failed after retries.`, error as Error);
      await this.outcomeService.markOutcomeCheckFailed(decisionId);
    }
  }
}
