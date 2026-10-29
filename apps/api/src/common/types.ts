import type { Request } from 'express';
import type { Role, Workspace } from '@ledgerly/shared';

export interface RequestActor {
  name: string;
  role: Role;
  userId?: string; // present in LIVE (from the JWT); absent in DEMO
}

/**
 * The two guards below attach these fields before any controller runs.
 * Everything downstream (controllers, services) reads workspace/actor from
 * here instead of re-parsing headers — one place decides "who is asking
 * and from which workspace."
 */
export interface AppRequest extends Request {
  workspace: Workspace;
  actor?: RequestActor;
}
