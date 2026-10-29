export const OUTCOMES_QUEUE = 'ledgerly-outcomes';
export const CHECK_OUTCOME_JOB = 'check-outcome';
export const MAX_RESCHEDULE_ATTEMPTS = 14;
export const RESCHEDULE_DELAY_MS = 24 * 60 * 60 * 1000; // 24h
export const INITIAL_DELAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CheckOutcomeJobData {
  decisionId: string;
  workspace: 'LIVE';
  attempt: number;
}
