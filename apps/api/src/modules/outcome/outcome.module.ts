import { Module } from '@nestjs/common';
import { OutcomeService } from './outcome.service';

@Module({
  providers: [OutcomeService],
  exports: [OutcomeService],
})
export class OutcomeModule {}
