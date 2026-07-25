import { Module } from '@nestjs/common';
import {
  CaseEvidenceController,
  EvidenceController,
  EvidenceTemporaryDownloadController,
} from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [CaseEvidenceController, EvidenceController, EvidenceTemporaryDownloadController],
  providers: [EvidenceService],
})
export class EvidenceModule {}
