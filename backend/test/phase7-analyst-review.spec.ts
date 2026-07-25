import 'reflect-metadata';
import {
  AnalystDecision,
  CaseStatus,
  DecisionType,
  Prisma,
  ReasonCode,
  RecommendedOutcome,
} from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator';
import { AnalystController } from '../src/analyst/analyst.controller';
import { AnalystReviewService } from '../src/analyst/analyst-review.service';
import { CaseStatusService } from '../src/disputes/case-status.service';
import { CaseEventsGateway } from '../src/events/case-events.gateway';
import { UserRole } from '../src/users/user-role.enum';

describe('Phase 7 analyst review backend', () => {
  it('lists low-confidence human-review cases in the analyst queue', async () => {
    const fixture = buildFixture(humanReviewCase());

    const queue = await fixture.service.listQueue();

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id: fixture.disputeCase.id,
      latestRecommendation: RecommendedOutcome.HUMAN_REVIEW_REQUIRED,
    });
  });

  it('restricts analyst case endpoints to the ANALYST role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AnalystController);

    expect(roles).toEqual([UserRole.ANALYST]);
  });

  it('allows an analyst to approve the system recommendation', async () => {
    const fixture = buildFixture(merchantRecommendedCase());

    const result = await fixture.service.decide(
      fixture.disputeCase.id,
      analystUser(),
      {
        decision: AnalystDecision.SUPPORT_MERCHANT,
        analystNotes:
          'System recommendation is supported by completed refund evidence.',
      },
    );

    expect(result.status).toBe(CaseStatus.RESOLVED);
    expect(result.overrideReason).toBeNull();
    expect(fixture.analystReviews[0]).toMatchObject({
      systemRecommendation: RecommendedOutcome.MERCHANT_SUPPORTED,
      analystDecision: AnalystDecision.SUPPORT_MERCHANT,
    });
  });

  it('rejects an override without a reason', async () => {
    const fixture = buildFixture(merchantRecommendedCase());

    await expect(
      fixture.service.decide(fixture.disputeCase.id, analystUser(), {
        decision: AnalystDecision.SUPPORT_CARD_MEMBER,
      }),
    ).rejects.toThrow('overrideReason is required');
  });

  it('allows an override with a reason and preserves earlier decision records', async () => {
    const fixture = buildFixture(merchantRecommendedCase());

    const result = await fixture.service.decide(
      fixture.disputeCase.id,
      analystUser(),
      {
        decision: AnalystDecision.SUPPORT_CARD_MEMBER,
        overrideReason:
          'Merchant refund evidence has an unresolved processor reference contradiction.',
        analystNotes: 'Manual review favored the card member.',
      },
    );

    expect(result.status).toBe(CaseStatus.RESOLVED);
    expect(fixture.disputeCase.status).toBe(CaseStatus.RESOLVED);
    expect(fixture.decisionRecords).toHaveLength(2);
    expect(fixture.decisionRecords[1]).toMatchObject({
      decisionType: DecisionType.HUMAN_DECISION,
      recommendedOutcome: RecommendedOutcome.CARD_MEMBER_SUPPORTED,
    });
  });

  it('audits analyst decisions and status changes', async () => {
    const fixture = buildFixture(merchantRecommendedCase());

    await fixture.service.decide(fixture.disputeCase.id, analystUser(), {
      decision: AnalystDecision.SUPPORT_MERCHANT,
    });

    expect(fixture.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'ANALYST_DECISION_RECORDED',
          entityType: 'AnalystReview',
          previousValue: expect.objectContaining({
            status: CaseStatus.HUMAN_REVIEW,
          }),
          newValue: expect.objectContaining({ status: CaseStatus.RESOLVED }),
        }),
      ]),
    );
    expect(fixture.timelineEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'ANALYST_DECISION_RECORDED',
        'CASE_STATUS_CHANGED',
      ]),
    );
  });

  it('generates notifications for both parties', async () => {
    const fixture = buildFixture(merchantRecommendedCase());

    await fixture.service.decide(fixture.disputeCase.id, analystUser(), {
      decision: AnalystDecision.SUPPORT_MERCHANT,
    });

    expect(fixture.notificationsService.createForUsers).toHaveBeenCalledWith(
      ['card-member-1', 'merchant-1'],
      expect.objectContaining({
        caseId: fixture.disputeCase.id,
        type: 'ANALYST_DECISION',
      }),
    );
  });

  it('requests information with audit, notification, and event output', async () => {
    const fixture = buildFixture(humanReviewCase());

    const result = await fixture.service.requestInformation(
      fixture.disputeCase.id,
      analystUser(),
      {
        message: 'Please upload the processor trace and delivery confirmation.',
        requestedEvidenceTypes: ['processor_trace', 'delivery_confirmation'],
      },
    );

    expect(result.status).toBe(CaseStatus.AWAITING_MERCHANT);
    expect(fixture.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'INFORMATION_REQUESTED' }),
      ]),
    );
    expect(fixture.notificationsService.createForUsers).toHaveBeenCalledWith(
      ['card-member-1', 'merchant-1'],
      expect.objectContaining({ type: 'INFORMATION_REQUESTED' }),
    );
    expect(fixture.caseEventsGateway.emitCaseEvent).toHaveBeenCalledWith(
      fixture.disputeCase.id,
      'information.requested',
      expect.objectContaining({ newStatus: CaseStatus.AWAITING_MERCHANT }),
    );
  });

  it('does not send case events to unauthorized users', async () => {
    const emittedRooms: string[] = [];
    const prismaMock = {
      disputeCase: {
        findUnique: jest.fn(() => ({
          cardMemberId: 'card-member-1',
          merchantId: 'merchant-1',
        })),
      },
      user: {
        findMany: jest.fn(() => [{ id: 'analyst-1' }]),
      },
    };
    const gateway = new CaseEventsGateway(
      {} as JwtService,
      prismaMock as never,
    );
    gateway.server = {
      to: (room: string) => ({
        emit: () => emittedRooms.push(room),
      }),
    } as never;

    const recipients = await gateway.emitCaseEvent(
      'case-1',
      'case.status.updated',
      {
        caseId: 'case-1',
        newStatus: CaseStatus.RESOLVED,
        title: 'Case status updated',
        metadata: { evidenceCount: 2 },
      },
    );

    expect(recipients).toEqual(['card-member-1', 'merchant-1', 'analyst-1']);
    expect(recipients).not.toContain('other-user');
    expect(emittedRooms).not.toContain('user:other-user');
  });
});

function buildFixture(disputeCase: TestDisputeCase) {
  const analystReviews: TestAnalystReview[] = [];
  const auditLogs: TestAuditLog[] = [];
  const timelineEvents: TestTimelineEvent[] = [];
  const decisionRecords = [...disputeCase.decisionRecords];
  const txMock = {
    analystReview: {
      create: jest.fn(
        ({ data }: { data: Omit<TestAnalystReview, 'id' | 'createdAt'> }) => {
          const review = {
            id: `review-${analystReviews.length + 1}`,
            createdAt: new Date('2026-07-25T00:00:00.000Z'),
            ...data,
          };
          analystReviews.push(review);
          return review;
        },
      ),
    },
    disputeCase: {
      update: jest.fn(({ data }: { data: Partial<TestDisputeCase> }) => {
        Object.assign(disputeCase, data);
        return disputeCase;
      }),
    },
    timelineEvent: {
      create: jest.fn(
        ({ data }: { data: Omit<TestTimelineEvent, 'id' | 'createdAt'> }) => {
          const event = {
            id: `timeline-${timelineEvents.length + 1}`,
            createdAt: new Date('2026-07-25T00:00:00.000Z'),
            ...data,
          };
          timelineEvents.push(event);
          return event;
        },
      ),
    },
    auditLog: {
      create: jest.fn(
        ({ data }: { data: Omit<TestAuditLog, 'id' | 'createdAt'> }) => {
          const auditLog = {
            id: `audit-${auditLogs.length + 1}`,
            createdAt: new Date('2026-07-25T00:00:00.000Z'),
            ...data,
          };
          auditLogs.push(auditLog);
          return auditLog;
        },
      ),
    },
    decisionRecord: {
      create: jest.fn(
        ({ data }: { data: Omit<TestDecisionRecord, 'id' | 'createdAt'> }) => {
          const decisionRecord = {
            id: `decision-${decisionRecords.length + 1}`,
            createdAt: new Date('2026-07-25T00:00:00.000Z'),
            ...data,
          };
          decisionRecords.push(decisionRecord);
          return decisionRecord;
        },
      ),
    },
  };
  const prismaMock = {
    disputeCase: {
      findMany: jest.fn(() => [disputeCase]),
      findUnique: jest.fn(() => ({
        ...disputeCase,
        decisionRecords: [decisionRecords[decisionRecords.length - 1]],
        analystReviews,
      })),
    },
    $transaction: jest.fn((callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
    ),
  };
  const notificationsService = {
    createForUsers: jest.fn(() => Promise.resolve()),
  };
  const caseEventsGateway = {
    emitCaseEvent: jest.fn(() =>
      Promise.resolve(['card-member-1', 'merchant-1']),
    ),
  };

  return {
    disputeCase,
    analystReviews,
    auditLogs,
    timelineEvents,
    decisionRecords,
    notificationsService,
    caseEventsGateway,
    service: new AnalystReviewService(
      prismaMock as never,
      new CaseStatusService(),
      { create: jest.fn() } as never,
      notificationsService as never,
      caseEventsGateway as never,
    ),
  };
}

function humanReviewCase(): TestDisputeCase {
  return baseCase(CaseStatus.HUMAN_REVIEW, {
    recommendedOutcome: RecommendedOutcome.HUMAN_REVIEW_REQUIRED,
    confidence: 62,
    decisionMargin: 8,
  });
}

function merchantRecommendedCase(): TestDisputeCase {
  return baseCase(CaseStatus.HUMAN_REVIEW, {
    recommendedOutcome: RecommendedOutcome.MERCHANT_SUPPORTED,
    confidence: 91,
    decisionMargin: 35,
  });
}

function baseCase(
  status: CaseStatus,
  decision: Pick<
    TestDecisionRecord,
    'recommendedOutcome' | 'confidence' | 'decisionMargin'
  >,
): TestDisputeCase {
  return {
    id: 'case-1',
    transactionId: 'transaction-1',
    cardMemberId: 'card-member-1',
    merchantId: 'merchant-1',
    reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
    cardMemberStatement: 'Refund was promised and not received.',
    merchantStatement: null,
    merchantResponseDate: null,
    merchantResponseStatus: 'SUBMITTED',
    status,
    responseDeadline: new Date('2026-07-30T00:00:00.000Z'),
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    updatedAt: new Date('2026-07-24T00:00:00.000Z'),
    resolvedAt: null,
    transaction: {
      merchantName: 'Northstar Electronics',
      amount: new Prisma.Decimal('249.99'),
      currency: 'USD',
    },
    decisionRecords: [
      {
        id: 'decision-1',
        caseId: 'case-1',
        cardMemberScore:
          decision.recommendedOutcome ===
          RecommendedOutcome.CARD_MEMBER_SUPPORTED
            ? 91
            : 0,
        merchantScore:
          decision.recommendedOutcome === RecommendedOutcome.MERCHANT_SUPPORTED
            ? 91
            : 0,
        decisionType: DecisionType.AUTOMATED_RECOMMENDATION,
        policyVersion: 'prototype-v1',
        modelMetadata: { aiDecisionUsed: false },
        explanationData: {},
        createdAt: new Date('2026-07-24T00:00:00.000Z'),
        ...decision,
      },
    ],
    analystReviews: [],
  };
}

function analystUser() {
  return {
    id: 'analyst-1',
    name: 'ResolveX Analyst',
    email: 'analyst@resolvex.demo',
    role: UserRole.ANALYST,
  };
}

type TestDisputeCase = {
  id: string;
  transactionId: string;
  cardMemberId: string;
  merchantId: string;
  reasonCode: ReasonCode;
  cardMemberStatement: string;
  merchantStatement: string | null;
  merchantResponseDate: Date | null;
  merchantResponseStatus: string;
  status: CaseStatus;
  responseDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  transaction: {
    merchantName: string;
    amount: Prisma.Decimal;
    currency: string;
  };
  decisionRecords: TestDecisionRecord[];
  analystReviews: TestAnalystReview[];
};

type TestDecisionRecord = {
  id: string;
  caseId: string;
  recommendedOutcome: RecommendedOutcome;
  cardMemberScore: number;
  merchantScore: number;
  confidence: number;
  decisionMargin: number;
  decisionType: DecisionType;
  policyVersion: string;
  modelMetadata: unknown;
  explanationData: unknown;
  createdAt: Date;
};

type TestAnalystReview = {
  id: string;
  caseId: string;
  analystId: string;
  systemRecommendation: RecommendedOutcome;
  analystDecision: AnalystDecision;
  overrideReason: string | null;
  analystNotes: string | null;
  createdAt: Date;
};

type TestAuditLog = {
  id: string;
  caseId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: Date;
};

type TestTimelineEvent = {
  id: string;
  caseId: string;
  eventType: string;
  description: string;
  performedBy: string | null;
  metadata: unknown;
  createdAt: Date;
};
