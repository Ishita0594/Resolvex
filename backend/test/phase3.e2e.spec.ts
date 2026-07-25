import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { CaseStatus } from '../src/disputes/case-status.enum';
import { MerchantResponseStatus } from '../src/disputes/merchant-response-status.enum';
import { ReasonCode } from '../src/disputes/reason-code.enum';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserRole } from '../src/users/user-role.enum';

type TestUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

type TestTransaction = {
  id: string;
  cardMemberId: string;
  merchantId: string;
  merchantName: string;
  amount: Prisma.Decimal;
  currency: string;
  transactionDate: Date;
  status: string;
  maskedCardLast4: string;
  createdAt: Date;
  updatedAt: Date;
};

type TestDisputeCase = {
  id: string;
  transactionId: string;
  cardMemberId: string;
  merchantId: string;
  reasonCode: ReasonCode;
  cardMemberStatement: string;
  merchantStatement: string | null;
  merchantResponseDate: Date | null;
  merchantResponseStatus: MerchantResponseStatus;
  status: CaseStatus;
  responseDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
};

type TestPolicyRequirement = {
  id: string;
  reasonCode: ReasonCode;
  requirementKey: string;
  requirementName: string;
  description: string;
  acceptedEvidenceTypes: string[];
  weight: number;
  isMandatory: boolean;
  policyVersion: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
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

describe('Phase 3 merchant disputes and policy requirements', () => {
  let app: INestApplication;
  let users: TestUser[];
  let transactions: TestTransaction[];
  let disputeCases: TestDisputeCase[];
  let policyRequirements: TestPolicyRequirement[];
  let timelineEvents: TestTimelineEvent[];
  let userIdSequence: number;
  let timelineIdSequence: number;

  const assignedGoodsCaseId = '20000000-0000-4000-8000-000000000001';
  const assignedRefundCaseId = '20000000-0000-4000-8000-000000000002';
  const assignedCancellationCaseId = '20000000-0000-4000-8000-000000000003';
  const otherMerchantCaseId = '20000000-0000-4000-8000-000000000004';
  const duplicateCaseId = '20000000-0000-4000-8000-000000000005';
  const invalidStatusCaseId = '20000000-0000-4000-8000-000000000006';

  beforeEach(async () => {
    users = [];
    timelineEvents = [];
    userIdSequence = 1;
    timelineIdSequence = 1;

    transactions = [
      createTransaction({
        id: '10000000-0000-4000-8000-000000000001',
        merchantId: 'merchant-user-id',
        merchantName: 'Northstar Electronics',
      }),
      createTransaction({
        id: '10000000-0000-4000-8000-000000000002',
        merchantId: 'merchant-user-id',
        merchantName: 'Harbor Home Goods',
      }),
      createTransaction({
        id: '10000000-0000-4000-8000-000000000003',
        merchantId: 'merchant-user-id',
        merchantName: 'Metro Travel Desk',
      }),
      createTransaction({
        id: '10000000-0000-4000-8000-000000000004',
        merchantId: 'other-merchant-user-id',
        merchantName: 'Other Merchant',
      }),
      createTransaction({
        id: '10000000-0000-4000-8000-000000000005',
        merchantId: 'merchant-user-id',
        merchantName: 'Already Responded',
      }),
      createTransaction({
        id: '10000000-0000-4000-8000-000000000006',
        merchantId: 'merchant-user-id',
        merchantName: 'Already Evaluating',
      }),
    ];
    transactionsForLookup = transactions;

    disputeCases = [
      createDisputeCase({
        id: assignedGoodsCaseId,
        transactionId: '10000000-0000-4000-8000-000000000001',
        merchantId: 'merchant-user-id',
        reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
      }),
      createDisputeCase({
        id: assignedRefundCaseId,
        transactionId: '10000000-0000-4000-8000-000000000002',
        merchantId: 'merchant-user-id',
        reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
      }),
      createDisputeCase({
        id: assignedCancellationCaseId,
        transactionId: '10000000-0000-4000-8000-000000000003',
        merchantId: 'merchant-user-id',
        reasonCode: ReasonCode.CANCELLED_GOODS_OR_SERVICES,
      }),
      createDisputeCase({
        id: otherMerchantCaseId,
        transactionId: '10000000-0000-4000-8000-000000000004',
        merchantId: 'other-merchant-user-id',
        reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
      }),
      createDisputeCase({
        id: duplicateCaseId,
        transactionId: '10000000-0000-4000-8000-000000000005',
        merchantId: 'merchant-user-id',
        reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
        merchantResponseStatus: MerchantResponseStatus.SUBMITTED,
        status: CaseStatus.EVIDENCE_PROCESSING,
      }),
      createDisputeCase({
        id: invalidStatusCaseId,
        transactionId: '10000000-0000-4000-8000-000000000006',
        merchantId: 'merchant-user-id',
        reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
        status: CaseStatus.UNDER_EVALUATION,
      }),
    ];

    policyRequirements = createPolicyRequirements();

    const txMock = buildPrismaMock();
    const prismaMock = {
      ...txMock,
      $transaction: jest.fn((callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('allows a merchant to list only assigned disputes', async () => {
    const merchantToken = await registerAndGetToken(app, {
      name: 'ResolveX Merchant',
      email: 'merchant@resolvex.demo',
      role: UserRole.MERCHANT,
    });

    const response = await request(app.getHttpServer())
      .get('/api/merchant/disputes')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);

    expect(response.body).toHaveLength(5);
    expect(response.body.map((item: { id: string }) => item.id)).not.toContain(otherMerchantCaseId);
  });

  it('prevents a merchant from seeing another merchant case', async () => {
    const merchantToken = await registerAndGetToken(app, {
      name: 'ResolveX Merchant',
      email: 'merchant@resolvex.demo',
      role: UserRole.MERCHANT,
    });

    await request(app.getHttpServer())
      .get(`/api/merchant/disputes/${otherMerchantCaseId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(404);
  });

  it.each([
    [assignedGoodsCaseId, ['invoice', 'dispatch_record', 'delivery_confirmation']],
    [assignedRefundCaseId, ['purchase_record', 'refund_reference', 'refund_amount']],
    [assignedCancellationCaseId, ['cancellation_request', 'cancellation_date']],
  ])('returns the correct prototype checklist for %s', async (caseId, expectedKeys) => {
    const merchantToken = await registerAndGetToken(app, {
      name: 'ResolveX Merchant',
      email: 'merchant@resolvex.demo',
      role: UserRole.MERCHANT,
    });

    const response = await request(app.getHttpServer())
      .get(`/api/disputes/${caseId}/requirements`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);

    const keys = response.body.map((requirement: { requirementKey: string }) => requirement.requirementKey);
    expect(keys).toEqual(expect.arrayContaining(expectedKeys));
    expect(response.body[0].description).toContain('Prototype ResolveX policy rule');
  });

  it('accepts a valid structured merchant response, updates the case, and records timeline events', async () => {
    const merchantToken = await registerAndGetToken(app, {
      name: 'ResolveX Merchant',
      email: 'merchant@resolvex.demo',
      role: UserRole.MERCHANT,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/disputes/${assignedGoodsCaseId}/merchant-response`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send(validGoodsResponse())
      .expect(200);

    expect(response.body).toMatchObject({
      id: assignedGoodsCaseId,
      status: CaseStatus.EVIDENCE_PROCESSING,
      merchantResponseStatus: MerchantResponseStatus.SUBMITTED,
      merchantStatement: validGoodsResponse().merchantStatement,
    });
    expect(response.body.merchantResponseDate).toBeTruthy();
    expect(timelineEvents.map((event) => event.eventType)).toEqual([
      'MERCHANT_RESPONSE_SUBMITTED',
      'CASE_STATUS_CHANGED',
    ]);
  });

  it('blocks duplicate final merchant responses', async () => {
    const merchantToken = await registerAndGetToken(app, {
      name: 'ResolveX Merchant',
      email: 'merchant@resolvex.demo',
      role: UserRole.MERCHANT,
    });

    await request(app.getHttpServer())
      .post(`/api/disputes/${duplicateCaseId}/merchant-response`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send(validGoodsResponse())
      .expect(409);
  });

  it('prevents card members from using merchant endpoints', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    await request(app.getHttpServer())
      .get('/api/merchant/disputes')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/disputes/${assignedGoodsCaseId}/merchant-response`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send(validGoodsResponse())
      .expect(403);
  });

  it('fails invalid merchant status transitions', async () => {
    const merchantToken = await registerAndGetToken(app, {
      name: 'ResolveX Merchant',
      email: 'merchant@resolvex.demo',
      role: UserRole.MERCHANT,
    });

    await request(app.getHttpServer())
      .post(`/api/disputes/${invalidStatusCaseId}/merchant-response`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send(validGoodsResponse())
      .expect(409);
  });

  function buildPrismaMock() {
    return {
      user: {
        findUnique: jest.fn(({ where }: { where: { email?: string; id?: string } }) => {
          if (where.email) {
            return users.find((user) => user.email === where.email) ?? null;
          }

          if (where.id) {
            return users.find((user) => user.id === where.id) ?? null;
          }

          return null;
        }),
        create: jest.fn(({ data }: { data: Omit<TestUser, 'id' | 'createdAt' | 'updatedAt'> }) => {
          const now = new Date();
          const user: TestUser = {
            id: idForRoleAndEmail(data.role, data.email, userIdSequence),
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          userIdSequence += 1;
          users.push(user);
          return user;
        }),
      },
      disputeCase: {
        findMany: jest.fn(({ where }: { where: { merchantId?: string; cardMemberId?: string } }) =>
          disputeCases
            .filter((item) => {
              if (where.merchantId && item.merchantId !== where.merchantId) {
                return false;
              }

              if (where.cardMemberId && item.cardMemberId !== where.cardMemberId) {
                return false;
              }

              return true;
            })
            .map((item) => withTransaction(item)),
        ),
        findFirst: jest.fn(({ where, include, select }: DisputeFindFirstArgs) => {
          const disputeCase =
            disputeCases.find((item) => {
              if (where.id && item.id !== where.id) {
                return false;
              }

              if (where.merchantId && item.merchantId !== where.merchantId) {
                return false;
              }

              if (where.cardMemberId && item.cardMemberId !== where.cardMemberId) {
                return false;
              }

              return true;
            }) ?? null;

          if (!disputeCase) {
            return null;
          }

          if (select?.reasonCode) {
            return { reasonCode: disputeCase.reasonCode };
          }

          return include?.transaction ? withTransaction(disputeCase) : disputeCase;
        }),
        update: jest.fn(({ where, data, include }: DisputeUpdateArgs) => {
          const index = disputeCases.findIndex((item) => item.id === where.id);
          if (index === -1) {
            throw new Error('Dispute case not found');
          }

          disputeCases[index] = {
            ...disputeCases[index],
            ...data,
            updatedAt: new Date(),
          };

          return include?.transaction ? withTransaction(disputeCases[index]) : disputeCases[index];
        }),
      },
      policyRequirement: {
        findMany: jest.fn(({ where }: { where: { reasonCode: ReasonCode; active: boolean } }) =>
          policyRequirements
            .filter((requirement) => requirement.reasonCode === where.reasonCode && requirement.active === where.active)
            .sort((first, second) => {
              if (first.isMandatory !== second.isMandatory) {
                return first.isMandatory ? -1 : 1;
              }

              return first.requirementKey.localeCompare(second.requirementKey);
            }),
        ),
      },
      timelineEvent: {
        create: jest.fn(({ data }: { data: Omit<TestTimelineEvent, 'id' | 'createdAt'> }) => {
          const event: TestTimelineEvent = {
            id: `30000000-0000-4000-8000-${String(timelineIdSequence).padStart(12, '0')}`,
            createdAt: new Date(),
            ...data,
          };
          timelineIdSequence += 1;
          timelineEvents.push(event);
          return event;
        }),
      },
    };
  }
});

type RegisterUserInput = {
  name: string;
  email: string;
  role: UserRole;
};

type DisputeFindFirstArgs = {
  where: {
    id?: string;
    merchantId?: string;
    cardMemberId?: string;
  };
  include?: { transaction?: boolean };
  select?: { reasonCode?: boolean };
};

type DisputeUpdateArgs = {
  where: { id: string };
  data: Partial<TestDisputeCase>;
  include?: { transaction?: boolean };
};

function createTransaction(input: { id: string; merchantId: string; merchantName: string }): TestTransaction {
  const now = new Date('2026-07-24T00:00:00.000Z');

  return {
    id: input.id,
    cardMemberId: 'member-user-id',
    merchantId: input.merchantId,
    merchantName: input.merchantName,
    amount: new Prisma.Decimal('249.99'),
    currency: 'USD',
    transactionDate: now,
    status: 'POSTED',
    maskedCardLast4: '4242',
    createdAt: now,
    updatedAt: now,
  };
}

function createDisputeCase(input: {
  id: string;
  transactionId: string;
  merchantId: string;
  reasonCode: ReasonCode;
  status?: CaseStatus;
  merchantResponseStatus?: MerchantResponseStatus;
}): TestDisputeCase {
  const now = new Date('2026-07-24T00:00:00.000Z');
  const deadline = new Date('2026-08-01T00:00:00.000Z');

  return {
    id: input.id,
    transactionId: input.transactionId,
    cardMemberId: 'member-user-id',
    merchantId: input.merchantId,
    reasonCode: input.reasonCode,
    cardMemberStatement: 'The card member disputes this transaction.',
    merchantStatement: null,
    merchantResponseDate: null,
    merchantResponseStatus: input.merchantResponseStatus ?? MerchantResponseStatus.PENDING,
    status: input.status ?? CaseStatus.AWAITING_MERCHANT,
    responseDeadline: deadline,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };
}

function createPolicyRequirements(): TestPolicyRequirement[] {
  const now = new Date('2026-07-24T00:00:00.000Z');
  const base = {
    policyVersion: 'prototype-v1',
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  return [
    requirement('invoice', ReasonCode.GOODS_NOT_RECEIVED, ['invoice'], true, base),
    requirement('dispatch_record', ReasonCode.GOODS_NOT_RECEIVED, ['dispatch_record'], true, base),
    requirement(
      'delivery_confirmation',
      ReasonCode.GOODS_NOT_RECEIVED,
      ['tracking_record', 'delivery_confirmation'],
      true,
      base,
    ),
    requirement('purchase_record', ReasonCode.REFUND_NOT_PROCESSED, ['purchase_record'], true, base),
    requirement('refund_reference', ReasonCode.REFUND_NOT_PROCESSED, ['refund_reference'], true, base),
    requirement('refund_amount', ReasonCode.REFUND_NOT_PROCESSED, ['refund_amount'], true, base),
    requirement('cancellation_request', ReasonCode.CANCELLED_GOODS_OR_SERVICES, ['cancellation_request'], true, base),
    requirement('cancellation_date', ReasonCode.CANCELLED_GOODS_OR_SERVICES, ['cancellation_date'], true, base),
  ];
}

function requirement(
  key: string,
  reasonCode: ReasonCode,
  acceptedEvidenceTypes: string[],
  isMandatory: boolean,
  base: Pick<TestPolicyRequirement, 'policyVersion' | 'active' | 'createdAt' | 'updatedAt'>,
): TestPolicyRequirement {
  return {
    id: `50000000-0000-4000-8000-${key.length.toString().padStart(12, '0')}`,
    reasonCode,
    requirementKey: key,
    requirementName: key.replace(/_/g, ' '),
    description: 'Prototype ResolveX policy rule, not official legal or card-network policy: test requirement.',
    acceptedEvidenceTypes,
    weight: 10,
    isMandatory,
    ...base,
  };
}

function validGoodsResponse() {
  return {
    merchantStatement: 'We shipped the order and have structured evidence matching the prototype checklist.',
    evidence: [
      {
        requirementKey: 'invoice',
        evidenceType: 'invoice',
        value: 'Invoice INV-001',
      },
      {
        requirementKey: 'dispatch_record',
        evidenceType: 'dispatch_record',
        value: 'Dispatch record DSP-001',
      },
      {
        requirementKey: 'delivery_confirmation',
        evidenceType: 'tracking_record',
        value: 'Tracking record TRK-001',
      },
    ],
  };
}

function withTransaction(disputeCase: TestDisputeCase) {
  const transaction = transactionsForLookup.find((item) => item.id === disputeCase.transactionId);

  if (!transaction) {
    throw new Error('Missing transaction fixture');
  }

  return {
    ...disputeCase,
    transaction,
  };
}

let transactionsForLookup: TestTransaction[] = [];

function idForRoleAndEmail(role: UserRole, email: string, sequence: number): string {
  if (role === UserRole.MERCHANT && email === 'merchant@resolvex.demo') {
    return 'merchant-user-id';
  }

  if (role === UserRole.MERCHANT) {
    return 'other-merchant-user-id';
  }

  if (role === UserRole.CARD_MEMBER) {
    return 'member-user-id';
  }

  return `user-${sequence}`;
}

async function registerAndGetToken(app: INestApplication, input: RegisterUserInput): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      ...input,
      password: 'CorrectPassword123!',
    })
    .expect(201);

  return response.body.accessToken as string;
}
