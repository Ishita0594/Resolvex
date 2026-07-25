import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PolicyRequirement, ReasonCode as PrismaReasonCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MerchantResponseEvidenceDto } from './dto/merchant-response.dto';

export type PolicyRequirementResponse = {
  id: string;
  reasonCode: string;
  requirementKey: string;
  requirementName: string;
  description: string;
  acceptedEvidenceTypes: string[];
  weight: number;
  isMandatory: boolean;
  policyVersion: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class PolicyRequirementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForMerchantCase(caseId: string, merchantId: string): Promise<PolicyRequirementResponse[]> {
    const disputeCase = await this.prisma.disputeCase.findFirst({
      where: {
        id: caseId,
        merchantId,
      },
      select: {
        reasonCode: true,
      },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    const requirements = await this.findActiveForReason(disputeCase.reasonCode);
    return requirements.map(serializePolicyRequirement);
  }

  async findActiveForReason(reasonCode: PrismaReasonCode): Promise<PolicyRequirement[]> {
    return this.prisma.policyRequirement.findMany({
      where: {
        reasonCode,
        active: true,
      },
      orderBy: [{ isMandatory: 'desc' }, { requirementKey: 'asc' }],
    });
  }

  validateEvidenceForRequirements(
    submittedEvidence: MerchantResponseEvidenceDto[],
    requirements: PolicyRequirement[],
  ): void {
    if (requirements.length === 0) {
      throw new BadRequestException('No active policy requirements are configured for this case reason');
    }

    const requirementsByKey = new Map(requirements.map((requirement) => [requirement.requirementKey, requirement]));
    const submittedKeys = new Set<string>();

    for (const evidence of submittedEvidence) {
      const requirement = requirementsByKey.get(evidence.requirementKey);

      if (!requirement) {
        throw new BadRequestException(
          `Evidence requirement ${evidence.requirementKey} is not valid for this case reason`,
        );
      }

      const acceptedTypes = acceptedEvidenceTypesFor(requirement);
      if (!acceptedTypes.includes(evidence.evidenceType)) {
        throw new BadRequestException(
          `Evidence type ${evidence.evidenceType} is not accepted for requirement ${evidence.requirementKey}`,
        );
      }

      if (!evidence.value && !evidence.documentId && !evidence.metadata) {
        throw new BadRequestException(
          `Evidence for requirement ${evidence.requirementKey} must include a value, documentId, or metadata`,
        );
      }

      submittedKeys.add(evidence.requirementKey);
    }

    const missingMandatoryKeys = requirements
      .filter((requirement) => requirement.isMandatory && !submittedKeys.has(requirement.requirementKey))
      .map((requirement) => requirement.requirementKey);

    if (missingMandatoryKeys.length > 0) {
      throw new BadRequestException(`Missing mandatory evidence requirements: ${missingMandatoryKeys.join(', ')}`);
    }
  }
}

function serializePolicyRequirement(requirement: PolicyRequirement): PolicyRequirementResponse {
  return {
    id: requirement.id,
    reasonCode: requirement.reasonCode,
    requirementKey: requirement.requirementKey,
    requirementName: requirement.requirementName,
    description: requirement.description,
    acceptedEvidenceTypes: acceptedEvidenceTypesFor(requirement),
    weight: requirement.weight,
    isMandatory: requirement.isMandatory,
    policyVersion: requirement.policyVersion,
    active: requirement.active,
    createdAt: requirement.createdAt.toISOString(),
    updatedAt: requirement.updatedAt.toISOString(),
  };
}

function acceptedEvidenceTypesFor(requirement: PolicyRequirement): string[] {
  if (!Array.isArray(requirement.acceptedEvidenceTypes)) {
    return [];
  }

  return requirement.acceptedEvidenceTypes.filter(
    (evidenceType): evidenceType is string => typeof evidenceType === 'string',
  );
}
