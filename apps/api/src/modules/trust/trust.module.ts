import { DiscoveryModule } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TrustController } from './trust.controller';
import { TrustService } from './trust.service';

@Module({
  imports: [DiscoveryModule],
  controllers: [TrustController],
  providers: [TrustService],
})
export class TrustModule {}
