import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AppRequest, RequestActor } from '../../common/types';

/**
 * Wraps Passport's jwt strategy and copies its result from the
 * Passport-conventional `request.user` onto `request.actor` -- the same
 * field RolesGuard reads for DEMO. That way a controller
 * guarded by `@UseGuards(JwtAuthGuard, RolesGuard)` behaves identically in
 * LIVE and DEMO from RolesGuard's point of view.
 *
 * In DEMO this guard is a no-op: DEMO has no login, so there
 * is no token to check -- RolesGuard, running next, sets `request.actor`
 * itself from the `X-Demo-Role` header. Only LIVE requests actually go
 * through Passport's JWT verification.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (request.workspace === 'DEMO') return true;

    const allowed = await (super.canActivate(context) as Promise<boolean>);
    if (!allowed) return false;

    const req = request as AppRequest & { user?: RequestActor };
    req.actor = req.user;
    return true;
  }
}
