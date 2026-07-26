import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AnalystDecision,
  CaseStatus as PrismaCaseStatus,
  DecisionType,
  Prisma,
  RecommendedOutcome,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CaseEventsGateway } from '../events/case-events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../users/public-user.type';
import { UserRole } from '../users/user-role.enum';
import { CaseStatusService } from '../disputes/case-status.service';
import { AnalystDecisionDto } from './dto/analyst-decision.dto';
import { RequestInformationDto } from './dto/request-information.dto';

type AnalystCaseResponse = {
  id: string;
  reasonCode: string;
  status: PrismaCaseStatus;
  cardMemberId: string;
  merchantId: string;
  merchantName: string;
  amount: string;
  currency: string;
  latestRecommendation: RecommendedOutcome | null;
  latestConfidence: number | null;
  latestDecisionMargin: number | null;
  latestEscalationReason: string | null;
  responseDeadline: string;
  createdAt: string;
};

type AnalystDecisionResponse = {
  reviewId: string;
  caseId: string;
  systemRecommendation: RecommendedOutcome;
  analystDecision: AnalystDecision;
  status: PrismaCaseStatus;
  overrideReason: string | null;
  createdAt: string;
};

@Injectable()
export class AnalystReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statusService: CaseStatusService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly caseEventsGateway: CaseEventsGateway,
  ) {}

  async listQueue(): Promise<AnalystCaseResponse[]> {
    const cases = await this.prisma.disputeCase.findMany({
      where: {
        OR: [
          { status: PrismaCaseStatus.HUMAN_REVIEW },
          {
            decisionRecords: {
              some: {
                recommendedOutcome: RecommendedOutcome.HUMAN_REVIEW_REQUIRED,
              },
            },
          },
        ],
      },
      include: {
        transaction: true,
        decisionRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return cases.map(serializeAnalystCase);
  }

  async listRecentlyResolved(limit = 10): Promise<AnalystCaseResponse[]> {
    const cases = await this.prisma.disputeCase.findMany({
      where: { status: PrismaCaseStatus.RESOLVED },
      include: {
        transaction: true,
        decisionRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { resolvedAt: 'desc' },
      take: limit,
    });

    return cases.map(serializeAnalystCase);
  }

  async findOne(caseId: string): Promise<
    AnalystCaseResponse & {
      cardMemberStatement: string;
      merchantStatement: string | null;
      latestExplanation: unknown;
      reviews: unknown[];
    }
  > {
    const disputeCase = await this.prisma.disputeCase.findUnique({
      where: { id: caseId },
      include: {
        transaction: true,
        decisionRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        analystReviews: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    const latestDecision = disputeCase.decisionRecords[0];
    return {
      ...serializeAnalystCase(disputeCase),
      cardMemberStatement: disputeCase.cardMemberStatement,
      merchantStatement: disputeCase.merchantStatement,
      latestExplanation: latestDecision?.explanationData ?? null,
      reviews: disputeCase.analystReviews.map((review) => ({
        id: review.id,
        analystId: review.analystId,
        systemRecommendation: review.systemRecommendation,
        analystDecision: review.analystDecision,
        overrideReason: review.overrideReason,
        analystNotes: review.analystNotes,
        createdAt: review.createdAt.toISOString(),
      })),
    };
  }

  async decide(
    caseId: string,
    analyst: PublicUser,
    dto: AnalystDecisionDto,
    ipAddress?: string,
  ): Promise<AnalystDecisionResponse> {
    const disputeCase = await this.findCaseForDecision(caseId);
    const latestRecommendation =
      disputeCase.decisionRecords[0]?.recommendedOutcome ??
      RecommendedOutcome.HUMAN_REVIEW_REQUIRED;
    const normalizedOverrideReason = dto.overrideReason?.trim() || null;

    if (
      !decisionAlignsWithRecommendation(dto.decision, latestRecommendation) &&
      !normalizedOverrideReason
    ) {
      throw new BadRequestException(
        'overrideReason is required when analyst decision differs from system recommendation',
      );
    }

    const nextStatus = statusForDecision(dto.decision);
    const statusChanged = disputeCase.status !== nextStatus;
    if (statusChanged) {
      this.statusService.assertTransitionAllowed(
        disputeCase.status,
        nextStatus,
        UserRole.ANALYST,
      );
    }

    const createdReview = await this.prisma.$transaction(async (tx) => {
      const review = await tx.analystReview.create({
        data: {
          caseId,
          analystId: analyst.id,
          systemRecommendation: latestRecommendation,
          analystDecision: dto.decision,
          overrideReason: normalizedOverrideReason,
          analystNotes: dto.analystNotes ?? null,
        },
      });

      const updatedCase = statusChanged
        ? await tx.disputeCase.update({
            where: { id: caseId },
            data: {
              status: nextStatus,
              resolvedAt:
                nextStatus === PrismaCaseStatus.RESOLVED ? new Date() : null,
            },
          })
        : disputeCase;

      await tx.timelineEvent.create({
        data: {
          caseId,
          eventType: 'ANALYST_DECISION_RECORDED',
          description: 'Analyst recorded a review decision.',
          performedBy: analyst.id,
          metadata: {
            analystReviewId: review.id,
            systemRecommendation: latestRecommendation,
            analystDecision: dto.decision,
            overrideProvided: Boolean(normalizedOverrideReason),
          },
        },
      });

      if (statusChanged) {
        await tx.timelineEvent.create({
          data: {
            caseId,
            eventType: 'CASE_STATUS_CHANGED',
            description: `Case status changed from ${disputeCase.status} to ${nextStatus}.`,
            performedBy: analyst.id,
            metadata: {
              from: disputeCase.status,
              to: nextStatus,
              analystReviewId: review.id,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          caseId,
          userId: analyst.id,
          action: 'ANALYST_DECISION_RECORDED',
          entityType: 'AnalystReview',
          entityId: review.id,
          previousValue: {
            status: disputeCase.status,
            systemRecommendation: latestRecommendation,
          },
          newValue: {
            status: updatedCase.status,
            analystDecision: dto.decision,
            overrideReason: normalizedOverrideReason,
            analystNotes: dto.analystNotes ?? null,
          },
          ipAddress: ipAddress ?? null,
        },
      });

      if (
        dto.decision === AnalystDecision.SUPPORT_CARD_MEMBER ||
        dto.decision === AnalystDecision.SUPPORT_MERCHANT
      ) {
        await tx.decisionRecord.create({
          data: {
            caseId,
            recommendedOutcome: outcomeForAnalystDecision(dto.decision),
            cardMemberScore:
              dto.decision === AnalystDecision.SUPPORT_CARD_MEMBER ? 100 : 0,
            merchantScore:
              dto.decision === AnalystDecision.SUPPORT_MERCHANT ? 100 : 0,
            confidence: 100,
            decisionMargin: 100,
            decisionType: DecisionType.HUMAN_DECISION,
            policyVersion:
              disputeCase.decisionRecords[0]?.policyVersion ?? 'prototype-v1',
            modelMetadata: {
              aiDecisionUsed: false,
              deterministicPolicyEngine: false,
              humanDecision: true,
              analystReviewId: review.id,
            },
            explanationData: {
              analystDecision: dto.decision,
              overrideReason: normalizedOverrideReason,
              analystNotes: dto.analystNotes ?? null,
              basedOnSystemRecommendation: latestRecommendation,
            },
          },
        });
      }

      return {
        ...review,
        status: updatedCase.status,
      };
    });

    await this.notifyParties(disputeCase, {
      title: 'Dispute decision updated',
      message: messageForDecision(dto.decision),
      type: 'ANALYST_DECISION',
    });

    await this.caseEventsGateway.emitCaseEvent(caseId, 'case.status.updated', {
      caseId,
      newStatus: createdReview.status,
      title: 'Case status updated',
      metadata: {
        analystDecision: dto.decision,
      },
    });

    return {
      reviewId: createdReview.id,
      caseId,
      systemRecommendation: latestRecommendation,
      analystDecision: dto.decision,
      status: createdReview.status,
      overrideReason: createdReview.overrideReason,
      createdAt: createdReview.createdAt.toISOString(),
    };
  }

  async requestInformation(
    caseId: string,
    analyst: PublicUser,
    dto: RequestInformationDto,
    ipAddress?: string,
  ): Promise<{ caseId: string; status: PrismaCaseStatus; message: string }> {
    const disputeCase = await this.findCaseForDecision(caseId);
    const nextStatus = PrismaCaseStatus.AWAITING_MERCHANT;
    const statusChanged = disputeCase.status !== nextStatus;

    if (statusChanged) {
      this.statusService.assertTransitionAllowed(
        disputeCase.status,
        nextStatus,
        UserRole.ANALYST,
      );
    }

    const updatedCase = await this.prisma.$transaction(async (tx) => {
      const updated = statusChanged
        ? await tx.disputeCase.update({
            where: { id: caseId },
            data: { status: nextStatus },
          })
        : disputeCase;

      await tx.timelineEvent.create({
        data: {
          caseId,
          eventType: 'INFORMATION_REQUESTED',
          description: 'Analyst requested additional information.',
          performedBy: analyst.id,
          metadata: {
            requestedEvidenceTypes: dto.requestedEvidenceTypes ?? [],
          },
        },
      });

      if (statusChanged) {
        await tx.timelineEvent.create({
          data: {
            caseId,
            eventType: 'CASE_STATUS_CHANGED',
            description: `Case status changed from ${disputeCase.status} to ${nextStatus}.`,
            performedBy: analyst.id,
            metadata: {
              from: disputeCase.status,
              to: nextStatus,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          caseId,
          userId: analyst.id,
          action: 'INFORMATION_REQUESTED',
          entityType: 'DisputeCase',
          entityId: caseId,
          previousValue: { status: disputeCase.status },
          newValue: {
            status: updated.status,
            message: dto.message,
            requestedEvidenceTypes: dto.requestedEvidenceTypes ?? [],
          },
          ipAddress: ipAddress ?? null,
        },
      });

      return updated;
    });

    await this.notifyParties(disputeCase, {
      title: 'More information requested',
      message: dto.message,
      type: 'INFORMATION_REQUESTED',
    });

    await this.caseEventsGateway.emitCaseEvent(
      caseId,
      'information.requested',
      {
        caseId,
        newStatus: updatedCase.status,
        title: 'More information requested',
        metadata: {
          requestedEvidenceTypeCount: dto.requestedEvidenceTypes?.length ?? 0,
        },
      },
    );

    return {
      caseId,
      status: updatedCase.status,
      message: dto.message,
    };
  }

  async recordReviewRequired(
    caseId: string,
    actor: PublicUser,
    reason: string,
  ): Promise<void> {
    const disputeCase = await this.findCaseForDecision(caseId);

    if (disputeCase.status !== PrismaCaseStatus.HUMAN_REVIEW) {
      this.statusService.assertTransitionAllowed(
        disputeCase.status,
        PrismaCaseStatus.HUMAN_REVIEW,
        UserRole.ANALYST,
      );
      await this.prisma.disputeCase.update({
        where: { id: caseId },
        data: { status: PrismaCaseStatus.HUMAN_REVIEW },
      });
    }

    await this.auditService.create({
      caseId,
      userId: actor.id,
      action: 'ANALYST_REVIEW_REQUIRED',
      entityType: 'DisputeCase',
      entityId: caseId,
      previousValue: { status: disputeCase.status },
      newValue: { status: PrismaCaseStatus.HUMAN_REVIEW, reason },
    });

    await this.caseEventsGateway.emitCaseEvent(
      caseId,
      'analyst.review.required',
      {
        caseId,
        newStatus: PrismaCaseStatus.HUMAN_REVIEW,
        title: 'Analyst review required',
        metadata: { reason },
      },
    );
  }

  private async findCaseForDecision(caseId: string) {
    const disputeCase = await this.prisma.disputeCase.findUnique({
      where: { id: caseId },
      include: {
        transaction: true,
        decisionRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    if (disputeCase.status === PrismaCaseStatus.CLOSED) {
      throw new ConflictException('Closed cases cannot be reviewed');
    }

    return disputeCase;
  }

  private async notifyParties(
    disputeCase: { id: string; cardMemberId: string; merchantId: string },
    notification: { title: string; message: string; type: string },
  ): Promise<void> {
    await this.notificationsService.createForUsers(
      [disputeCase.cardMemberId, disputeCase.merchantId],
      {
        caseId: disputeCase.id,
        ...notification,
      },
    );
  }
}

function serializeAnalystCase(disputeCase: {
  id: string;
  reasonCode: string;
  status: PrismaCaseStatus;
  cardMemberId: string;
  merchantId: string;
  responseDeadline: Date;
  createdAt: Date;
  transaction: {
    merchantName: string;
    amount: Prisma.Decimal;
    currency: string;
  };
  decisionRecords: Array<{
    recommendedOutcome: RecommendedOutcome;
    confidence: number;
    decisionMargin: number;
    explanationData?: Prisma.JsonValue;
  }>;
}): AnalystCaseResponse {
  const latestDecision = disputeCase.decisionRecords[0];
  const explanation = latestDecision?.explanationData as
    | { humanReviewReason?: string | null }
    | null
    | undefined;

  return {
    id: disputeCase.id,
    reasonCode: disputeCase.reasonCode,
    status: disputeCase.status,
    cardMemberId: disputeCase.cardMemberId,
    merchantId: disputeCase.merchantId,
    merchantName: disputeCase.transaction.merchantName,
    amount: disputeCase.transaction.amount.toString(),
    currency: disputeCase.transaction.currency,
    latestRecommendation: latestDecision?.recommendedOutcome ?? null,
    latestConfidence: latestDecision?.confidence ?? null,
    latestDecisionMargin: latestDecision?.decisionMargin ?? null,
    latestEscalationReason: explanation?.humanReviewReason ?? null,
    responseDeadline: disputeCase.responseDeadline.toISOString(),
    createdAt: disputeCase.createdAt.toISOString(),
  };
}

function decisionAlignsWithRecommendation(
  decision: AnalystDecision,
  recommendation: RecommendedOutcome,
): boolean {
  if (recommendation === RecommendedOutcome.CARD_MEMBER_SUPPORTED) {
    return decision === AnalystDecision.SUPPORT_CARD_MEMBER;
  }

  if (recommendation === RecommendedOutcome.MERCHANT_SUPPORTED) {
    return decision === AnalystDecision.SUPPORT_MERCHANT;
  }

  return (
    decision === AnalystDecision.REQUEST_MORE_INFORMATION ||
    decision === AnalystDecision.ESCALATE
  );
}

function statusForDecision(decision: AnalystDecision): PrismaCaseStatus {
  if (
    decision === AnalystDecision.SUPPORT_CARD_MEMBER ||
    decision === AnalystDecision.SUPPORT_MERCHANT
  ) {
    return PrismaCaseStatus.RESOLVED;
  }

  return PrismaCaseStatus.HUMAN_REVIEW;
}

function outcomeForAnalystDecision(
  decision: AnalystDecision,
): RecommendedOutcome {
  if (decision === AnalystDecision.SUPPORT_CARD_MEMBER) {
    return RecommendedOutcome.CARD_MEMBER_SUPPORTED;
  }

  if (decision === AnalystDecision.SUPPORT_MERCHANT) {
    return RecommendedOutcome.MERCHANT_SUPPORTED;
  }

  return RecommendedOutcome.HUMAN_REVIEW_REQUIRED;
}

function messageForDecision(decision: AnalystDecision): string {
  if (decision === AnalystDecision.SUPPORT_CARD_MEMBER) {
    return 'An analyst reviewed the dispute and supported the card member.';
  }

  if (decision === AnalystDecision.SUPPORT_MERCHANT) {
    return 'An analyst reviewed the dispute and supported the merchant.';
  }

  if (decision === AnalystDecision.REQUEST_MORE_INFORMATION) {
    return 'An analyst reviewed the dispute and requested more information.';
  }

  return 'An analyst escalated the dispute for additional review.';
}
