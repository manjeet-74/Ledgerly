import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AppRequest } from './types';

/** Injects the resolved workspace (set by WorkspaceGuard) into a controller method param. */
export const CurrentWorkspace = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AppRequest>();
  return request.workspace;
});
