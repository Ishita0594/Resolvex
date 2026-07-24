import { DisputeCase, TimelineEvent, Transaction } from '@prisma/client';
import { serializeTransaction, TransactionResponse } from '../transactions/transactions.serializer';

type DisputeCaseWithTransaction = DisputeCase & {
  transaction: Transaction;
};

export type DisputeCaseResponse = {
  id: string;
  transactionId: string;
  cardMemberId: string;
  merchantId: string;
  reasonCode: string;
  cardMemberStatement: string;
  merchantStatement: string | null;
  status: string;
  responseDeadline: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  transaction: TransactionResponse;
};

export type TimelineEventResponse = {
  id: string;
  caseId: string;
  eventType: string;
  description: string;
  performedBy: string | null;
  metadata: unknown;
  createdAt: string;
};

export function serializeDisputeCase(disputeCase: DisputeCaseWithTransaction): DisputeCaseResponse {
  return {
    id: disputeCase.id,
    transactionId: disputeCase.transactionId,
    cardMemberId: disputeCase.cardMemberId,
    merchantId: disputeCase.merchantId,
    reasonCode: disputeCase.reasonCode,
    cardMemberStatement: disputeCase.cardMemberStatement,
    merchantStatement: disputeCase.merchantStatement,
    status: disputeCase.status,
    responseDeadline: disputeCase.responseDeadline.toISOString(),
    createdAt: disputeCase.createdAt.toISOString(),
    updatedAt: disputeCase.updatedAt.toISOString(),
    resolvedAt: disputeCase.resolvedAt?.toISOString() ?? null,
    transaction: serializeTransaction(disputeCase.transaction),
  };
}

export function serializeTimelineEvent(event: TimelineEvent): TimelineEventResponse {
  return {
    id: event.id,
    caseId: event.caseId,
    eventType: event.eventType,
    description: event.description,
    performedBy: event.performedBy,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
  };
}
