import type { AuditEventType, Workspace } from '@ledgerly/shared';

export interface AppendAuditEventInput {
  workspace: Workspace;
  type: AuditEventType;
  actorName: string;
  actorRole: string;
  decisionId?: string | null;
  message: string;
  data?: unknown;
}
