import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * @Global: nearly every other module (data, engine, decisions, approvals,
 * trust) needs to append audit events as part of its own writes. Requiring
 * each of them to import AuditModule individually would just be repeated
 * boilerplate for something that's conceptually a cross-cutting concern,
 * like logging.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
