import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { WorkspaceGuard } from './common/workspace.guard';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { DataModule } from './modules/data/data.module';
import { PolicyModule } from './modules/policy/policy.module';
import { EngineModule } from './modules/engine/engine.module';
import { DecisionsModule } from './modules/decisions/decisions.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { TrustModule } from './modules/trust/trust.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    WorkspaceModule,
    AuthModule,
    AuditModule,
    DataModule,
    PolicyModule,
    EngineModule,
    DecisionsModule,
    ApprovalsModule,
    TrustModule,
  ],
  providers: [
    // Order matters: Nest runs global guards in registration order, and
    // every route needs `request.workspace` resolved before anything else
    // (including the rate limiter, which doesn't care about it, but also
    // before any future per-route RolesGuard) can run.
    { provide: APP_GUARD, useClass: WorkspaceGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
