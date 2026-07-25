import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CaseStatus as PrismaCaseStatus,
  MerchantResponseStatus as PrismaMerchantResponseStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../users/user-role.enum';
import { CaseStatusService } from './case-status.service';
import { DisputeCaseResponse, serializeDisputeCase } from './disputes.serializer';
import { MerchantResponseDto } from './dto/merchant-response.dto';
import { PolicyRequirementsService } from './policy-requirements.service';

@Injectable()
export class MerchantCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseStatusService: CaseStatusService,
    private readonly policyRequirementsService: PolicyRequirementsService,
  ) {}

  async findForMerchant(merchantId: string): Promise<DisputeCaseResponse[]> {
    const disputeCases = await this.prisma.disputeCase.findMany({
      where: { merchantId },
      include: { transaction: true },
      orderBy: { createdAt: 'desc' },
    });

    return disputeCases.map(serializeDisputeCase);
  }

  async findOneForMerchant(caseId: string, merchantId: string): Promise<DisputeCaseResponse> {
    const disputeCase = await this.prisma.disputeCase.findFirst({
      where: {
        id: caseId,
        merchantId,
      },
      include: { transaction: true },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    return serializeDisputeCase(disputeCase);
  }

  async submitMerchantResponse(
    caseId: string,
    merchantId: string,
    merchantResponseDto: MerchantResponseDto,
  ): Promise<DisputeCaseResponse> {
    const disputeCase = await this.prisma.disputeCase.findFirst({
      where: {
        id: caseId,
        merchantId,
      },
      include: { transaction: true },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    this.caseStatusService.assertMerchantResponseAllowed(disputeCase);

    const requirements = await this.policyRequirementsService.findActiveForReason(disputeCase.reasonCode);
    this.policyRequirementsService.validateEvidenceForRequirements(merchantResponseDto.evidence, requirements);

    const responseDate = new Date();
    const submittedEvidenceMetadata: Prisma.InputJsonArray = merchantResponseDto.evidence.map((evidence) => ({
      requirementKey: evidence.requirementKey,
      evidenceType: evidence.evidenceType,
      value: evidence.value ?? null,
      documentId: evidence.documentId ?? null,
      metadata: (evidence.metadata ?? null) as Prisma.InputJsonObject | null,
    }));
    const merchantResponseMetadata: Prisma.InputJsonObject = {
      merchantResponseStatus: PrismaMerchantResponseStatus.SUBMITTED,
      responseDate: responseDate.toISOString(),
      policyRequirements: requirements.map((requirement) => ({
        id: requirement.id,
        requirementKey: requirement.requirementKey,
        isMandatory: requirement.isMandatory,
        policyVersion: requirement.policyVersion,
      })),
      evidence: submittedEvidenceMetadata,
    };

    const updatedCase = await this.prisma.$transaction(async (tx) => {
      const currentCase = await tx.disputeCase.findFirst({
        where: {
          id: caseId,
          merchantId,
        },
        include: { transaction: true },
      });

      if (!currentCase) {
        throw new NotFoundException('Dispute case not found');
      }

      this.caseStatusService.assertMerchantResponseAllowed(currentCase, responseDate);
      this.caseStatusService.assertTransitionAllowed(
        currentCase.status,
        PrismaCaseStatus.EVIDENCE_PROCESSING,
        UserRole.MERCHANT,
      );

      const updated = await tx.disputeCase.update({
        where: { id: currentCase.id },
        data: {
          merchantStatement: merchantResponseDto.merchantStatement,
          merchantResponseDate: responseDate,
          merchantResponseStatus: PrismaMerchantResponseStatus.SUBMITTED,
          status: PrismaCaseStatus.EVIDENCE_PROCESSING,
        },
        include: { transaction: true },
      });

      await tx.timelineEvent.create({
        data: {
          caseId: currentCase.id,
          eventType: 'MERCHANT_RESPONSE_SUBMITTED',
          description: 'Merchant submitted a structured response with policy requirement evidence.',
          performedBy: merchantId,
          metadata: merchantResponseMetadata,
        },
      });

      await tx.timelineEvent.create({
        data: {
          caseId: currentCase.id,
          eventType: 'CASE_STATUS_CHANGED',
          description: 'Case moved to evidence processing after merchant response.',
          performedBy: merchantId,
          metadata: {
            fromStatus: currentCase.status,
            toStatus: PrismaCaseStatus.EVIDENCE_PROCESSING,
          },
        },
      });

      return updated;
    });

    return serializeDisputeCase(updatedCase);
  }
}
