import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvidenceItem, EvidenceProcessingStatus, Prisma } from '@prisma/client';
import { CaseEventsGateway } from '../events/case-events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../users/public-user.type';
import { UserRole } from '../users/user-role.enum';
import {
  ExtractedFactResponse,
  serializeEvidenceItem,
  serializeExtractedFact,
} from './evidence.serializer';
import { STORAGE_PROVIDER } from './storage/storage.constants';
import { StorageProvider } from './storage/storage-provider.interface';

const ALLOWED_AI_FACT_TYPES = new Set([
  'TRANSACTION_AMOUNT',
  'TRANSACTION_DATE',
  'ORDER_ID',
  'MERCHANT_NAME',
  'DELIVERY_DATE',
  'DELIVERY_STATUS',
  'RECIPIENT_NAME',
  'DELIVERY_LOCATION',
  'CANCELLATION_DATE',
  'REFUND_AMOUNT',
  'REFUND_DATE',
  'REFUND_REFERENCE',
]);

type EvidenceWithCase = EvidenceItem & {
  case: {
    id: string;
    cardMemberId: string;
    merchantId: string;
  };
};

type ValidatedAiFact = {
  factType: string;
  factValue: string;
  normalizedValue: string | null;
  confidence: number | null;
  sourcePage: number | null;
};

type ValidatedAiResponse = {
  extractedText: string;
  facts: ValidatedAiFact[];
  classification: {
    label: string;
    confidence: number;
  };
  warnings: string[];
  providerMetadata: Prisma.InputJsonObject;
};

@Injectable()
export class AiProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    private readonly caseEventsGateway: CaseEventsGateway,
  ) {}

  async processEvidence(evidenceId: string, user: PublicUser, retry = false) {
    const evidence = await this.findEvidenceWithCase(evidenceId);
    this.assertCanProcess(evidence, user);

    if (
      retry &&
      evidence.processingStatus !== EvidenceProcessingStatus.FAILED
    ) {
      throw new ConflictException(
        'Only failed evidence processing can be retried',
      );
    }

    if (
      !retry &&
      evidence.processingStatus === EvidenceProcessingStatus.PROCESSING
    ) {
      throw new ConflictException('Evidence is already processing');
    }

    await this.prisma.evidenceItem.update({
      where: { id: evidence.id },
      data: { processingStatus: EvidenceProcessingStatus.PROCESSING },
    });

    try {
      const documentBytes = await this.storageProvider.getObjectBuffer(
        evidence.storageKey,
      );
      const aiResponse = await this.callAiService(evidence, documentBytes);
      const averageConfidence = this.averageConfidence(aiResponse.facts);

      const updatedEvidence = await this.prisma.$transaction(async (tx) => {
        await tx.extractedFact.deleteMany({
          where: {
            evidenceId: evidence.id,
            verifiedByUser: false,
            correctedByUser: false,
          },
        });

        if (aiResponse.facts.length > 0) {
          await tx.extractedFact.createMany({
            data: aiResponse.facts.map((fact) => ({
              evidenceId: evidence.id,
              factType: fact.factType,
              factValue: fact.factValue,
              normalizedValue: fact.normalizedValue,
              confidence: fact.confidence,
              sourcePage: fact.sourcePage,
              verifiedByUser: false,
              correctedByUser: false,
            })),
          });
        }

        const updated = await tx.evidenceItem.update({
          where: { id: evidence.id },
          data: {
            processingStatus: EvidenceProcessingStatus.PROCESSED,
            extractionConfidence: averageConfidence,
          },
          include: { extractedFacts: true },
        });

        await tx.timelineEvent.create({
          data: {
            caseId: evidence.caseId,
            eventType: retry
              ? 'EVIDENCE_PROCESSING_RETRIED'
              : 'EVIDENCE_PROCESSED',
            description: retry
              ? 'Evidence processing retry completed.'
              : 'Evidence was processed into structured facts.',
            performedBy: user.id,
            metadata: {
              evidenceId: evidence.id,
              factsExtracted: aiResponse.facts.length,
              extractionConfidence: averageConfidence,
              classification: aiResponse.classification,
              warnings: aiResponse.warnings,
              providerMetadata: aiResponse.providerMetadata,
            },
          },
        });

        return updated;
      });

      await this.caseEventsGateway.emitCaseEvent(
        evidence.caseId,
        'evidence.processing.completed',
        {
          caseId: evidence.caseId,
          title: 'Evidence processing completed',
          metadata: {
            evidenceId: evidence.id,
            factsExtracted: aiResponse.facts.length,
            extractionConfidence: averageConfidence,
          },
        },
      );

      return serializeEvidenceItem(updatedEvidence);
    } catch (error) {
      await this.markFailed(evidence, user, error, retry);
      throw error;
    }
  }

  async listFacts(
    evidenceId: string,
    user: PublicUser,
  ): Promise<ExtractedFactResponse[]> {
    const evidence = await this.findEvidenceWithCase(evidenceId);
    this.assertCanRead(evidence, user);

    const facts = await this.prisma.extractedFact.findMany({
      where: { evidenceId },
      orderBy: { createdAt: 'asc' },
    });

    return facts.map(serializeExtractedFact);
  }

  private async callAiService(
    evidence: EvidenceItem,
    documentBytes: Buffer,
  ): Promise<ValidatedAiResponse> {
    const aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:8000',
    );
    const timeoutMs = this.configService.get<number>(
      'AI_SERVICE_TIMEOUT_MS',
      15000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([new Uint8Array(documentBytes)], { type: evidence.mimeType }),
        evidence.fileName,
      );
      formData.append('file_name', evidence.fileName);
      formData.append('mime_type', evidence.mimeType);
      formData.append('evidence_type_hint', evidence.evidenceType);

      const response = await fetch(
        `${aiServiceUrl.replace(/\/$/, '')}/parse-document`,
        {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new BadGatewayException(`AI service returned ${response.status}`);
      }

      return this.validateAiResponse(await response.json());
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadGatewayException(
        `AI processing request failed: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateAiResponse(value: unknown): ValidatedAiResponse {
    if (!isRecord(value)) {
      throw new BadGatewayException('Invalid AI response: expected object');
    }

    const extractedText = asString(value.extracted_text, 'extracted_text');
    const rawFacts = asArray(value.structured_facts, 'structured_facts');
    const classification = this.validateClassification(
      value.document_classification,
    );
    const warnings =
      value.warnings === undefined
        ? []
        : asArray(value.warnings, 'warnings').map((item) =>
            asString(item, 'warning'),
          );
    const providerMetadata = isRecord(value.provider_metadata)
      ? (JSON.parse(
          JSON.stringify(value.provider_metadata),
        ) as Prisma.InputJsonObject)
      : {};

    return {
      extractedText,
      facts: rawFacts.map((item) => this.validateFact(item)),
      classification,
      warnings,
      providerMetadata,
    };
  }

  private validateFact(value: unknown): ValidatedAiFact {
    if (!isRecord(value)) {
      throw new BadGatewayException(
        'Invalid AI response: fact must be an object',
      );
    }

    const factType = asString(value.fact_type, 'fact_type');
    if (!ALLOWED_AI_FACT_TYPES.has(factType)) {
      throw new BadGatewayException(
        `Invalid AI response: unsupported fact type ${factType}`,
      );
    }

    const factValue = asString(value.fact_value, 'fact_value').trim();
    if (!factValue) {
      throw new BadGatewayException(
        'Invalid AI response: fact_value cannot be blank',
      );
    }

    return {
      factType,
      factValue,
      normalizedValue: optionalString(
        value.normalized_value,
        'normalized_value',
      ),
      confidence: optionalConfidence(value.confidence, 'confidence'),
      sourcePage: optionalPositiveInteger(value.source_page, 'source_page'),
    };
  }

  private validateClassification(value: unknown): {
    label: string;
    confidence: number;
  } {
    if (!isRecord(value)) {
      throw new BadGatewayException(
        'Invalid AI response: document_classification must be an object',
      );
    }

    return {
      label: asString(value.label, 'document_classification.label'),
      confidence: requiredConfidence(
        value.confidence,
        'document_classification.confidence',
      ),
    };
  }

  private averageConfidence(facts: ValidatedAiFact[]): number | null {
    const confidences = facts
      .map((fact) => fact.confidence)
      .filter(
        (confidence): confidence is number => typeof confidence === 'number',
      );

    if (confidences.length === 0) {
      return null;
    }

    return Number(
      (
        confidences.reduce((sum, confidence) => sum + confidence, 0) /
        confidences.length
      ).toFixed(4),
    );
  }

  private async markFailed(
    evidence: EvidenceWithCase,
    user: PublicUser,
    error: unknown,
    retry: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.evidenceItem.update({
        where: { id: evidence.id },
        data: { processingStatus: EvidenceProcessingStatus.FAILED },
      });

      await tx.timelineEvent.create({
        data: {
          caseId: evidence.caseId,
          eventType: retry
            ? 'EVIDENCE_PROCESSING_RETRY_FAILED'
            : 'EVIDENCE_PROCESSING_FAILED',
          description: retry
            ? 'Evidence processing retry failed.'
            : 'Evidence processing failed.',
          performedBy: user.id,
          metadata: {
            evidenceId: evidence.id,
            error: (error as Error).message,
          },
        },
      });
    });
  }

  private async findEvidenceWithCase(
    evidenceId: string,
  ): Promise<EvidenceWithCase> {
    const evidence = await this.prisma.evidenceItem.findUnique({
      where: { id: evidenceId },
      include: { case: true },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    return evidence;
  }

  private assertCanRead(evidence: EvidenceWithCase, user: PublicUser): void {
    if (user.role === UserRole.ANALYST) {
      return;
    }

    if (
      user.role === UserRole.CARD_MEMBER &&
      evidence.case.cardMemberId === user.id
    ) {
      return;
    }

    if (
      user.role === UserRole.MERCHANT &&
      evidence.case.merchantId === user.id
    ) {
      return;
    }

    throw new NotFoundException('Evidence not found');
  }

  private assertCanProcess(evidence: EvidenceWithCase, user: PublicUser): void {
    if (user.role === UserRole.ANALYST) {
      return;
    }

    if (
      evidence.submittedByUserId === user.id &&
      String(evidence.submittedByRole) === String(user.role)
    ) {
      return;
    }

    throw new ForbiddenException(
      'Users cannot process evidence submitted by the other party',
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new BadGatewayException(
      `Invalid AI response: ${field} must be a string`,
    );
  }

  return value;
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return asString(value, field);
}

function asArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new BadGatewayException(
      `Invalid AI response: ${field} must be an array`,
    );
  }

  return value;
}

function requiredConfidence(value: unknown, field: string): number {
  if (typeof value !== 'number' || value < 0 || value > 1) {
    throw new BadGatewayException(
      `Invalid AI response: ${field} must be between 0 and 1`,
    );
  }

  return value;
}

function optionalConfidence(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return requiredConfidence(value, field);
}

function optionalPositiveInteger(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new BadGatewayException(
      `Invalid AI response: ${field} must be a positive integer`,
    );
  }

  return value;
}
