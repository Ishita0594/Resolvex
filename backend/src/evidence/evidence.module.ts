import { Module } from '@nestjs/common';
import {
  CaseEvidenceController,
  EvidenceController,
  EvidenceTemporaryDownloadController,
} from './evidence.controller';
import { EventsModule } from '../events/events.module';
import { AiProcessingService } from './ai-processing.service';
import { EvidenceService } from './evidence.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [StorageModule, EventsModule],
  controllers: [
    CaseEvidenceController,
    EvidenceController,
    EvidenceTemporaryDownloadController,
  ],
  providers: [EvidenceService, AiProcessingService],
})
export class EvidenceModule {}
