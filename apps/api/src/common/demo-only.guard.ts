import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AppRequest } from './types';

/**
 * Blocks a route entirely when the caller is in LIVE. Used for the handful
 * of endpoints that only make sense against fake data: tamper/repair the
 * audit chain, simulate a 7-day outcome, reset demo data. These return 403
 * when X-Workspace is LIVE.
 */
@Injectable()
export class DemoOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();
    return request.workspace === 'DEMO';
  }
}
