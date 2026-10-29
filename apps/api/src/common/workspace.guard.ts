import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Workspace } from '@ledgerly/shared';
import type { AppRequest } from './types';

const VALID_WORKSPACES: Workspace[] = ['DEMO', 'LIVE'];

/**
 * Reads the `X-Workspace` header, falls back to DEMO when it's missing, and
 * rejects anything else. Runs before every route (registered globally in
 * main.ts) so `request.workspace` is always set by the time a controller
 * or another guard needs it.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const header = request.headers['x-workspace'];
    const raw = Array.isArray(header) ? header[0] : header;
    const workspace = (raw?.toUpperCase() as Workspace | undefined) ?? 'DEMO';

    if (!VALID_WORKSPACES.includes(workspace)) {
      return false;
    }

    request.workspace = workspace;
    return true;
  }
}
