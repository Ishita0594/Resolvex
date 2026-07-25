import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CaseEventsGateway } from './case-events.gateway';

@Module({
  imports: [AuthModule],
  providers: [CaseEventsGateway],
  exports: [CaseEventsGateway],
})
export class EventsModule {}
