import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module';
import { PolicyModule } from '../policy/policy.module';
import { EngineController } from './engine.controller';
import { EngineService } from './engine.service';

@Module({
  imports: [DataModule, PolicyModule],
  controllers: [EngineController],
  providers: [EngineService],
  exports: [EngineService],
})
export class EngineModule {}
