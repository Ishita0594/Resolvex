import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvidenceProcessingStatus, Role } from '@prisma/client';
import { validateEnv } from '../src/config/env.validation';
import { CaseStatusService } from '../src/disputes/case-status.service';
import { CaseStatus } from '../src/disputes/case-status.enum';
import { UserRole } from '../src/users/user-role.enum';
import {
  buildDefaultRateLimitRules,
  createRateLimitMiddleware,
} from '../src/common/security/rate-limit.middleware';
import { requestIdMiddleware } from '../src/common/security/request-id.middleware';
import { secureHeadersMiddleware } from '../src/common/security/secure-headers.middleware';
import { maskSensitiveValue } from '../src/common/security/sensitive-data';
import { HealthService } from '../src/health/health.service';
import { AiProcessingService } from '../src/evidence/ai-processing.service';

describe('Phase 8 backend hardening', () => {
  it('adds request IDs and secure headers', () => {
    const request = mockRequest('/api/health', {
      'x-request-id': 'req-safe-123',
    });
    const response = mockResponse();
    const next = jest.fn();

    requestIdMiddleware(request as never, response as never, next);
    secureHeadersMiddleware(request as never, response as never, next);

    expect(request.requestId).toBe('req-safe-123');
    expect(response.headers['x-request-id']).toBe('req-safe-123');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('rate-limits auth and upload endpoints with safe responses', () => {
    const middleware = createRateLimitMiddleware(
      buildDefaultRateLimitRules({
        windowMs: 60_000,
        authMax: 1,
        uploadMax: 1,
      }),
    );
    const firstResponse = mockResponse();
    const secondResponse = mockResponse();

    middleware(
      mockRequest('/api/auth/login') as never,
      firstResponse as never,
      jest.fn(),
    );
    middleware(
      mockRequest('/api/auth/login') as never,
      secondResponse as never,
      jest.fn(),
    );

    expect(firstResponse.statusCode).toBeUndefined();
    expect(secondResponse.statusCode).toBe(429);
    expect(secondResponse.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
    });
  });

  it('validates secret length and hardening configuration', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: 'too-short',
      }),
    ).toThrow('JWT_SECRET must be at least 32 characters');

    const env = validateEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'a'.repeat(40),
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173,https://example.test',
      AI_SERVICE_RETRY_ATTEMPTS: '3',
    });

    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://example.test',
    ]);
    expect(env.AI_SERVICE_RETRY_ATTEMPTS).toBe(3);
  });

  it('masks sensitive fields recursively before logging', () => {
    expect(
      maskSensitiveValue({
        email: 'member@example.test',
        password: 'secret',
        nested: {
          accessToken: 'jwt',
          cardNumber: '4111111111111111',
          safe: 'visible',
        },
      }),
    ).toEqual({
      email: 'member@example.test',
      password: '[REDACTED]',
      nested: {
        accessToken: '[REDACTED]',
        cardNumber: '[REDACTED]',
        safe: 'visible',
      },
    });
  });

  it('allows documented status transitions and rejects prohibited transitions', () => {
    const service = new CaseStatusService();
    const allowedTransitions: Array<[CaseStatus, CaseStatus, UserRole]> = [
      [CaseStatus.DRAFT, CaseStatus.SUBMITTED, UserRole.CARD_MEMBER],
      [CaseStatus.SUBMITTED, CaseStatus.AWAITING_MERCHANT, UserRole.ANALYST],
      [
        CaseStatus.AWAITING_MERCHANT,
        CaseStatus.EVIDENCE_PROCESSING,
        UserRole.MERCHANT,
      ],
      [
        CaseStatus.EVIDENCE_PROCESSING,
        CaseStatus.UNDER_EVALUATION,
        UserRole.ANALYST,
      ],
      [CaseStatus.UNDER_EVALUATION, CaseStatus.RESOLVED, UserRole.ANALYST],
      [CaseStatus.UNDER_EVALUATION, CaseStatus.HUMAN_REVIEW, UserRole.ANALYST],
      [
        CaseStatus.UNDER_EVALUATION,
        CaseStatus.AWAITING_MERCHANT,
        UserRole.ANALYST,
      ],
      [CaseStatus.HUMAN_REVIEW, CaseStatus.AWAITING_MERCHANT, UserRole.ANALYST],
      [CaseStatus.HUMAN_REVIEW, CaseStatus.RESOLVED, UserRole.ANALYST],
      [CaseStatus.RESOLVED, CaseStatus.APPEALED, UserRole.CARD_MEMBER],
      [CaseStatus.RESOLVED, CaseStatus.APPEALED, UserRole.MERCHANT],
      [CaseStatus.APPEALED, CaseStatus.HUMAN_REVIEW, UserRole.ANALYST],
      [CaseStatus.APPEALED, CaseStatus.CLOSED, UserRole.ANALYST],
      [CaseStatus.RESOLVED, CaseStatus.CLOSED, UserRole.ANALYST],
    ];

    for (const [from, to, role] of allowedTransitions) {
      expect(() =>
        service.assertTransitionAllowed(from, to, role),
      ).not.toThrow();
    }

    expect(() =>
      service.assertTransitionAllowed(
        CaseStatus.DRAFT,
        CaseStatus.RESOLVED,
        UserRole.CARD_MEMBER,
      ),
    ).toThrow('Invalid status transition');
    expect(() =>
      service.assertTransitionAllowed(
        CaseStatus.AWAITING_MERCHANT,
        CaseStatus.RESOLVED,
        UserRole.MERCHANT,
      ),
    ).toThrow('Invalid status transition');
  });

  it('reports degraded health without leaking dependency secrets', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const service = new HealthService(
      {
        $queryRaw: jest.fn(() =>
          Promise.reject(new Error('db password leaked')),
        ),
      } as never,
      configService({
        AI_SERVICE_URL: 'http://ai-service.test',
        AI_SERVICE_TIMEOUT_MS: 100,
        STORAGE_PROVIDER: 'local',
      }),
      {} as never,
    );

    const health = await service.check();

    expect(health.status).toBe('degraded');
    expect(health.checks.postgresql.detail).toBe(
      'PostgreSQL connectivity failed',
    );
    expect(health.checks.aiService.detail).toBe(
      'AI service connectivity failed',
    );
    fetchSpy.mockRestore();
  });

  it('retries transient AI failures and stores processed evidence on recovery', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ error: 'temporary' }, 503))
      .mockResolvedValueOnce(jsonResponse(validAiResponse()));
    const fixture = buildAiFixture(EvidenceProcessingStatus.UPLOADED);

    const result = await fixture.service.processEvidence(
      'evidence-1',
      memberUser(),
    );

    expect(result.processingStatus).toBe(EvidenceProcessingStatus.PROCESSED);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(fixture.evidence.processingStatus).toBe(
      EvidenceProcessingStatus.PROCESSED,
    );
    jest.restoreAllMocks();
  });

  it('marks evidence FAILED when AI remains unavailable', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ error: 'unavailable' }, 503));
    const fixture = buildAiFixture(EvidenceProcessingStatus.UPLOADED);

    await expect(
      fixture.service.processEvidence('evidence-1', memberUser()),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(fixture.evidence.processingStatus).toBe(
      EvidenceProcessingStatus.FAILED,
    );
    expect(fixture.timelineEvents.map((event) => event.eventType)).toContain(
      'EVIDENCE_PROCESSING_FAILED',
    );
    jest.restoreAllMocks();
  });
});

function mockRequest(path: string, headers: Record<string, string> = {}) {
  return {
    path,
    url: path,
    ip: '127.0.0.1',
    requestId: undefined as string | undefined,
    header: (name: string) => headers[name.toLowerCase()],
  };
}

function mockResponse() {
  return {
    headers: {} as Record<string, string>,
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

function configService(values: Record<string, unknown>) {
  return {
    get: jest.fn(
      (key: string, defaultValue?: unknown) => values[key] ?? defaultValue,
    ),
    getOrThrow: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validAiResponse() {
  return {
    extracted_text: 'Refund receipt',
    structured_facts: [
      {
        fact_type: 'REFUND_AMOUNT',
        fact_value: '$249.99',
        normalized_value: '249.99',
        confidence: 0.94,
        source_page: null,
      },
    ],
    document_classification: {
      label: 'processor_record',
      confidence: 0.9,
    },
    warnings: [],
    provider_metadata: { ocr_provider: 'test' },
  };
}

function buildAiFixture(initialStatus: EvidenceProcessingStatus) {
  const timelineEvents: Array<{ eventType: string }> = [];
  const evidence = {
    id: 'evidence-1',
    caseId: 'case-1',
    submittedByUserId: 'member-1',
    submittedByRole: Role.CARD_MEMBER,
    evidenceType: 'processor_record',
    fileName: 'refund.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1200,
    storageKey: 'evidence/case-1/evidence-1/refund.pdf',
    fileHash: null,
    processingStatus: initialStatus,
    extractionConfidence: null as number | null,
    createdAt: new Date('2026-07-25T00:00:00.000Z'),
    updatedAt: new Date('2026-07-25T00:00:00.000Z'),
    case: {
      id: 'case-1',
      cardMemberId: 'member-1',
      merchantId: 'merchant-1',
    },
  };
  const extractedFacts: unknown[] = [];
  const txMock = {
    extractedFact: {
      deleteMany: jest.fn(() => ({ count: 0 })),
      createMany: jest.fn(({ data }: { data: unknown[] }) => {
        extractedFacts.push(
          ...data.map((fact) => ({
            ...(fact as object),
            id: `fact-${extractedFacts.length + 1}`,
            createdAt: new Date('2026-07-25T00:00:00.000Z'),
            updatedAt: new Date('2026-07-25T00:00:00.000Z'),
          })),
        );
        return { count: data.length };
      }),
    },
    evidenceItem: {
      update: jest.fn(
        ({
          data,
          include,
        }: {
          data: Partial<typeof evidence>;
          include?: unknown;
        }) => {
          Object.assign(evidence, data);
          return include ? { ...evidence, extractedFacts } : evidence;
        },
      ),
    },
    timelineEvent: {
      create: jest.fn(({ data }: { data: { eventType: string } }) => {
        timelineEvents.push(data);
        return data;
      }),
    },
  };
  const prisma = {
    evidenceItem: {
      findUnique: jest.fn(() => evidence),
      update: jest.fn(({ data }: { data: Partial<typeof evidence> }) => {
        Object.assign(evidence, data);
        return evidence;
      }),
    },
    extractedFact: {
      findMany: jest.fn(() => []),
    },
    $transaction: jest.fn((callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
    ),
  };
  const service = new AiProcessingService(
    prisma as never,
    configService({
      AI_SERVICE_URL: 'http://ai-service.test',
      AI_SERVICE_TIMEOUT_MS: 100,
      AI_SERVICE_RETRY_ATTEMPTS: 1,
      AI_SERVICE_RETRY_BACKOFF_MS: 0,
    }),
    {
      getObjectBuffer: jest.fn(() => Promise.resolve(Buffer.from('refund'))),
    } as never,
    { emitCaseEvent: jest.fn(() => Promise.resolve([])) } as never,
  );

  return { service, evidence, timelineEvents };
}

function memberUser() {
  return {
    id: 'member-1',
    name: 'ResolveX Member',
    email: 'member@resolvex.demo',
    role: UserRole.CARD_MEMBER,
  };
}
