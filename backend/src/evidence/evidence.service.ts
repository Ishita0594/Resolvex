import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CaseStatus as PrismaCaseStatus,
  EvidenceItem,
  EvidenceProcessingStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../users/public-user.type';
import { UserRole } from '../users/user-role.enum';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreateUploadTargetDto } from './dto/create-upload-target.dto';
import { UpdateFactsDto } from './dto/update-facts.dto';
import {
  EvidenceItemResponse,
  serializeEvidenceItem,
} from './evidence.serializer';
import { validateEvidenceFile } from './evidence-file.validation';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { STORAGE_PROVIDER } from './storage/storage.constants';
import {
  StorageProvider,
  TemporaryDownloadTarget,
  UploadTarget,
} from './storage/storage-provider.interface';

type LocalMultipartFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type EvidenceWithCase = EvidenceItem & {
  case: {
    id: string;
    cardMemberId: string;
    merchantId: string;
    status: PrismaCaseStatus;
  };
};

const DELETE_ALLOWED_STATUSES = new Set<PrismaCaseStatus>([
  PrismaCaseStatus.DRAFT,
  PrismaCaseStatus.SUBMITTED,
  PrismaCaseStatus.AWAITING_MERCHANT,
  PrismaCaseStatus.EVIDENCE_PROCESSING,
]);

@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly localStorageProvider: LocalStorageProvider,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async createUploadTarget(
    caseId: string,
    user: PublicUser,
    dto: CreateUploadTargetDto,
  ): Promise<Omit<UploadTarget, 'storageKey'> & { evidenceId: string }> {
    this.assertUploaderRole(user);
    const disputeCase = await this.findCaseForUpload(caseId, user);
    const sanitizedFileName = this.validateFile(
      dto.fileName,
      dto.mimeType,
      dto.sizeBytes,
    );
    const evidenceId = randomUUID();
    const storageKey = this.buildStorageKey(
      disputeCase.id,
      evidenceId,
      sanitizedFileName,
    );
    const uploadTarget = await this.storageProvider.createUploadTarget({
      evidenceId,
      caseId: disputeCase.id,
      storageKey,
      fileName: sanitizedFileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.evidenceItem.create({
        data: {
          id: evidenceId,
          caseId: disputeCase.id,
          submittedByUserId: user.id,
          submittedByRole: user.role,
          evidenceType: dto.evidenceType,
          fileName: sanitizedFileName,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
          storageKey,
          processingStatus: EvidenceProcessingStatus.UPLOADED,
        },
      });

      await tx.timelineEvent.create({
        data: {
          caseId: disputeCase.id,
          eventType: 'EVIDENCE_UPLOAD_TARGET_CREATED',
          description: 'Evidence upload target was created.',
          performedBy: user.id,
          metadata: {
            evidenceId,
            evidenceType: dto.evidenceType,
            fileName: sanitizedFileName,
            mimeType: dto.mimeType,
            sizeBytes: dto.sizeBytes,
            submittedByRole: user.role,
            storageProvider: this.configService.get<string>(
              'STORAGE_PROVIDER',
              'local',
            ),
          },
        },
      });
    });

    return {
      evidenceId,
      uploadUrl: uploadTarget.uploadUrl,
      method: uploadTarget.method,
      headers: uploadTarget.headers,
      fields: uploadTarget.fields,
      expiresAt: uploadTarget.expiresAt,
    };
  }

  async confirmUpload(
    caseId: string,
    user: PublicUser,
    dto: ConfirmUploadDto,
  ): Promise<EvidenceItemResponse> {
    const evidence = await this.findEvidenceForCase(dto.evidenceId, caseId);
    this.assertCanModifyEvidence(evidence, user);

    if (dto.fileHash && !/^[a-fA-F0-9]{64}$/.test(dto.fileHash)) {
      throw new BadRequestException(
        'fileHash must be a SHA-256 hexadecimal digest',
      );
    }

    const confirmResult = await this.storageProvider.confirmUpload({
      storageKey: evidence.storageKey,
      expectedHash: dto.fileHash?.toLowerCase(),
    });
    const normalizedFileHash = confirmResult.fileHash?.toLowerCase() ?? null;

    if (evidence.fileHash === normalizedFileHash) {
      const existingEvidence = await this.prisma.evidenceItem.findUniqueOrThrow(
        {
          where: { id: evidence.id },
          include: { extractedFacts: true },
        },
      );

      return serializeEvidenceItem(existingEvidence);
    }

    const updatedEvidence = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.evidenceItem.update({
        where: { id: evidence.id },
        data: {
          fileHash: normalizedFileHash,
          processingStatus: EvidenceProcessingStatus.UPLOADED,
        },
        include: { extractedFacts: true },
      });

      await tx.timelineEvent.create({
        data: {
          caseId: evidence.caseId,
          eventType: 'EVIDENCE_UPLOADED',
          description: 'Evidence upload was confirmed.',
          performedBy: user.id,
          metadata: {
            evidenceId: evidence.id,
            evidenceType: evidence.evidenceType,
            fileName: evidence.fileName,
            mimeType: evidence.mimeType,
            sizeBytes: evidence.sizeBytes,
            submittedByRole: evidence.submittedByRole,
            fileHash: normalizedFileHash,
          },
        },
      });

      return updated;
    });

    return serializeEvidenceItem(updatedEvidence);
  }

  async listForCase(
    caseId: string,
    user: PublicUser,
  ): Promise<EvidenceItemResponse[]> {
    await this.findCaseForRead(caseId, user);

    const evidenceItems = await this.prisma.evidenceItem.findMany({
      where: { caseId },
      include: { extractedFacts: true },
      orderBy: { createdAt: 'desc' },
    });

    return evidenceItems.map(serializeEvidenceItem);
  }

  async findOne(
    evidenceId: string,
    user: PublicUser,
  ): Promise<EvidenceItemResponse> {
    const evidence = await this.findEvidenceForRead(evidenceId, user);
    return serializeEvidenceItem(evidence);
  }

  async createTemporaryDownload(
    evidenceId: string,
    user: PublicUser,
  ): Promise<TemporaryDownloadTarget> {
    const evidence = await this.findEvidenceForRead(evidenceId, user);

    if (!(await this.storageProvider.objectExists(evidence.storageKey))) {
      throw new NotFoundException('Evidence file was not found in storage');
    }

    return this.storageProvider.getTemporaryDownloadUrl({
      evidenceId: evidence.id,
      storageKey: evidence.storageKey,
      fileName: evidence.fileName,
      mimeType: evidence.mimeType,
    });
  }

  async replaceFacts(
    evidenceId: string,
    user: PublicUser,
    dto: UpdateFactsDto,
  ): Promise<EvidenceItemResponse> {
    const evidence = await this.findEvidenceWithCase(evidenceId);
    this.assertCanModifyEvidence(evidence, user, { allowAnalyst: true });

    const updatedEvidence = await this.prisma.$transaction(async (tx) => {
      await tx.extractedFact.deleteMany({
        where: { evidenceId: evidence.id },
      });

      if (dto.facts.length > 0) {
        await tx.extractedFact.createMany({
          data: dto.facts.map((fact) => ({
            id: fact.id,
            evidenceId: evidence.id,
            factType: fact.factType,
            factValue: fact.factValue,
            normalizedValue: fact.normalizedValue ?? null,
            confidence: fact.confidence ?? null,
            sourcePage: fact.sourcePage ?? null,
            verifiedByUser: fact.verifiedByUser ?? false,
            correctedByUser: fact.correctedByUser ?? false,
          })),
        });
      }

      return tx.evidenceItem.findUniqueOrThrow({
        where: { id: evidence.id },
        include: { extractedFacts: true },
      });
    });

    return serializeEvidenceItem(updatedEvidence);
  }

  async deleteEvidence(evidenceId: string, user: PublicUser): Promise<void> {
    const evidence = await this.findEvidenceWithCase(evidenceId);
    this.assertCanModifyEvidence(evidence, user);

    if (!DELETE_ALLOWED_STATUSES.has(evidence.case.status)) {
      throw new ConflictException(
        'Evidence cannot be deleted after case evaluation has started',
      );
    }

    await this.storageProvider.deleteObject(evidence.storageKey);

    await this.prisma.$transaction(async (tx) => {
      await tx.evidenceItem.delete({
        where: { id: evidence.id },
      });

      await tx.timelineEvent.create({
        data: {
          caseId: evidence.caseId,
          eventType: 'EVIDENCE_DELETED',
          description: 'Submitted evidence was deleted.',
          performedBy: user.id,
          metadata: {
            evidenceId: evidence.id,
            evidenceType: evidence.evidenceType,
            fileName: evidence.fileName,
            mimeType: evidence.mimeType,
            sizeBytes: evidence.sizeBytes,
            submittedByRole: evidence.submittedByRole,
          },
        },
      });
    });
  }

  async saveLocalMultipartUpload(
    evidenceId: string,
    user: PublicUser,
    file: LocalMultipartFile | undefined,
  ): Promise<{ fileHash: string }> {
    if (!file) {
      throw new BadRequestException('Evidence file is required');
    }

    const evidence = await this.findEvidenceWithCase(evidenceId);
    this.assertCanModifyEvidence(evidence, user);

    const sanitizedFileName = this.validateFile(
      file.originalname,
      file.mimetype,
      file.size,
    );
    if (
      sanitizedFileName !== evidence.fileName ||
      file.mimetype !== evidence.mimeType ||
      file.size !== evidence.sizeBytes
    ) {
      throw new BadRequestException(
        'Uploaded file does not match the requested upload target metadata',
      );
    }

    const fileHash = await this.localStorageProvider.saveMultipartUpload(
      evidence.storageKey,
      file.buffer,
    );
    return { fileHash };
  }

  async getLocalDownloadStream(
    evidenceId: string,
    expires: string,
    signature: string,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    if (
      !this.localStorageProvider.verifyDownloadSignature(
        evidenceId,
        expires,
        signature,
      )
    ) {
      throw new ForbiddenException(
        'Temporary download link is invalid or expired',
      );
    }

    const evidence = await this.prisma.evidenceItem.findUnique({
      where: { id: evidenceId },
    });

    if (
      !evidence ||
      !(await this.localStorageProvider.objectExists(evidence.storageKey))
    ) {
      throw new NotFoundException('Evidence file was not found');
    }

    return {
      stream: this.localStorageProvider.createReadStream(evidence.storageKey),
      fileName: evidence.fileName,
      mimeType: evidence.mimeType,
    };
  }

  private async findCaseForUpload(caseId: string, user: PublicUser) {
    const where: Prisma.DisputeCaseWhereInput = {
      id: caseId,
    };

    if (user.role === UserRole.CARD_MEMBER) {
      where.cardMemberId = user.id;
    } else if (user.role === UserRole.MERCHANT) {
      where.merchantId = user.id;
    } else {
      throw new ForbiddenException(
        'Only card members and merchants can upload evidence',
      );
    }

    const disputeCase = await this.prisma.disputeCase.findFirst({
      where,
      select: {
        id: true,
        cardMemberId: true,
        merchantId: true,
        status: true,
      },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    return disputeCase;
  }

  private async findCaseForRead(caseId: string, user: PublicUser) {
    const where: Prisma.DisputeCaseWhereInput = {
      id: caseId,
    };

    if (user.role === UserRole.CARD_MEMBER) {
      where.cardMemberId = user.id;
    } else if (user.role === UserRole.MERCHANT) {
      where.merchantId = user.id;
    } else if (user.role !== UserRole.ANALYST) {
      throw new ForbiddenException('Unsupported user role');
    }

    const disputeCase = await this.prisma.disputeCase.findFirst({
      where,
      select: {
        id: true,
        cardMemberId: true,
        merchantId: true,
        status: true,
      },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    return disputeCase;
  }

  private async findEvidenceForCase(
    evidenceId: string,
    caseId: string,
  ): Promise<EvidenceWithCase> {
    const evidence = await this.prisma.evidenceItem.findFirst({
      where: { id: evidenceId, caseId },
      include: { case: true },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    return evidence;
  }

  private async findEvidenceForRead(evidenceId: string, user: PublicUser) {
    const evidence = await this.prisma.evidenceItem.findUnique({
      where: { id: evidenceId },
      include: {
        case: true,
        extractedFacts: true,
      },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    this.assertCanReadEvidence(evidence, user);
    return evidence;
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

  private assertUploaderRole(user: PublicUser): void {
    if (user.role !== UserRole.CARD_MEMBER && user.role !== UserRole.MERCHANT) {
      throw new ForbiddenException(
        'Only card members and merchants can upload evidence',
      );
    }
  }

  private assertCanReadEvidence(
    evidence: EvidenceWithCase,
    user: PublicUser,
  ): void {
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

  private assertCanModifyEvidence(
    evidence: Pick<EvidenceItem, 'submittedByUserId' | 'submittedByRole'> & {
      case?: { cardMemberId: string; merchantId: string };
    },
    user: PublicUser,
    options: { allowAnalyst?: boolean } = {},
  ): void {
    if (options.allowAnalyst && user.role === UserRole.ANALYST) {
      return;
    }

    if (
      evidence.submittedByUserId === user.id &&
      String(evidence.submittedByRole) === String(user.role)
    ) {
      return;
    }

    throw new ForbiddenException(
      'Users cannot modify evidence submitted by the other party',
    );
  }

  private validateFile(
    fileName: string,
    mimeType: string,
    sizeBytes: number,
  ): string {
    return validateEvidenceFile({
      fileName,
      mimeType,
      sizeBytes,
      maxSizeBytes: this.configService.get<number>(
        'MAX_EVIDENCE_FILE_SIZE_BYTES',
        10 * 1024 * 1024,
      ),
    });
  }

  private buildStorageKey(
    caseId: string,
    evidenceId: string,
    sanitizedFileName: string,
  ): string {
    return ['evidence', caseId, evidenceId, basename(sanitizedFileName)].join(
      '/',
    );
  }
}
