import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CaseStatus,
  EvidenceProcessingStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { rm } from 'fs/promises';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
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

type TestDisputeCase = {
  id: string;
  transactionId: string;
  cardMemberId: string;
  merchantId: string;
  reasonCode: 'GOODS_NOT_RECEIVED';
  cardMemberStatement: string;
  merchantStatement: string | null;
  merchantResponseDate: Date | null;
  merchantResponseStatus: 'PENDING';
  status: CaseStatus;
  responseDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
};

type TestEvidenceItem = {
  id: string;
  caseId: string;
  submittedByUserId: string;
  submittedByRole: Role;
  evidenceType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  fileHash: string | null;
  processingStatus: EvidenceProcessingStatus;
  extractionConfidence: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type TestExtractedFact = {
  id: string;
  evidenceId: string;
  factType: string;
  factValue: string;
  normalizedValue: string | null;
  confidence: number | null;
  sourcePage: number | null;
  verifiedByUser: boolean;
  correctedByUser: boolean;
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

describe('Phase 4 evidence upload and metadata', () => {
  let app: INestApplication;
  let users: TestUser[];
  let disputeCases: TestDisputeCase[];
  let evidenceItems: TestEvidenceItem[];
  let extractedFacts: TestExtractedFact[];
  let timelineEvents: TestTimelineEvent[];
  let userIdSequence: number;
  let factIdSequence: number;
  let timelineIdSequence: number;
  let localStoragePath: string;

  const caseId = '20000000-0000-4000-8000-000000000101';
  const lockedCaseId = '20000000-0000-4000-8000-000000000102';

  beforeEach(async () => {
    localStoragePath = `./tmp/test-evidence-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_PATH = localStoragePath;
    process.env.MAX_EVIDENCE_FILE_SIZE_BYTES = '20';
    process.env.EVIDENCE_UPLOAD_URL_TTL_SECONDS = '600';
    process.env.EVIDENCE_DOWNLOAD_URL_TTL_SECONDS = '300';

    users = [];
    evidenceItems = [];
    extractedFacts = [];
    timelineEvents = [];
    userIdSequence = 1;
    factIdSequence = 1;
    timelineIdSequence = 1;
    disputeCases = [
      createDisputeCase(caseId, CaseStatus.AWAITING_MERCHANT),
      createDisputeCase(lockedCaseId, CaseStatus.UNDER_EVALUATION),
    ];

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

    await rm(localStoragePath, { recursive: true, force: true });
  });

  it('accepts a valid local upload, confirmation, and metadata persistence', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    const evidence = await uploadAndConfirm(memberToken, caseId, 'delivery-proof.pdf', 'application/pdf');

    expect(evidence).toMatchObject({
      caseId,
      submittedByRole: UserRole.CARD_MEMBER,
      evidenceType: 'delivery_confirmation',
      fileName: 'delivery-proof.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 14,
      processingStatus: EvidenceProcessingStatus.UPLOADED,
    });
    expect(evidence.fileHash).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.storageKey).toBeUndefined();
    expect(evidenceItems).toHaveLength(1);
    expect(timelineEvents.map((event) => event.eventType)).toEqual([
      'EVIDENCE_UPLOAD_TARGET_CREATED',
      'EVIDENCE_UPLOADED',
    ]);
  });

  it('rejects unsupported and executable file types', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    await request(app.getHttpServer())
      .post(`/api/disputes/${caseId}/evidence/upload-target`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        evidenceType: 'malware',
        fileName: 'proof.exe',
        mimeType: 'application/octet-stream',
        sizeBytes: 10,
      })
      .expect(400);
  });

  it('rejects oversized evidence before upload target creation', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });

    await request(app.getHttpServer())
      .post(`/api/disputes/${caseId}/evidence/upload-target`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        evidenceType: 'delivery_confirmation',
        fileName: 'large-proof.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10 * 1024 * 1024 + 1,
      })
      .expect(400);
  });

  it('prevents an unauthorized user from reading evidence', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });
    const otherMemberToken = await registerAndGetToken(app, {
      name: 'Other Member',
      email: 'other-member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });
    const evidence = await uploadAndConfirm(memberToken, caseId, 'delivery-proof.pdf', 'application/pdf');

    await request(app.getHttpServer())
      .get(`/api/evidence/${evidence.id}`)
      .set('Authorization', `Bearer ${otherMemberToken}`)
      .expect(404);
  });

  it('prevents a party from altering evidence submitted by the other party', async () => {
    const merchantToken = await registerAndGetToken(app, {
      name: 'ResolveX Merchant',
      email: 'merchant@resolvex.demo',
      role: UserRole.MERCHANT,
    });
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });
    const evidence = await uploadAndConfirm(merchantToken, caseId, 'merchant-proof.png', 'image/png');

    await request(app.getHttpServer())
      .patch(`/api/evidence/${evidence.id}/facts`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        facts: [
          {
            factType: 'tracking_number',
            factValue: 'DEMO-TRACK-123',
          },
        ],
      })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/evidence/${evidence.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('returns a short-lived temporary download URL that can stream local content', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });
    const evidence = await uploadAndConfirm(memberToken, caseId, 'delivery-proof.pdf', 'application/pdf');

    const targetResponse = await request(app.getHttpServer())
      .get(`/api/evidence/${evidence.id}/download`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(targetResponse.body.downloadUrl).toContain(`/api/evidence/${evidence.id}/download-content`);
    expect(targetResponse.body.expiresAt).toEqual(expect.any(String));

    const downloadPath = pathFromUrl(targetResponse.body.downloadUrl);
    const downloadResponse = await request(app.getHttpServer()).get(downloadPath).expect(200);
    expect(downloadResponse.body.toString()).toBe('phase4 content');
  });

  it('allows deletion in editable case statuses and records an audit event', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });
    const evidence = await uploadAndConfirm(memberToken, caseId, 'delivery-proof.pdf', 'application/pdf');

    await request(app.getHttpServer())
      .delete(`/api/evidence/${evidence.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(204);

    expect(evidenceItems).toHaveLength(0);
    expect(timelineEvents.map((event) => event.eventType)).toContain('EVIDENCE_DELETED');
  });

  it('blocks evidence deletion after case evaluation has started', async () => {
    const memberToken = await registerAndGetToken(app, {
      name: 'ResolveX Member',
      email: 'member@resolvex.demo',
      role: UserRole.CARD_MEMBER,
    });
    const evidence = await uploadAndConfirm(memberToken, lockedCaseId, 'delivery-proof.pdf', 'application/pdf');

    await request(app.getHttpServer())
      .delete(`/api/evidence/${evidence.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
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
        findFirst: jest.fn(({ where }: { where: { id?: string; cardMemberId?: string; merchantId?: string } }) =>
          disputeCases.find((item) => {
            if (where.id && item.id !== where.id) {
              return false;
            }

            if (where.cardMemberId && item.cardMemberId !== where.cardMemberId) {
              return false;
            }

            if (where.merchantId && item.merchantId !== where.merchantId) {
              return false;
            }

            return true;
          }) ?? null,
        ),
      },
      evidenceItem: {
        create: jest.fn(({ data }: { data: Prisma.EvidenceItemUncheckedCreateInput }) => {
          const now = new Date();
          const evidence: TestEvidenceItem = {
            id: data.id ?? `40000000-0000-4000-8000-${String(evidenceItems.length + 1).padStart(12, '0')}`,
            caseId: data.caseId,
            submittedByUserId: data.submittedByUserId,
            submittedByRole: data.submittedByRole,
            evidenceType: data.evidenceType,
            fileName: data.fileName,
            mimeType: data.mimeType,
            sizeBytes: data.sizeBytes,
            storageKey: data.storageKey,
            fileHash: data.fileHash ?? null,
            processingStatus: data.processingStatus ?? EvidenceProcessingStatus.UPLOADED,
            extractionConfidence: data.extractionConfidence ?? null,
            createdAt: now,
            updatedAt: now,
          };
          evidenceItems.push(evidence);
          return evidence;
        }),
        update: jest.fn(({ where, data, include }: EvidenceUpdateArgs) => {
          const index = evidenceItems.findIndex((item) => item.id === where.id);
          if (index === -1) {
            throw new Error('Evidence not found');
          }

          evidenceItems[index] = {
            ...evidenceItems[index],
            ...data,
            updatedAt: new Date(),
          };

          return include?.extractedFacts ? withFacts(evidenceItems[index]) : evidenceItems[index];
        }),
        findMany: jest.fn(({ where, include }: EvidenceFindManyArgs) => {
          const results = evidenceItems.filter((item) => item.caseId === where.caseId);
          return include?.extractedFacts ? results.map(withFacts) : results;
        }),
        findFirst: jest.fn(({ where, include }: EvidenceFindFirstArgs) => {
          const evidence =
            evidenceItems.find((item) => {
              if (where.id && item.id !== where.id) {
                return false;
              }

              if (where.caseId && item.caseId !== where.caseId) {
                return false;
              }

              return true;
            }) ?? null;

          if (!evidence) {
            return null;
          }

          return include?.case ? withCase(evidence) : evidence;
        }),
        findUnique: jest.fn(({ where, include }: EvidenceFindUniqueArgs) => {
          const evidence = evidenceItems.find((item) => item.id === where.id) ?? null;
          if (!evidence) {
            return null;
          }

          if (include?.case && include?.extractedFacts) {
            return withFacts(withCase(evidence));
          }

          if (include?.case) {
            return withCase(evidence);
          }

          if (include?.extractedFacts) {
            return withFacts(evidence);
          }

          return evidence;
        }),
        findUniqueOrThrow: jest.fn(({ where, include }: EvidenceFindUniqueArgs) => {
          const evidence = evidenceItems.find((item) => item.id === where.id);
          if (!evidence) {
            throw new Error('Evidence not found');
          }

          return include?.extractedFacts ? withFacts(evidence) : evidence;
        }),
        delete: jest.fn(({ where }: { where: { id: string } }) => {
          const index = evidenceItems.findIndex((item) => item.id === where.id);
          if (index === -1) {
            throw new Error('Evidence not found');
          }

          const [deleted] = evidenceItems.splice(index, 1);
          return deleted;
        }),
      },
      extractedFact: {
        deleteMany: jest.fn(({ where }: { where: { evidenceId: string } }) => {
          extractedFacts = extractedFacts.filter((fact) => fact.evidenceId !== where.evidenceId);
          return { count: 0 };
        }),
        createMany: jest.fn(({ data }: { data: Prisma.ExtractedFactUncheckedCreateInput[] }) => {
          const now = new Date();
          const facts = data.map((fact) => ({
            id: fact.id ?? `60000000-0000-4000-8000-${String(factIdSequence++).padStart(12, '0')}`,
            evidenceId: fact.evidenceId,
            factType: fact.factType,
            factValue: fact.factValue,
            normalizedValue: fact.normalizedValue ?? null,
            confidence: fact.confidence ?? null,
            sourcePage: fact.sourcePage ?? null,
            verifiedByUser: fact.verifiedByUser ?? false,
            correctedByUser: fact.correctedByUser ?? false,
            createdAt: now,
            updatedAt: now,
          }));
          extractedFacts.push(...facts);
          return { count: facts.length };
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
      },
    };
  }

  async function uploadAndConfirm(token: string, targetCaseId: string, fileName: string, mimeType: string) {
    const content = Buffer.from('phase4 content');
    const targetResponse = await request(app.getHttpServer())
      .post(`/api/disputes/${targetCaseId}/evidence/upload-target`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        evidenceType: 'delivery_confirmation',
        fileName,
        mimeType,
        sizeBytes: content.length,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(pathFromUrl(targetResponse.body.uploadUrl))
      .set('Authorization', `Bearer ${token}`)
      .attach('file', content, {
        filename: fileName,
        contentType: mimeType,
      })
      .expect(201);

    const confirmResponse = await request(app.getHttpServer())
      .post(`/api/disputes/${targetCaseId}/evidence/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        evidenceId: targetResponse.body.evidenceId,
      })
      .expect(200);

    return confirmResponse.body;
  }

  function withCase<T extends TestEvidenceItem>(evidence: T) {
    const disputeCase = disputeCases.find((item) => item.id === evidence.caseId);
    if (!disputeCase) {
      throw new Error('Missing dispute case fixture');
    }

    return {
      ...evidence,
      case: disputeCase,
    };
  }

  function withFacts<T extends TestEvidenceItem>(evidence: T) {
    return {
      ...evidence,
      extractedFacts: extractedFacts.filter((fact) => fact.evidenceId === evidence.id),
    };
  }
});

type RegisterUserInput = {
  name: string;
  email: string;
  role: UserRole;
};

type EvidenceFindManyArgs = {
  where: { caseId: string };
  include?: { extractedFacts?: boolean };
};

type EvidenceFindFirstArgs = {
  where: { id?: string; caseId?: string };
  include?: { case?: boolean };
};

type EvidenceFindUniqueArgs = {
  where: { id: string };
  include?: { case?: boolean; extractedFacts?: boolean };
};

type EvidenceUpdateArgs = {
  where: { id: string };
  data: Partial<TestEvidenceItem>;
  include?: { extractedFacts?: boolean };
};

function createDisputeCase(id: string, status: CaseStatus): TestDisputeCase {
  const now = new Date('2026-07-25T00:00:00.000Z');

  return {
    id,
    transactionId: '10000000-0000-4000-8000-000000000101',
    cardMemberId: 'member-user-id',
    merchantId: 'merchant-user-id',
    reasonCode: 'GOODS_NOT_RECEIVED',
    cardMemberStatement: 'The card member disputes this transaction.',
    merchantStatement: null,
    merchantResponseDate: null,
    merchantResponseStatus: 'PENDING',
    status,
    responseDeadline: new Date('2026-08-01T00:00:00.000Z'),
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };
}

function idForRoleAndEmail(role: UserRole, email: string, sequence: number): string {
  if (role === UserRole.CARD_MEMBER && email === 'member@resolvex.demo') {
    return 'member-user-id';
  }

  if (role === UserRole.CARD_MEMBER) {
    return 'other-member-user-id';
  }

  if (role === UserRole.MERCHANT && email === 'merchant@resolvex.demo') {
    return 'merchant-user-id';
  }

  if (role === UserRole.MERCHANT) {
    return 'other-merchant-user-id';
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

function pathFromUrl(url: string): string {
  return new URL(url).pathname + new URL(url).search;
}
