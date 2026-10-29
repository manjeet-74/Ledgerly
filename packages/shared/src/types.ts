export type Workspace = 'DEMO' | 'LIVE';

export type Role =
  | 'ADMIN'
  | 'MARKETING_DIRECTOR'
  | 'FINANCE'
  | 'EXECUTOR'
  | 'AUDITOR'
  | 'VIEWER';

export type DecisionType = 'BUDGET_SHIFT' | 'ANOMALY_ALERT';

export type DecisionStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'LIVE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'ROLLED_BACK';

export type EvidenceKind = 'DATA' | 'MODEL' | 'RULE' | 'CALC';
export type StepStatus = 'PASS' | 'FAIL' | 'INFO';
export type ApprovalStep = 'MARKETING' | 'FINANCE' | 'EXECUTIVE';
export type ApprovalResult = 'PENDING' | 'GRANTED' | 'REJECTED';

export type AuditEventType =
  | 'DATA_UPLOADED'
  | 'ENGINE_RUN'
  | 'DECISION_CREATED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'SPEND_CAP_SET'
  | 'DECISION_EXECUTED'
  | 'ROLLBACK_SET'
  | 'ROLLBACK_TRIGGERED'
  | 'OUTCOME_RECORDED'
  | 'POLICY_CHANGED'
  | 'WORKSPACE_RESET'
  | 'CHAIN_VERIFIED'
  | 'EXPORT_CREATED'
  | 'LOGIN';

export interface Metric {
  date: string; // YYYY-MM-DD
  channel: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface BudgetShiftParams {
  from: string;
  to: string;
  shiftAmount: number;
  shiftPct: number;
  roasHigh: number;
  roasLow: number;
  weeklyDonorSpend: number;
}

export interface AnomalyParams {
  channel: string;
  baselineRoas: number;
  recentRoas: number;
  z: number;
  weeklySpend: number;
}

export interface RollbackRule {
  metric: 'ROAS';
  channel: string;
  below: number;
  afterDays: number;
}

export interface EngineConfig {
  minDataDays: number;
  maxShiftPct: number;
  minRoasGapPct: number;
  minWeeklySpend: number;
  anomalyZ: number;
  maxSingleChannelSharePct: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  minDataDays: 14,
  maxShiftPct: 20,
  minRoasGapPct: 20,
  minWeeklySpend: 100,
  anomalyZ: -2,
  maxSingleChannelSharePct: 60,
};

export interface EvidenceDraft {
  order: number;
  kind: EvidenceKind;
  title: string;
  detail: string;
  status: StepStatus;
  payload: unknown;
}

export interface GeneratedDecision {
  type: DecisionType;
  title: string;
  summary: string;
  expectedImpact: number;
  confidence: number;
  priorityScore: number;
  params: BudgetShiftParams | AnomalyParams;
  owner: Role;
  deadlineDays: number;
  evidence: EvidenceDraft[];
}

/**
 * The only legal moves in the decision lifecycle. Everything else is a 409.
 *
 *   PENDING_REVIEW --(all approvals granted)--> APPROVED --(executed)--> LIVE
 *   PENDING_REVIEW --(any reject)--> REJECTED                 [terminal]
 *   LIVE --(day-7 outcome checked)--> COMPLETED                [terminal]
 *   LIVE --(rollback triggered)--> ROLLED_BACK                 [terminal]
 */
const LEGAL_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['LIVE'],
  LIVE: ['COMPLETED', 'ROLLED_BACK'],
  COMPLETED: [],
  REJECTED: [],
  ROLLED_BACK: [],
};

export function canTransition(from: DecisionStatus, to: DecisionStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}
