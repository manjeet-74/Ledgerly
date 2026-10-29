import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@ledgerly/shared';
import { DEMO_ALLOW_ANY_KEY, ROLES_KEY } from './roles.decorator';
import type { AppRequest } from './types';

/**
 * Enforces @Roles(...) on a route. The two workspaces get their role from
 * different places:
 *  - DEMO has no login: the web app sends `X-Demo-Role` and this guard
 *    trusts it outright -- this is intentional: DEMO is a sandbox with fake
 *    data, there's nothing to protect.
 *  - LIVE requires a real JWT: by the time this guard runs, JwtAuthGuard
 *    must already have set `request.actor` from the verified token. If it
 *    hasn't, access is denied rather than trusting anything from the client.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();

    // Set request.actor for DEMO *before* any early-exit below -- some
    // routes (e.g. approvals, where the allowed role depends on which
    // approval step is next, not a fixed list) use this guard purely to
    // populate `request.actor` and check roles themselves, with no
    // @Roles() at all. Those routes still need an actor identity in DEMO.
    if (request.workspace === 'DEMO') {
      const header = request.headers['x-demo-role'];
      const raw = Array.isArray(header) ? header[0] : header;
      const role = (raw?.toUpperCase() as Role | undefined) ?? 'VIEWER';
      request.actor = { name: `Demo ${role}`, role };
    }

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    if (request.workspace === 'DEMO') {
      const demoAllowAny = this.reflector.getAllAndOverride<boolean | undefined>(
        DEMO_ALLOW_ANY_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (demoAllowAny) return true;

      return required.includes(request.actor!.role);
    }

    if (!request.actor) return false;
    return required.includes(request.actor.role);
  }
}
