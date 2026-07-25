import { ConflictException, Injectable } from '@nestjs/common';
import {
  CaseStatus as PrismaCaseStatus,
  MerchantResponseStatus as PrismaMerchantResponseStatus,
} from '@prisma/client';
import { UserRole } from '../users/user-role.enum';

type MerchantResponseCaseState = {
  status: PrismaCaseStatus;
  responseDeadline: Date;
  merchantResponseStatus: PrismaMerchantResponseStatus;
};

@Injectable()
export class CaseStatusService {
  assertTransitionAllowed(
    from: PrismaCaseStatus,
    to: PrismaCaseStatus,
    role: UserRole,
  ): void {
    const allowed = this.allowedTransitionsFor(role).some(
      (transition) => transition.from === from && transition.to === to,
    );

    if (!allowed) {
      throw new ConflictException(
        `Invalid status transition from ${from} to ${to}`,
      );
    }
  }

  assertMerchantResponseAllowed(
    disputeCase: MerchantResponseCaseState,
    now = new Date(),
  ): void {
    if (
      disputeCase.merchantResponseStatus ===
      PrismaMerchantResponseStatus.SUBMITTED
    ) {
      throw new ConflictException(
        'A final merchant response has already been submitted',
      );
    }

    this.assertTransitionAllowed(
      disputeCase.status,
      PrismaCaseStatus.EVIDENCE_PROCESSING,
      UserRole.MERCHANT,
    );

    if (
      disputeCase.responseDeadline.getTime() < now.getTime() &&
      disputeCase.merchantResponseStatus !==
        PrismaMerchantResponseStatus.REOPENED
    ) {
      throw new ConflictException('Merchant response deadline has passed');
    }
  }

  private allowedTransitionsFor(
    role: UserRole,
  ): Array<{ from: PrismaCaseStatus; to: PrismaCaseStatus }> {
    if (role === UserRole.MERCHANT) {
      return [
        {
          from: PrismaCaseStatus.AWAITING_MERCHANT,
          to: PrismaCaseStatus.EVIDENCE_PROCESSING,
        },
      ];
    }

    if (role === UserRole.ANALYST) {
      return [
        {
          from: PrismaCaseStatus.SUBMITTED,
          to: PrismaCaseStatus.AWAITING_MERCHANT,
        },
        {
          from: PrismaCaseStatus.SUBMITTED,
          to: PrismaCaseStatus.EVIDENCE_PROCESSING,
        },
        {
          from: PrismaCaseStatus.EVIDENCE_PROCESSING,
          to: PrismaCaseStatus.UNDER_EVALUATION,
        },
        {
          from: PrismaCaseStatus.UNDER_EVALUATION,
          to: PrismaCaseStatus.RESOLVED,
        },
        {
          from: PrismaCaseStatus.UNDER_EVALUATION,
          to: PrismaCaseStatus.HUMAN_REVIEW,
        },
        {
          from: PrismaCaseStatus.HUMAN_REVIEW,
          to: PrismaCaseStatus.AWAITING_MERCHANT,
        },
        {
          from: PrismaCaseStatus.UNDER_EVALUATION,
          to: PrismaCaseStatus.AWAITING_MERCHANT,
        },
        { from: PrismaCaseStatus.HUMAN_REVIEW, to: PrismaCaseStatus.RESOLVED },
        { from: PrismaCaseStatus.APPEALED, to: PrismaCaseStatus.HUMAN_REVIEW },
        { from: PrismaCaseStatus.APPEALED, to: PrismaCaseStatus.CLOSED },
        { from: PrismaCaseStatus.RESOLVED, to: PrismaCaseStatus.CLOSED },
      ];
    }

    if (role === UserRole.CARD_MEMBER) {
      return [
        { from: PrismaCaseStatus.DRAFT, to: PrismaCaseStatus.SUBMITTED },
        { from: PrismaCaseStatus.RESOLVED, to: PrismaCaseStatus.APPEALED },
      ];
    }

    return [];
  }
}
