import {
  DecisionType,
  EvidenceProcessingStatus,
  EvidenceSupportDirection,
  Prisma,
  ReasonCode,
  RecommendedOutcome,
  Role,
} from "@prisma/client";
import { PolicyEvaluationService } from "../src/disputes/policy-evaluation.service";
import { UserRole } from "../src/users/user-role.enum";

type MutablePolicyFixture = ReturnType<typeof buildFixture>;

describe("Phase 6 deterministic policy engine", () => {
  it.each([
    [ReasonCode.GOODS_NOT_RECEIVED, clearGoodsCardMemberCase],
    [ReasonCode.REFUND_NOT_PROCESSED, clearRefundCardMemberCase],
    [ReasonCode.CANCELLED_GOODS_OR_SERVICES, clearCancellationCardMemberCase],
  ])(
    "supports a clear card-member outcome for %s",
    async (reasonCode, buildCase) => {
      const fixture = buildFixture(buildCase());
      const result = await fixture.service.evaluate(
        fixture.disputeCase.id,
        analystUser(),
      );

      expect(result.recommendedOutcome).toBe(
        RecommendedOutcome.CARD_MEMBER_SUPPORTED,
      );
      expect(result.cardMemberScore).toBeGreaterThan(result.merchantScore);
      expect(
        result.explanationData.appliedRuleIdentifiers.length,
      ).toBeGreaterThan(0);
      expect(result.modelMetadata).toMatchObject({
        aiDecisionUsed: false,
        deterministicPolicyEngine: true,
      });
      expect(reasonCode).toBe(fixture.disputeCase.reasonCode);
    },
  );

  it.each([
    [ReasonCode.GOODS_NOT_RECEIVED, clearGoodsMerchantCase],
    [ReasonCode.REFUND_NOT_PROCESSED, clearRefundMerchantCase],
    [ReasonCode.CANCELLED_GOODS_OR_SERVICES, clearCancellationMerchantCase],
  ])(
    "supports a clear merchant outcome for %s",
    async (reasonCode, buildCase) => {
      const fixture = buildFixture(buildCase());
      const result = await fixture.service.evaluate(
        fixture.disputeCase.id,
        analystUser(),
      );

      expect(result.recommendedOutcome).toBe(
        RecommendedOutcome.MERCHANT_SUPPORTED,
      );
      expect(result.merchantScore).toBeGreaterThan(result.cardMemberScore);
      expect(
        result.explanationData.appliedRuleIdentifiers.length,
      ).toBeGreaterThan(0);
      expect(reasonCode).toBe(fixture.disputeCase.reasonCode);
    },
  );

  it.each([
    [ReasonCode.GOODS_NOT_RECEIVED, ambiguousGoodsCase],
    [ReasonCode.REFUND_NOT_PROCESSED, ambiguousRefundCase],
    [ReasonCode.CANCELLED_GOODS_OR_SERVICES, ambiguousCancellationCase],
  ])(
    "routes ambiguous %s evidence to human review",
    async (_reasonCode, buildCase) => {
      const fixture = buildFixture(buildCase());
      const result = await fixture.service.evaluate(
        fixture.disputeCase.id,
        analystUser(),
      );

      expect(result.recommendedOutcome).toBe(
        RecommendedOutcome.HUMAN_REVIEW_REQUIRED,
      );
      expect(result.explanationData.humanReviewReason).toBeTruthy();
    },
  );

  it("scores the same evidence quality standards for both sides", async () => {
    const disputeCase = clearRefundCardMemberCase();
    disputeCase.evidenceItems = [
      evidence("e1", Role.CARD_MEMBER, "refund_promise", [
        fact("REFUND_PROMISED", "true"),
      ]),
      evidence("e2", Role.MERCHANT, "refund_promise", [
        fact("REFUND_PROMISED", "true"),
      ]),
    ];
    const fixture = buildFixture(disputeCase);

    await fixture.service.evaluate(fixture.disputeCase.id, analystUser());

    expect(fixture.evidenceScores).toHaveLength(2);
    expect(fixture.evidenceScores[0].finalScore).toBe(
      fixture.evidenceScores[1].finalScore,
    );
  });

  it("includes mandatory missing evidence in human-review explanations", async () => {
    const fixture = buildFixture({
      ...clearRefundCardMemberCase(),
      evidenceItems: [],
    });

    const result = await fixture.service.evaluate(
      fixture.disputeCase.id,
      analystUser(),
    );

    expect(result.recommendedOutcome).toBe(
      RecommendedOutcome.HUMAN_REVIEW_REQUIRED,
    );
    expect(result.explanationData.missingEvidence).toEqual(
      expect.arrayContaining(["Purchase Record"]),
    );
    expect(result.explanationData.humanReviewReason).toContain(
      "confidence 0 is below threshold 85",
    );
  });

  it("respects the configurable confidence threshold gate", async () => {
    const fixture = buildFixture(clearGoodsMerchantCase(), {
      POLICY_AUTO_CONFIDENCE_THRESHOLD: 97,
    });

    const result = await fixture.service.evaluate(
      fixture.disputeCase.id,
      analystUser(),
    );

    expect(result.recommendedOutcome).toBe(
      RecommendedOutcome.HUMAN_REVIEW_REQUIRED,
    );
    expect(result.explanationData.humanReviewReason).toContain(
      "confidence 96 is below threshold 97",
    );
  });

  it("blocks automation when critical facts are below required confidence", async () => {
    const lowConfidenceCase = clearRefundMerchantCase();
    lowConfidenceCase.evidenceItems[0].extractedFacts = [
      fact("REFUND_COMPLETED", "true", {
        confidence: 0.62,
        verifiedByUser: false,
      }),
    ];
    const fixture = buildFixture(lowConfidenceCase);

    const result = await fixture.service.evaluate(
      fixture.disputeCase.id,
      analystUser(),
    );

    expect(result.recommendedOutcome).toBe(
      RecommendedOutcome.HUMAN_REVIEW_REQUIRED,
    );
    expect(result.explanationData.humanReviewReason).toContain(
      "critical facts need verification",
    );
  });

  it("persists contradiction scores as contradictory and requires review", async () => {
    const fixture = buildFixture(ambiguousRefundCase());

    const result = await fixture.service.evaluate(
      fixture.disputeCase.id,
      analystUser(),
    );

    expect(result.recommendedOutcome).toBe(
      RecommendedOutcome.HUMAN_REVIEW_REQUIRED,
    );
    expect(
      fixture.evidenceScores.map((score) => score.supportDirection),
    ).toContain(EvidenceSupportDirection.CONTRADICTORY);
    expect(result.explanationData.contradictions[0].severity).toBe("HIGH");
  });

  it("is deterministic across repeated evaluations and stores the policy version", async () => {
    const fixture = buildFixture(clearGoodsMerchantCase());

    const first = await fixture.service.evaluate(
      fixture.disputeCase.id,
      analystUser(),
    );
    const second = await fixture.service.evaluate(
      fixture.disputeCase.id,
      analystUser(),
    );

    expect(stableDecision(first)).toEqual(stableDecision(second));
    expect(first.policyVersion).toBe("prototype-v1");
    expect(first.decisionType).toBe(DecisionType.AUTOMATED_RECOMMENDATION);
    expect(fixture.decisionRecords).toHaveLength(2);
  });

  it("returns the latest evaluation, evidence matrix, and structured explanation", async () => {
    const fixture = buildFixture(clearGoodsMerchantCase());
    await fixture.service.evaluate(fixture.disputeCase.id, analystUser());

    const latest = await fixture.service.getLatestEvaluation(
      fixture.disputeCase.id,
      merchantUser(),
    );
    const matrix = await fixture.service.getEvidenceMatrix(
      fixture.disputeCase.id,
      merchantUser(),
    );
    const explanation = await fixture.service.getExplanation(
      fixture.disputeCase.id,
      merchantUser(),
    );

    expect(latest.recommendedOutcome).toBe(
      RecommendedOutcome.MERCHANT_SUPPORTED,
    );
    expect(
      matrix.requirements.some(
        (requirement) => requirement.evidenceScores.length > 0,
      ),
    ).toBe(true);
    expect(explanation.appliedRuleIdentifiers).toContain("PX-GNR-002");
  });
});

function buildFixture(
  disputeCase: TestDisputeCase,
  config: Record<string, number> = {},
) {
  const evidenceScores: TestEvidenceScore[] = [];
  const decisionRecords: TestDecisionRecord[] = [];
  const timelineEvents: unknown[] = [];
  const requirements = requirementsFor(disputeCase.reasonCode);
  const rules = rulesFor(disputeCase.reasonCode);
  const txMock = {
    evidenceScore: {
      deleteMany: jest.fn(() => {
        evidenceScores.splice(0, evidenceScores.length);
        return { count: 0 };
      }),
      createMany: jest.fn(({ data }: { data: TestEvidenceScore[] }) => {
        evidenceScores.push(...data);
        return { count: data.length };
      }),
    },
    decisionRecord: {
      create: jest.fn(
        ({ data }: { data: Omit<TestDecisionRecord, "id" | "createdAt"> }) => {
          const record = {
            id: `decision-${decisionRecords.length + 1}`,
            createdAt: new Date("2026-07-25T00:00:00.000Z"),
            ...data,
          };
          decisionRecords.push(record);
          return record;
        },
      ),
    },
    timelineEvent: {
      create: jest.fn(({ data }: { data: unknown }) => {
        timelineEvents.push(data);
        return data;
      }),
    },
  };
  const prismaMock = {
    disputeCase: {
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: { id: string; cardMemberId?: string; merchantId?: string };
        }) => {
          if (where.id !== disputeCase.id) {
            return null;
          }

          if (
            where.cardMemberId &&
            where.cardMemberId !== disputeCase.cardMemberId
          ) {
            return null;
          }

          if (where.merchantId && where.merchantId !== disputeCase.merchantId) {
            return null;
          }

          return disputeCase;
        },
      ),
    },
    policyRequirement: {
      findMany: jest.fn(() => requirements),
    },
    policyRule: {
      findMany: jest.fn(() => rules),
    },
    evidenceScore: {
      findMany: jest.fn(() =>
        evidenceScores.map((score) => ({
          ...score,
          createdAt: new Date("2026-07-25T00:00:00.000Z"),
          evidence: disputeCase.evidenceItems.find(
            (item) => item.id === score.evidenceId,
          ),
        })),
      ),
    },
    decisionRecord: {
      findFirst: jest.fn(
        () => decisionRecords[decisionRecords.length - 1] ?? null,
      ),
    },
    $transaction: jest.fn((callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
    ),
  };
  const configMock = {
    get: jest.fn(
      (key: string, defaultValue: number) => config[key] ?? defaultValue,
    ),
  };

  return {
    disputeCase,
    evidenceScores,
    decisionRecords,
    timelineEvents,
    service: new PolicyEvaluationService(
      prismaMock as never,
      configMock as never,
    ),
  };
}

function clearGoodsCardMemberCase(): TestDisputeCase {
  return baseCase(ReasonCode.GOODS_NOT_RECEIVED, [
    evidence("cm-gnr-1", Role.CARD_MEMBER, "non_delivery_statement", [
      fact("NON_DELIVERY_STATEMENT", "true"),
    ]),
    evidence("m-gnr-1", Role.MERCHANT, "dispatch_record", [
      fact("DISPATCHED", "true"),
    ]),
  ]);
}

function clearGoodsMerchantCase(): TestDisputeCase {
  return baseCase(ReasonCode.GOODS_NOT_RECEIVED, [
    evidence("m-gnr-2", Role.MERCHANT, "delivery_confirmation", [
      fact("DELIVERY_CONFIRMED", "true"),
      fact("DELIVERY_LOCATION_MATCH", "true"),
    ]),
  ]);
}

function ambiguousGoodsCase(): TestDisputeCase {
  return baseCase(ReasonCode.GOODS_NOT_RECEIVED, [
    evidence("m-gnr-3", Role.MERCHANT, "delivery_confirmation", [
      fact("DELIVERY_CONFIRMED", "true"),
      fact("DELIVERY_LOCATION", "front porch"),
    ]),
    evidence("cm-gnr-3", Role.CARD_MEMBER, "location_dispute", [
      fact("DELIVERY_LOCATION", "mail room"),
    ]),
  ]);
}

function clearRefundCardMemberCase(): TestDisputeCase {
  return baseCase(ReasonCode.REFUND_NOT_PROCESSED, [
    evidence("cm-ref-1", Role.CARD_MEMBER, "refund_promise", [
      fact("REFUND_PROMISED", "true"),
    ]),
  ]);
}

function clearRefundMerchantCase(): TestDisputeCase {
  return baseCase(ReasonCode.REFUND_NOT_PROCESSED, [
    evidence("m-ref-1", Role.MERCHANT, "completed_refund_transaction", [
      fact("REFUND_COMPLETED", "true"),
      fact("REFUND_AMOUNT", "249.99"),
      fact("REFUND_REFERENCE", "RF-100"),
    ]),
  ]);
}

function ambiguousRefundCase(): TestDisputeCase {
  return baseCase(ReasonCode.REFUND_NOT_PROCESSED, [
    evidence("m-ref-2", Role.MERCHANT, "completed_refund_transaction", [
      fact("REFUND_COMPLETED", "true"),
      fact("REFUND_AMOUNT", "249.99"),
    ]),
    evidence("cm-ref-2", Role.CARD_MEMBER, "refund_amount_dispute", [
      fact("REFUND_AMOUNT", "199.99"),
    ]),
  ]);
}

function clearCancellationCardMemberCase(): TestDisputeCase {
  return baseCase(ReasonCode.CANCELLED_GOODS_OR_SERVICES, [
    evidence("cm-can-1", Role.CARD_MEMBER, "cancellation_proof", [
      fact("CANCELLATION_TIMELY", "true"),
      fact("CANCELLATION_VALID", "true"),
      fact("SERVICE_DELIVERED", "false"),
      fact("REFUND_PROVIDED", "false"),
      fact("POLICY_ACCEPTED", "false"),
    ]),
  ]);
}

function clearCancellationMerchantCase(): TestDisputeCase {
  return baseCase(ReasonCode.CANCELLED_GOODS_OR_SERVICES, [
    evidence("m-can-1", Role.MERCHANT, "terms_acceptance", [
      fact("CANCELLATION_TIMELY", "false"),
      fact("POLICY_ACCEPTED", "true"),
    ]),
  ]);
}

function ambiguousCancellationCase(): TestDisputeCase {
  return baseCase(ReasonCode.CANCELLED_GOODS_OR_SERVICES, [
    evidence("cm-can-2", Role.CARD_MEMBER, "cancellation_proof", [
      fact("CANCELLATION_VALID", "true"),
    ]),
  ]);
}

function baseCase(
  reasonCode: ReasonCode,
  evidenceItems: TestEvidenceItem[],
): TestDisputeCase {
  return {
    id: "case-1",
    cardMemberId: "card-member-1",
    merchantId: "merchant-1",
    reasonCode,
    cardMemberStatement: "Card member statement",
    merchantStatement: "Merchant statement",
    createdAt: new Date("2026-07-20T00:00:00.000Z"),
    transaction: {
      amount: new Prisma.Decimal("249.99"),
      currency: "USD",
      transactionDate: new Date("2026-07-01T00:00:00.000Z"),
      merchantName: "Northstar Electronics",
    },
    evidenceItems,
  };
}

function evidence(
  id: string,
  submittedByRole: Role,
  evidenceType: string,
  extractedFacts: TestExtractedFact[],
): TestEvidenceItem {
  return {
    id,
    caseId: "case-1",
    submittedByUserId:
      submittedByRole === Role.MERCHANT ? "merchant-1" : "card-member-1",
    submittedByRole,
    evidenceType,
    fileName: `${id}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 100,
    storageKey: `evidence/case-1/${id}.pdf`,
    fileHash: "a".repeat(64),
    processingStatus: EvidenceProcessingStatus.PROCESSED,
    extractionConfidence: 0.95,
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    extractedFacts,
  };
}

function fact(
  factType: string,
  factValue: string,
  options: { confidence?: number; verifiedByUser?: boolean } = {},
): TestExtractedFact {
  return {
    id: `${factType}-${factValue}`,
    evidenceId: "",
    factType,
    factValue,
    normalizedValue: factValue,
    confidence: options.confidence ?? 0.95,
    sourcePage: null,
    verifiedByUser: options.verifiedByUser ?? true,
    correctedByUser: false,
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
  };
}

function requirementsFor(reasonCode: ReasonCode): TestRequirement[] {
  const base = (
    requirementKey: string,
    acceptedEvidenceTypes: string[],
    isMandatory = true,
  ) => ({
    id: `${reasonCode}-${requirementKey}`,
    reasonCode,
    requirementKey,
    requirementName: requirementKey
      .split("_")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" "),
    description: `Prototype assumption for ${requirementKey}.`,
    acceptedEvidenceTypes,
    weight: 20,
    isMandatory,
    policyVersion: "prototype-v1",
    active: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  });

  if (reasonCode === ReasonCode.GOODS_NOT_RECEIVED) {
    return [
      base("dispatch_record", ["dispatch_record"]),
      base("delivery_confirmation", [
        "delivery_confirmation",
        "non_delivery_statement",
      ]),
      base("verified_delivery_location", ["location_dispute"], false),
    ];
  }

  if (reasonCode === ReasonCode.REFUND_NOT_PROCESSED) {
    return [
      base("purchase_record", ["purchase_record"]),
      base("refund_initiation_record", ["refund_promise"]),
      base(
        "completed_refund_transaction",
        ["completed_refund_transaction"],
        false,
      ),
      base("refund_amount", ["refund_amount_dispute"], false),
    ];
  }

  return [
    base("cancellation_request", ["cancellation_proof"]),
    base("accepted_cancellation_policy", ["terms_acceptance"]),
  ];
}

function rulesFor(reasonCode: ReasonCode): TestRule[] {
  const idsByReason = {
    [ReasonCode.GOODS_NOT_RECEIVED]: [
      "PX-GNR-001",
      "PX-GNR-002",
      "PX-GNR-003",
      "PX-GNR-004",
    ],
    [ReasonCode.REFUND_NOT_PROCESSED]: [
      "PX-REF-001",
      "PX-REF-002",
      "PX-REF-003",
    ],
    [ReasonCode.CANCELLED_GOODS_OR_SERVICES]: [
      "PX-CAN-001",
      "PX-CAN-002",
      "PX-CAN-003",
    ],
  };

  return idsByReason[reasonCode].map((ruleId) => ({
    id: ruleId,
    ruleId,
    reasonCode,
    title: ruleId,
    description: `Prototype assumption ${ruleId}.`,
    prototypeAssumption: true,
    severity: "HIGH",
    policyVersion: "prototype-v1",
    active: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  }));
}

function analystUser() {
  return {
    id: "analyst-1",
    name: "Analyst",
    role: UserRole.ANALYST,
    email: "analyst@test.local",
  };
}

function merchantUser() {
  return {
    id: "merchant-1",
    name: "Merchant",
    role: UserRole.MERCHANT,
    email: "merchant@test.local",
  };
}

function stableDecision(
  response: Awaited<ReturnType<MutablePolicyFixture["service"]["evaluate"]>>,
) {
  return {
    recommendedOutcome: response.recommendedOutcome,
    cardMemberScore: response.cardMemberScore,
    merchantScore: response.merchantScore,
    confidence: response.confidence,
    decisionMargin: response.decisionMargin,
    policyVersion: response.policyVersion,
    explanationData: response.explanationData,
  };
}

type TestDisputeCase = {
  id: string;
  cardMemberId: string;
  merchantId: string;
  reasonCode: ReasonCode;
  cardMemberStatement: string;
  merchantStatement: string | null;
  createdAt: Date;
  transaction: {
    amount: Prisma.Decimal;
    currency: string;
    transactionDate: Date;
    merchantName: string;
  };
  evidenceItems: TestEvidenceItem[];
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
  extractedFacts: TestExtractedFact[];
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

type TestEvidenceScore = {
  caseId: string;
  evidenceId: string;
  requirementId: string;
  sourceReliability: number;
  directness: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  finalScore: number;
  supportDirection: EvidenceSupportDirection;
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

type TestRequirement = {
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

type TestRule = {
  id: string;
  ruleId: string;
  reasonCode: ReasonCode;
  title: string;
  description: string;
  prototypeAssumption: boolean;
  severity: string;
  policyVersion: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
