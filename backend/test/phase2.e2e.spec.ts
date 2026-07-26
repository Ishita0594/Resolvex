import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { CaseStatus } from '../src/disputes/case-status.enum';
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
  status: CaseStatus;
  responseDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
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

describe('Phase 2 card-member transactions and disputes', () => {
  let app: INestApplication;
  let users: TestUser[];
  let transactions: TestTransaction[];
  let disputeCases: TestDisputeCase[];
  let timelineEvents: TestTimelineEvent[];
  let userIdSequence: number;
  let disputeIdSequence: number;
  let timelineIdSequence: number;

  const memberTransactionId = '10000000-0000-4000-8000-000000000001';
  const otherMemberTransactionId = '10000000-0000-4000-8000-000000000002';
  const missingTransactionId = '10000000-0000-4000-8000-000000009999';

  beforeEach(async () => {
    users = [];
    disputeCases = [];
    timelineEvents = [];
    userIdSequence = 1;
    disputeIdSequence = 1;
    timelineIdSequence = 1;

    transactions = [
      createTransaction({
        id: memberTransactionId,
        cardMemberId: 'member-user-id',
        merchantId: 'merchant-user-id',
        merchantName: 'Northstar Electronics',
        amount: '249.99',
        maskedCardLast4: '4242',
      }),
      createTransaction({
        id: otherMemberTransactionId,
        cardMemberId: 'other-member-user-id',
        merchantId: 'merchant-user-id',
        merchantName: 'Harbor Home Goods',
        amount: '89.50',
        maskedCardLast4: '1881',
      }),
    ];

    const txMock = {
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
          const id = idForRole(data.role, userIdSequence);
          const user: TestUser = {
            id,
            createdAt: now,
            updatedAt: now,
            ...data,
          };
          userIdSequence += 1;
          users.push(user);
          return user;
        }),
      },
      transaction: {
        findMany: jest.fn(({ where }: { where: { cardMemberId: string } }) =>
          transactions
            .filter((transaction) => transaction.cardMemberId === where.cardMemberId)
            .sort((first, second) => second.transactionDate.getTime() - first.transactionDate.getTime()),
        ),
        findFirst: jest.fn(
          ({ where }: { where: { id: string; cardMemberId: string } }) =>
            transactions.find(
              (transaction) =>
                transaction.id === where.id && transaction.cardMemberId === where.cardMemberId,
            ) ?? null,
        ),
      },
      disputeCase: {
        findFirst: jest.fn(({ where, include, select }: DisputeFindFirstArgs) => {
          const disputeCase =
            disputeCases.find((item) => {
              if (where.transactionId && item.transactionId !== where.transactionId) {
                return false;
              }

              if (where.id && item.id !== where.id) {
                return false;
              }

              if (where.cardMemberId && item.cardMemberId !== where.cardMemberId) {
                return false;
              }

              if (where.status?.not && item.status === where.status.not) {
                return false;
              }

              return true;
            }) ?? null;

          if (!disputeCase) {
            return null;
          }

          if (select?.id) {
            return { id: disputeCase.id };
          }

          return include?.transaction ? withTransaction(disputeCase, transactions) : disputeCase;
        }),
        findMany: jest.fn(({ where, include }: DisputeFindManyArgs) => {
          const results = disputeCases.filter((item) => item.cardMemberId === where.cardMemberId);
          return include?.transaction
            ? results.map((item) => withTransaction(item, transactions))
            : results;
        }),
        create: jest.fn(({ data }: { data: CreateDisputeData }) => {
          const now = new Date();
          const disputeCase: TestDisputeCase = {
            id: `20000000-0000-4000-8000-${String(disputeIdSequence).padStart(12, '0')}`,
            merchantStatement: null,
            createdAt: now,
            updatedAt: now,
            resolvedAt: null,
            ...data,
          };
          disputeIdSequence += 1;
          disputeCases.push(disputeCase);
          return disputeCase;
        }),
        findUniqueOrThrow: jest.fn(({ where, include }: DisputeFindUniqueArgs) => {
          const disputeCase = disputeCases.find((item) => item.id === where.id);

          if (!disputeCase) {
            throw new Error('Dispute not found');
          }

          return include?.transaction ? withTransaction(disputeCase, transactions) : disputeCase;
        }),
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
        findMany: jest.fn(({ where }: { where: { caseId: string } }) =>
          timelineEvents.filter((event) => event.caseId === where.caseId),
        ),
      },
    };

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

  it('allows a member to list their transactions with safe decimal amounts', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    const response = await request(app.getHttpServer())
      .get('/api/transactions')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: memberTransactionId,
      amount: '249.99',
      maskedCardLast4: '4242',
    });
  });

  it('prevents a member from seeing another member transaction', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    await request(app.getHttpServer())
      .get(`/api/transactions/${otherMemberTransactionId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(404);
  });

  it('creates a valid dispute and timeline', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    const response = await request(app.getHttpServer())
      .post('/api/disputes')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        transactionId: memberTransactionId,
        reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
        cardMemberStatement: 'The package was never delivered to my address.',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      transactionId: memberTransactionId,
      reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
      status: CaseStatus.AWAITING_MERCHANT,
    });
    expect(timelineEvents.map((event) => event.eventType)).toEqual([
      'CASE_SUBMITTED',
      'AWAITING_MERCHANT_RESPONSE',
    ]);
  });

  it('rejects invalid dispute reasons', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    await request(app.getHttpServer())
      .post('/api/disputes')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        transactionId: memberTransactionId,
        reasonCode: 'FRAUD_DETECTION',
        cardMemberStatement: 'This reason should not be accepted.',
      })
      .expect(400);
  });

  it('rejects duplicate active disputes for one transaction', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    const payload = {
      transactionId: memberTransactionId,
      reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
      cardMemberStatement: 'The package was never delivered to my address.',
    };

    await request(app.getHttpServer())
      .post('/api/disputes')
      .set('Authorization', `Bearer ${memberToken}`)
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/disputes')
      .set('Authorization', `Bearer ${memberToken}`)
      .send(payload)
      .expect(409);
  });

  it('returns the timeline for a member dispute', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    const createResponse = await request(app.getHttpServer())
      .post('/api/disputes')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        transactionId: memberTransactionId,
        reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
        cardMemberStatement: 'The package was never delivered to my address.',
      })
      .expect(201);

    const timelineResponse = await request(app.getHttpServer())
      .get(`/api/disputes/${createResponse.body.id}/timeline`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(timelineResponse.body).toHaveLength(2);
    expect(timelineResponse.body[0].eventType).toBe('CASE_SUBMITTED');
  });

  it('prevents merchants and analysts from creating card-member disputes', async () => {
    const merchantToken = await registerAndGetToken(app, {
      name: 'ResolveX Merchant',
      email: 'merchant@resolvex.demo',
      role: UserRole.MERCHANT,
    });
    const analystToken = await registerAndGetToken(app, {
      name: 'ResolveX Analyst',
      email: 'analyst@resolvex.demo',
      role: UserRole.ANALYST,
    });

    const payload = {
      transactionId: memberTransactionId,
      reasonCode: ReasonCode.GOODS_NOT_RECEIVED,
      cardMemberStatement: 'The package was never delivered to my address.',
    };

    await request(app.getHttpServer())
      .post('/api/disputes')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send(payload)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/disputes')
      .set('Authorization', `Bearer ${analystToken}`)
      .send(payload)
      .expect(403);
  });

  it('returns 404 when creating a dispute for a missing transaction', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    await request(app.getHttpServer())
      .post('/api/disputes')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        transactionId: missingTransactionId,
        reasonCode: ReasonCode.REFUND_NOT_PROCESSED,
        cardMemberStatement: 'The merchant confirmed a refund, but it has not posted.',
      })
      .expect(404);
  });
});

type RegisterUserInput = {
  name: string;
  email: string;
  role: UserRole;
};

type DisputeFindFirstArgs = {
  where: {
    id?: string;
    transactionId?: string;
    cardMemberId?: string;
    status?: { not: CaseStatus };
  };
  include?: { transaction?: boolean };
  select?: { id?: boolean };
};

type DisputeFindManyArgs = {
  where: { cardMemberId: string };
  include?: { transaction?: boolean };
};

type DisputeFindUniqueArgs = {
  where: { id: string };
  include?: { transaction?: boolean };
};

type CreateDisputeData = Omit<
  TestDisputeCase,
  'id' | 'merchantStatement' | 'createdAt' | 'updatedAt' | 'resolvedAt'
>;

function createTransaction(input: {
  id: string;
  cardMemberId: string;
  merchantId: string;
  merchantName: string;
  amount: string;
  maskedCardLast4: string;
}): TestTransaction {
  const now = new Date('2026-07-24T00:00:00.000Z');

  return {
    id: input.id,
    cardMemberId: input.cardMemberId,
    merchantId: input.merchantId,
    merchantName: input.merchantName,
    amount: new Prisma.Decimal(input.amount),
    currency: 'USD',
    transactionDate: now,
    status: 'POSTED',
    maskedCardLast4: input.maskedCardLast4,
    createdAt: now,
    updatedAt: now,
  };
}

function withTransaction(disputeCase: TestDisputeCase, transactions: TestTransaction[]) {
  const transaction = transactions.find((item) => item.id === disputeCase.transactionId);

  if (!transaction) {
    throw new Error('Missing transaction fixture');
  }

  return {
    ...disputeCase,
    transaction,
  };
}

function idForRole(role: UserRole, sequence: number): string {
  if (role === UserRole.CARD_MEMBER && sequence === 1) {
    return 'member-user-id';
  }

  if (role === UserRole.MERCHANT) {
    return 'merchant-user-id';
  }

  if (role === UserRole.CARD_MEMBER) {
    return 'other-member-user-id';
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
