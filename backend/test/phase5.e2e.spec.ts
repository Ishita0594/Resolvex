import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CaseStatus, EvidenceProcessingStatus, Prisma, Role } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { STORAGE_PROVIDER } from '../src/evidence/storage/storage.constants';
import { StorageProvider } from '../src/evidence/storage/storage-provider.interface';
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
  cardMemberId: string;
  merchantId: string;
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

describe('Phase 5 AI evidence processing integration', () => {
  let app: INestApplication;
  let users: TestUser[];
  let evidenceItems: TestEvidenceItem[];
  let extractedFacts: TestExtractedFact[];
  let timelineEvents: TestTimelineEvent[];
  let userIdSequence: number;
  let factIdSequence: number;
  let timelineIdSequence: number;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const caseId = '20000000-0000-4000-8000-000000000501';
  const evidenceId = '40000000-0000-4000-8000-000000000501';
  const disputeCase: TestDisputeCase = {
    id: caseId,
    cardMemberId: 'member-user-id',
    merchantId: 'merchant-user-id',
  };

  beforeEach(async () => {
    process.env.AI_SERVICE_URL = 'http://ai-service.test';
    users = [];
    extractedFacts = [];
    timelineEvents = [];
    userIdSequence = 1;
    factIdSequence = 1;
    timelineIdSequence = 1;
    evidenceItems = [createEvidence(EvidenceProcessingStatus.UPLOADED)];

    const txMock = buildPrismaMock();
    const prismaMock = {
      ...txMock,
      $transaction: jest.fn((callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
    };
    const storageProvider: Pick<StorageProvider, 'getObjectBuffer'> = {
      getObjectBuffer: jest.fn(() => Promise.resolve(Buffer.from('Invoice text'))),
    };

    fetchSpy = jest.spyOn(global, 'fetch');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(STORAGE_PROVIDER)
      .useValue(storageProvider)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    fetchSpy.mockRestore();

    if (app) {
      await app.close();
    }
  });

  it('processes evidence, stores AI facts, confidence, and a timeline event', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(validAiResponse()));
    const memberToken = await registerAndGetToken(app, memberUser());

    const response = await request(app.getHttpServer())
      .post(`/api/evidence/${evidenceId}/process`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);

    expect(response.body.processingStatus).toBe(EvidenceProcessingStatus.PROCESSED);
    expect(response.body.extractionConfidence).toBe(0.89);
    expect(response.body.facts).toHaveLength(2);
    expect(extractedFacts.map((fact) => fact.factType)).toEqual(['ORDER_ID', 'TRANSACTION_AMOUNT']);
    expect(timelineEvents.map((event) => event.eventType)).toContain('EVIDENCE_PROCESSED');
  });

  it('marks evidence FAILED when AI processing fails', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'unavailable' }, 503));
    const memberToken = await registerAndGetToken(app, memberUser());

    await request(app.getHttpServer())
      .post(`/api/evidence/${evidenceId}/process`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(502);

    expect(evidenceItems[0].processingStatus).toBe(EvidenceProcessingStatus.FAILED);
    expect(timelineEvents.map((event) => event.eventType)).toContain('EVIDENCE_PROCESSING_FAILED');
  });

  it('retries failed processing and marks evidence PROCESSED', async () => {
    evidenceItems[0].processingStatus = EvidenceProcessingStatus.FAILED;
    fetchSpy.mockResolvedValueOnce(jsonResponse(validAiResponse()));
    const memberToken = await registerAndGetToken(app, memberUser());

    const response = await request(app.getHttpServer())
      .post(`/api/evidence/${evidenceId}/retry`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);

    expect(response.body.processingStatus).toBe(EvidenceProcessingStatus.PROCESSED);
    expect(timelineEvents.map((event) => event.eventType)).toContain('EVIDENCE_PROCESSING_RETRIED');
  });

  it('rejects invalid AI responses and stores FAILED status', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        ...validAiResponse(),
        structured_facts: [{ fact_type: 'WINNER', fact_value: 'merchant', confidence: 0.99 }],
      }),
    );
    const memberToken = await registerAndGetToken(app, memberUser());

    await request(app.getHttpServer())
      .post(`/api/evidence/${evidenceId}/process`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(502);

    expect(evidenceItems[0].processingStatus).toBe(EvidenceProcessingStatus.FAILED);
    expect(extractedFacts).toHaveLength(0);
  });

  it('preserves user corrections while replacing unverified AI facts', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(validAiResponse()));
    const memberToken = await registerAndGetToken(app, memberUser());

    await request(app.getHttpServer())
      .patch(`/api/evidence/${evidenceId}/facts`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        facts: [
          {
            factType: 'ORDER_ID',
            factValue: 'ORD-CORRECTED',
            normalizedValue: 'ORD-CORRECTED',
            confidence: 1,
            verifiedByUser: true,
            correctedByUser: true,
          },
        ],
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/evidence/${evidenceId}/process`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(201);

    const factsResponse = await request(app.getHttpServer())
      .get(`/api/evidence/${evidenceId}/facts`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(factsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factValue: 'ORD-CORRECTED',
          verifiedByUser: true,
          correctedByUser: true,
        }),
        expect.objectContaining({
          factType: 'TRANSACTION_AMOUNT',
          normalizedValue: '249.99',
        }),
      ]),
    );
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
      evidenceItem: {
        findUnique: jest.fn(({ where, include }: EvidenceFindUniqueArgs) => {
          const evidence = evidenceItems.find((item) => item.id === where.id) ?? null;
          if (!evidence) {
            return null;
          }

          return include?.case ? withCase(evidence) : evidence;
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
        findUniqueOrThrow: jest.fn(({ where, include }: EvidenceFindUniqueArgs) => {
          const evidence = evidenceItems.find((item) => item.id === where.id);
          if (!evidence) {
            throw new Error('Evidence not found');
          }

          return include?.extractedFacts ? withFacts(evidence) : evidence;
        }),
      },
      extractedFact: {
        findMany: jest.fn(({ where }: { where: { evidenceId: string } }) =>
          extractedFacts.filter((fact) => fact.evidenceId === where.evidenceId),
        ),
        deleteMany: jest.fn(({ where }: ExtractedFactDeleteManyArgs) => {
          extractedFacts = extractedFacts.filter((fact) => {
            if (fact.evidenceId !== where.evidenceId) {
              return true;
            }

            if (where.verifiedByUser !== undefined && fact.verifiedByUser !== where.verifiedByUser) {
              return true;
            }

            if (where.correctedByUser !== undefined && fact.correctedByUser !== where.correctedByUser) {
              return true;
            }

            return false;
          });
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
            id: `30000000-0000-4000-8000-${String(timelineIdSequence++).padStart(12, '0')}`,
            createdAt: new Date(),
            ...data,
          };
          timelineEvents.push(event);
          return event;
        }),
      },
    };
  }

  function withCase(evidence: TestEvidenceItem) {
    return {
      ...evidence,
      case: {
        ...disputeCase,
        status: CaseStatus.EVIDENCE_PROCESSING,
      },
    };
  }

  function withFacts(evidence: TestEvidenceItem) {
    return {
      ...evidence,
      extractedFacts: extractedFacts.filter((fact) => fact.evidenceId === evidence.id),
    };
  }
});

type EvidenceFindUniqueArgs = {
  where: { id: string };
  include?: { case?: boolean; extractedFacts?: boolean };
};

type EvidenceUpdateArgs = {
  where: { id: string };
  data: Partial<TestEvidenceItem>;
  include?: { extractedFacts?: boolean };
};

type ExtractedFactDeleteManyArgs = {
  where: {
    evidenceId: string;
    verifiedByUser?: boolean;
    correctedByUser?: boolean;
  };
};

function createEvidence(processingStatus: EvidenceProcessingStatus): TestEvidenceItem {
  const now = new Date('2026-07-25T00:00:00.000Z');

  return {
    id: '40000000-0000-4000-8000-000000000501',
    caseId: '20000000-0000-4000-8000-000000000501',
    submittedByUserId: 'member-user-id',
    submittedByRole: Role.CARD_MEMBER,
    evidenceType: 'invoice',
    fileName: 'invoice.txt',
    mimeType: 'text/plain',
    sizeBytes: 12,
    storageKey: 'evidence/case/invoice.txt',
    fileHash: null,
    processingStatus,
    extractionConfidence: null,
    createdAt: now,
    updatedAt: now,
  };
}

function validAiResponse() {
  return {
    extracted_text: 'Invoice text',
    structured_facts: [
      {
        fact_type: 'ORDER_ID',
        fact_value: 'ORD-10045',
        normalized_value: 'ORD-10045',
        confidence: 0.9,
        source_page: null,
      },
      {
        fact_type: 'TRANSACTION_AMOUNT',
        fact_value: '$249.99',
        normalized_value: '249.99',
        confidence: 0.88,
        source_page: null,
      },
    ],
    document_classification: {
      label: 'invoice',
      confidence: 0.87,
      method: 'deterministic-keywords',
    },
    warnings: [],
    provider_metadata: {
      ocr_provider: 'text-input',
      nlp_processor: 'regex-spacy-hf-fallback',
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function memberUser() {
  return {
    name: 'ResolveX Member',
    email: 'member@resolvex.demo',
    role: UserRole.CARD_MEMBER,
  };
}

function idForRoleAndEmail(role: UserRole, email: string, sequence: number): string {
  if (role === UserRole.CARD_MEMBER && email === 'member@resolvex.demo') {
    return 'member-user-id';
  }

  if (role === UserRole.MERCHANT) {
    return 'merchant-user-id';
  }

  return `user-${sequence}`;
}

async function registerAndGetToken(app: INestApplication, input: ReturnType<typeof memberUser>): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({
      ...input,
      password: 'CorrectPassword123!',
    })
    .expect(201);

  return response.body.accessToken as string;
}
