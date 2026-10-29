import { SetMetadata } from '@nestjs/common';
import type { Role } from '@ledgerly/shared';

export const ROLES_KEY = 'roles';
export const DEMO_ALLOW_ANY_KEY = 'demoAllowAny';

/** Marks a route handler as restricted to the listed roles. Checked by RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Some endpoints are role-gated in LIVE (e.g. "AUDITOR, ADMIN") but open to
 * any role while in DEMO — DEMO is a sandbox for walking through every
 * feature without first switching the role dropdown to exactly the right
 * persona.
 */
export const DemoAllowAny = () => SetMetadata(DEMO_ALLOW_ANY_KEY, true);
