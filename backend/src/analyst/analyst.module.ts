import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CaseStatusService } from '../disputes/case-status.service';
import { AnalystController } from './analyst.controller';
import { AnalystReviewService } from './analyst-review.service';

@Module({
  imports: [AuditModule, EventsModule, NotificationsModule],
  controllers: [AnalystController],
  providers: [AnalystReviewService, CaseStatusService],
  exports: [AnalystReviewService],
})
export class AnalystModule {}
