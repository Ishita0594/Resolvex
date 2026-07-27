import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DecisionType,
  EvidenceItem,
  EvidenceProcessingStatus,
  EvidenceSupportDirection,
  ExtractedFact,
  PolicyRequirement,
  PolicyRule,
  Prisma,
  ReasonCode,
  RecommendedOutcome,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../users/public-user.type';
import { UserRole } from '../users/user-role.enum';
import { CaseEventsGateway } from '../events/case-events.gateway';

const POLICY_VERSION = 'prototype-v1';
const QUALITY_WEIGHTS = {
  sourceReliability: 0.25,
  directness: 0.25,
  completeness: 0.2,
  consistency: 0.2,
  timeliness: 0.1,
};

type EvidenceWithFacts = EvidenceItem & { extractedFacts: ExtractedFact[] };

type CaseForEvaluation = {
  id: string;
  cardMemberId: string;
  merchantId: string;
  reasonCode: ReasonCode;
  status: string;
  cardMemberStatement: string;
  merchantStatement: string | null;
  createdAt: Date;
  transaction: {
    amount: Prisma.Decimal;
    currency: string;
    transactionDate: Date;
    merchantName: string;
  };
  evidenceItems: EvidenceWithFacts[];
};

type EvidenceQualityScore = {
  sourceReliability: number;
  directness: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  finalScore: number;
};

type EvidenceScoreDraft = EvidenceQualityScore & {
  caseId: string;
  evidenceId: string;
  requirementId: string;
  supportDirection: EvidenceSupportDirection;
};

type FactView = {
  evidenceId: string;
  submittedByRole: Role;
  factType: string;
  value: string;
  confidence: number | null;
  verifiedByUser: boolean;
};

type Contradiction = {
  factType: string;
  severity: 'LOW' | 'HIGH';
  values: string[];
  evidenceIds: string[];
  description: string;
};

type RuleResult = {
  ruleId: string;
  applied: boolean;
  effect:
    | 'SUPPORTS_CARD_MEMBER'
    | 'SUPPORTS_MERCHANT'
    | 'REQUIRES_REVIEW'
    | 'LIMITS_MERCHANT_SUPPORT';
  scoreImpact: number;
  evidenceIds: string[];
  criticalFactTypes: string[];
  explanation: string;
};

export type EvidenceMatrixResponse = {
  caseId: string;
  policyVersion: string;
  disputeCategory: ReasonCode;
  requirements: Array<{
    requirementId: string;
    requirementKey: string;
    requirementName: string;
    isMandatory: boolean;
    evaluated: boolean;
    evidenceScores: Array<
      EvidenceScoreDraft & { evidenceType: string; submittedByRole: Role }
    >;
  }>;
};

export type ExplanationResponse = {
  disputeCategory: ReasonCode;
  whatNeededToBeProven: string[];
  evidenceSubmittedByEachParty: {
    cardMember: Array<{
      evidenceId: string;
      evidenceType: string;
      finalScore?: number;
    }>;
    merchant: Array<{
      evidenceId: string;
      evidenceType: string;
      finalScore?: number;
    }>;
  };
  verifiedFacts: Array<{ factType: string; value: string; evidenceId: string }>;
  missingEvidence: string[];
  contradictions: Contradiction[];
  appliedRuleIdentifiers: string[];
  recommendedOutcome: RecommendedOutcome;
  confidence: number;
  humanReviewReason: string | null;
};

export type EvaluationResponse = {
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
  explanationData: ExplanationResponse;
  createdAt: string;
};

@Injectable()
export class PolicyEvaluationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() private readonly caseEventsGateway?: CaseEventsGateway,
  ) {}

  async evaluate(
    caseId: string,
    user: PublicUser,
  ): Promise<EvaluationResponse> {
    if (user.role !== UserRole.ANALYST) {
      throw new ForbiddenException('Only analysts can run policy evaluation');
    }

    const evaluationCase = await this.findVisibleCase(caseId, user);
    const requirements = await this.findRequirements(evaluationCase.reasonCode);
    const rules = await this.findRules(evaluationCase.reasonCode);
    const facts = this.extractFacts(evaluationCase.evidenceItems);
    const contradictions = this.findContradictions(facts);
    const evidenceScores = this.scoreEvidence(
      evaluationCase,
      requirements,
      contradictions,
    );
    const ruleResults = this.applyRules(
      evaluationCase.reasonCode,
      facts,
      contradictions,
    );
    const evaluation = this.buildEvaluation(
      evaluationCase,
      requirements,
      rules,
      evidenceScores,
      ruleResults,
      facts,
      contradictions,
    );

    const decisionRecord = await this.prisma.$transaction(async (tx) => {
      await tx.evidenceScore.deleteMany({
        where: { caseId: evaluationCase.id },
      });

      if (evidenceScores.length > 0) {
        await tx.evidenceScore.createMany({
          data: evidenceScores.map((score) => ({
            caseId: score.caseId,
            evidenceId: score.evidenceId,
            requirementId: score.requirementId,
            sourceReliability: score.sourceReliability,
            directness: score.directness,
            completeness: score.completeness,
            consistency: score.consistency,
            timeliness: score.timeliness,
            finalScore: score.finalScore,
            supportDirection: score.supportDirection,
          })),
        });
      }

      const createdDecision = await tx.decisionRecord.create({
        data: {
          caseId: evaluationCase.id,
          recommendedOutcome: evaluation.recommendedOutcome,
          cardMemberScore: evaluation.cardMemberScore,
          merchantScore: evaluation.merchantScore,
          confidence: evaluation.confidence,
          decisionMargin: evaluation.decisionMargin,
          decisionType: DecisionType.AUTOMATED_RECOMMENDATION,
          policyVersion: POLICY_VERSION,
          modelMetadata: evaluation.modelMetadata,
          explanationData: evaluation.explanationData,
        },
      });

      await tx.timelineEvent.create({
        data: {
          caseId: evaluationCase.id,
          eventType: 'POLICY_EVALUATION_COMPLETED',
          description: 'Deterministic prototype policy evaluation completed.',
          performedBy: user.id,
          metadata: {
            decisionRecordId: createdDecision.id,
            recommendedOutcome: evaluation.recommendedOutcome,
            policyVersion: POLICY_VERSION,
            appliedRuleIdentifiers:
              evaluation.explanationData.appliedRuleIdentifiers,
          },
        },
      });

      return createdDecision;
    });

    await this.caseEventsGateway?.emitCaseEvent(
      evaluationCase.id,
      'decision.generated',
      {
        caseId: evaluationCase.id,
        newStatus: evaluationCase.status,
        title: 'Decision generated',
        metadata: {
          recommendedOutcome: evaluation.recommendedOutcome,
          confidence: evaluation.confidence,
          decisionMargin: evaluation.decisionMargin,
        },
      },
    );

    if (
      evaluation.recommendedOutcome === RecommendedOutcome.HUMAN_REVIEW_REQUIRED
    ) {
      await this.caseEventsGateway?.emitCaseEvent(
        evaluationCase.id,
        'analyst.review.required',
        {
          caseId: evaluationCase.id,
          newStatus: evaluationCase.status,
          title: 'Analyst review required',
          metadata: {
            confidence: evaluation.confidence,
            decisionMargin: evaluation.decisionMargin,
          },
        },
      );
    }

    return serializeDecisionRecord(decisionRecord);
  }

  async getLatestEvaluation(
    caseId: string,
    user: PublicUser,
  ): Promise<EvaluationResponse> {
    await this.findVisibleCase(caseId, user);
    const decisionRecord = await this.prisma.decisionRecord.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });

    if (!decisionRecord) {
      throw new NotFoundException('Evaluation not found');
    }

    return serializeDecisionRecord(decisionRecord);
  }

  async getEvidenceMatrix(
    caseId: string,
    user: PublicUser,
  ): Promise<EvidenceMatrixResponse> {
    const evaluationCase = await this.findVisibleCase(caseId, user);
    const requirements = await this.findRequirements(evaluationCase.reasonCode);
    const persistedScores = await this.prisma.evidenceScore.findMany({
      where: { caseId },
      include: { evidence: true },
      orderBy: { createdAt: 'asc' },
    });

    const scoresByRequirement = new Map<
      string,
      Array<
        EvidenceScoreDraft & { evidenceType: string; submittedByRole: Role }
      >
    >();
    for (const score of persistedScores) {
      const group = scoresByRequirement.get(score.requirementId) ?? [];
      group.push({
        caseId: score.caseId,
        evidenceId: score.evidenceId,
        requirementId: score.requirementId,
        sourceReliability: score.sourceReliability,
        directness: score.directness,
        completeness: score.completeness,
        consistency: score.consistency,
        timeliness: score.timeliness,
        finalScore: score.finalScore,
        supportDirection: score.supportDirection,
        evidenceType: score.evidence.evidenceType,
        submittedByRole: score.evidence.submittedByRole,
      });
      scoresByRequirement.set(score.requirementId, group);
    }

    return {
      caseId,
      policyVersion: POLICY_VERSION,
      disputeCategory: evaluationCase.reasonCode,
      requirements: requirements.map((requirement) => ({
        requirementId: requirement.id,
        requirementKey: requirement.requirementKey,
        requirementName: requirement.requirementName,
        isMandatory: requirement.isMandatory,
        evaluated: true,
        evidenceScores: scoresByRequirement.get(requirement.id) ?? [],
      })),
    };
  }

  async getExplanation(
    caseId: string,
    user: PublicUser,
  ): Promise<ExplanationResponse> {
    return (await this.getLatestEvaluation(caseId, user)).explanationData;
  }

  private async findVisibleCase(
    caseId: string,
    user: PublicUser,
  ): Promise<CaseForEvaluation> {
    const where: Prisma.DisputeCaseWhereInput = { id: caseId };

    if (user.role === UserRole.CARD_MEMBER) {
      where.cardMemberId = user.id;
    } else if (user.role === UserRole.MERCHANT) {
      where.merchantId = user.id;
    } else if (user.role !== UserRole.ANALYST) {
      throw new ForbiddenException('Unsupported user role');
    }

    const disputeCase = await this.prisma.disputeCase.findFirst({
      where,
      include: {
        transaction: true,
        evidenceItems: {
          include: { extractedFacts: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    return disputeCase;
  }

  private async findRequirements(
    reasonCode: ReasonCode,
  ): Promise<PolicyRequirement[]> {
    return this.prisma.policyRequirement.findMany({
      where: { reasonCode, active: true, policyVersion: POLICY_VERSION },
      orderBy: [{ isMandatory: 'desc' }, { requirementKey: 'asc' }],
    });
  }

  private async findRules(reasonCode: ReasonCode): Promise<PolicyRule[]> {
    return this.prisma.policyRule.findMany({
      where: { reasonCode, active: true, policyVersion: POLICY_VERSION },
      orderBy: { ruleId: 'asc' },
    });
  }

  private extractFacts(evidenceItems: EvidenceWithFacts[]): FactView[] {
    return evidenceItems.flatMap((evidence) =>
      evidence.extractedFacts.map((fact) => ({
        evidenceId: evidence.id,
        submittedByRole: evidence.submittedByRole,
        factType: fact.factType,
        value: normalizedFactValue(fact),
        confidence: normalizeConfidence(fact.confidence),
        verifiedByUser: fact.verifiedByUser,
      })),
    );
  }

  private findContradictions(facts: FactView[]): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const declared = facts.filter(
      (fact) => fact.factType === 'HIGH_SEVERITY_CONTRADICTION',
    );

    for (const fact of declared) {
      contradictions.push({
        factType: fact.factType,
        severity: 'HIGH',
        values: [fact.value],
        evidenceIds: [fact.evidenceId],
        description: fact.value,
      });
    }

    for (const factType of [
      'DELIVERY_LOCATION',
      'RECIPIENT_NAME',
      'REFUND_AMOUNT',
      'REFUND_DATE',
      'REFUND_REFERENCE',
      'CANCELLATION_DATE',
      'POLICY_ACCEPTED',
    ]) {
      const group = facts.filter((fact) => fact.factType === factType);
      const distinctValues = Array.from(
        new Set(group.map((fact) => fact.value)),
      ).filter(Boolean);
      if (distinctValues.length > 1) {
        contradictions.push({
          factType,
          severity: 'HIGH',
          values: distinctValues,
          evidenceIds: Array.from(
            new Set(group.map((fact) => fact.evidenceId)),
          ),
          description: `${factType} has conflicting structured values.`,
        });
      }
    }

    return contradictions;
  }

  private scoreEvidence(
    evaluationCase: CaseForEvaluation,
    requirements: PolicyRequirement[],
    contradictions: Contradiction[],
  ): EvidenceScoreDraft[] {
    const contradictionEvidenceIds = new Set(
      contradictions.flatMap((contradiction) => contradiction.evidenceIds),
    );

    return evaluationCase.evidenceItems.flatMap((evidence) => {
      const requirement = requirementForEvidence(evidence, requirements);
      if (!requirement) {
        return [];
      }

      const score = this.calculateQualityScore(
        evaluationCase,
        evidence,
        contradictionEvidenceIds.has(evidence.id),
      );
      return [
        {
          caseId: evaluationCase.id,
          evidenceId: evidence.id,
          requirementId: requirement.id,
          ...score,
          supportDirection: supportDirectionFor(
            evidence,
            contradictionEvidenceIds.has(evidence.id),
          ),
        },
      ];
    });
  }

  private calculateQualityScore(
    evaluationCase: CaseForEvaluation,
    evidence: EvidenceWithFacts,
    contradictory: boolean,
  ): EvidenceQualityScore {
    const sourceReliability = clampScore(
      sourceReliabilityFor(evidence.evidenceType) +
        (evidence.fileHash ? 5 : 0) +
        (evidence.processingStatus === EvidenceProcessingStatus.VERIFIED
          ? 5
          : 0),
    );
    const directness = directnessFor(evidence.evidenceType);
    const completeness = completenessFor(evidence.extractedFacts);
    const consistency = contradictory ? 40 : 95;
    const timeliness = timelinessFor(
      evaluationCase.transaction.transactionDate,
      evidence.createdAt,
    );
    const finalScore = Math.round(
      sourceReliability * QUALITY_WEIGHTS.sourceReliability +
        directness * QUALITY_WEIGHTS.directness +
        completeness * QUALITY_WEIGHTS.completeness +
        consistency * QUALITY_WEIGHTS.consistency +
        timeliness * QUALITY_WEIGHTS.timeliness,
    );

    return {
      sourceReliability,
      directness,
      completeness,
      consistency,
      timeliness,
      finalScore,
    };
  }

  private applyRules(
    reasonCode: ReasonCode,
    facts: FactView[],
    contradictions: Contradiction[],
  ): RuleResult[] {
    if (reasonCode === ReasonCode.GOODS_NOT_RECEIVED) {
      return this.applyGoodsNotReceivedRules(facts, contradictions);
    }

    if (reasonCode === ReasonCode.REFUND_NOT_PROCESSED) {
      return this.applyRefundRules(facts, contradictions);
    }

    return this.applyCancellationRules(facts, contradictions);
  }

  private applyGoodsNotReceivedRules(
    facts: FactView[],
    contradictions: Contradiction[],
  ): RuleResult[] {
    const deliveryConfirmed = hasTruthyFact(facts, 'DELIVERY_CONFIRMED');
    const dispatchOnly =
      hasTruthyFact(facts, 'DISPATCHED') && !deliveryConfirmed;
    const recipientOrLocationConfirmed =
      hasTruthyFact(facts, 'RECIPIENT_CONFIRMED') ||
      hasTruthyFact(facts, 'DELIVERY_LOCATION_MATCH');
    const nonDeliveryEvidence =
      hasTruthyFact(facts, 'NON_DELIVERY_STATEMENT') ||
      hasTruthyFact(facts, 'DELIVERY_NOT_RECEIVED');
    const identityConflict = contradictions.some((item) =>
      [
        'DELIVERY_LOCATION',
        'RECIPIENT_NAME',
        'HIGH_SEVERITY_CONTRADICTION',
      ].includes(item.factType),
    );

    return [
      buildRule(
        'PX-GNR-001',
        dispatchOnly,
        'LIMITS_MERCHANT_SUPPORT',
        0,
        evidenceIdsFor(facts, ['DISPATCHED']),
        ['DISPATCHED'],
      ),
      buildRule(
        'PX-GNR-002',
        deliveryConfirmed && recipientOrLocationConfirmed && !identityConflict,
        'SUPPORTS_MERCHANT',
        92,
        evidenceIdsFor(facts, [
          'DELIVERY_CONFIRMED',
          'RECIPIENT_CONFIRMED',
          'DELIVERY_LOCATION_MATCH',
        ]),
        [
          'DELIVERY_CONFIRMED',
          'RECIPIENT_CONFIRMED',
          'DELIVERY_LOCATION_MATCH',
        ],
      ),
      buildRule(
        'PX-GNR-003',
        !deliveryConfirmed && nonDeliveryEvidence && !identityConflict,
        'SUPPORTS_CARD_MEMBER',
        90,
        evidenceIdsFor(facts, [
          'NON_DELIVERY_STATEMENT',
          'DELIVERY_NOT_RECEIVED',
        ]),
        ['NON_DELIVERY_STATEMENT', 'DELIVERY_NOT_RECEIVED'],
      ),
      buildRule(
        'PX-GNR-004',
        identityConflict,
        'REQUIRES_REVIEW',
        100,
        Array.from(new Set(contradictions.flatMap((item) => item.evidenceIds))),
        ['DELIVERY_LOCATION', 'RECIPIENT_NAME'],
      ),
    ];
  }

  private applyRefundRules(
    facts: FactView[],
    contradictions: Contradiction[],
  ): RuleResult[] {
    const refundPromise = hasTruthyFact(facts, 'REFUND_PROMISED');
    const completedRefund = hasTruthyFact(facts, 'REFUND_COMPLETED');
    const refundConflict = contradictions.some((item) =>
      [
        'REFUND_AMOUNT',
        'REFUND_DATE',
        'REFUND_REFERENCE',
        'HIGH_SEVERITY_CONTRADICTION',
      ].includes(item.factType),
    );

    return [
      buildRule(
        'PX-REF-001',
        refundPromise && !completedRefund && !refundConflict,
        'SUPPORTS_CARD_MEMBER',
        91,
        evidenceIdsFor(facts, ['REFUND_PROMISED']),
        ['REFUND_PROMISED'],
      ),
      buildRule(
        'PX-REF-002',
        completedRefund && !refundConflict,
        'SUPPORTS_MERCHANT',
        93,
        evidenceIdsFor(facts, [
          'REFUND_COMPLETED',
          'REFUND_AMOUNT',
          'REFUND_DATE',
          'REFUND_REFERENCE',
        ]),
        ['REFUND_COMPLETED'],
      ),
      buildRule(
        'PX-REF-003',
        refundConflict,
        'REQUIRES_REVIEW',
        100,
        Array.from(new Set(contradictions.flatMap((item) => item.evidenceIds))),
        ['REFUND_AMOUNT', 'REFUND_DATE', 'REFUND_REFERENCE'],
      ),
    ];
  }

  private applyCancellationRules(
    facts: FactView[],
    contradictions: Contradiction[],
  ): RuleResult[] {
    const timelyCancellation = hasTruthyFact(facts, 'CANCELLATION_TIMELY');
    const validCancellation = hasTruthyFact(facts, 'CANCELLATION_VALID');
    const noServiceDelivery =
      hasFalsyFact(facts, 'SERVICE_DELIVERED') ||
      hasTruthyFact(facts, 'NO_SERVICE_DELIVERY');
    const noRefund =
      hasFalsyFact(facts, 'REFUND_PROVIDED') ||
      hasTruthyFact(facts, 'NO_REFUND');
    const lateCancellation =
      hasFalsyFact(facts, 'CANCELLATION_TIMELY') ||
      hasTruthyFact(facts, 'LATE_CANCELLATION');
    const acceptedPolicy = hasTruthyFact(facts, 'POLICY_ACCEPTED');
    const unclearCancellation =
      contradictions.some((item) =>
        [
          'CANCELLATION_DATE',
          'POLICY_ACCEPTED',
          'HIGH_SEVERITY_CONTRADICTION',
        ].includes(item.factType),
      ) ||
      !hasAnyFact(facts, ['CANCELLATION_TIMELY', 'LATE_CANCELLATION']) ||
      !hasAnyFact(facts, ['POLICY_ACCEPTED']);

    return [
      buildRule(
        'PX-CAN-001',
        timelyCancellation &&
          validCancellation &&
          noServiceDelivery &&
          noRefund,
        'SUPPORTS_CARD_MEMBER',
        92,
        evidenceIdsFor(facts, [
          'CANCELLATION_TIMELY',
          'CANCELLATION_VALID',
          'SERVICE_DELIVERED',
          'NO_SERVICE_DELIVERY',
          'REFUND_PROVIDED',
          'NO_REFUND',
        ]),
        [
          'CANCELLATION_TIMELY',
          'CANCELLATION_VALID',
          'SERVICE_DELIVERED',
          'REFUND_PROVIDED',
        ],
      ),
      buildRule(
        'PX-CAN-002',
        lateCancellation && acceptedPolicy && !unclearCancellation,
        'SUPPORTS_MERCHANT',
        90,
        evidenceIdsFor(facts, [
          'CANCELLATION_TIMELY',
          'LATE_CANCELLATION',
          'POLICY_ACCEPTED',
        ]),
        ['CANCELLATION_TIMELY', 'POLICY_ACCEPTED'],
      ),
      buildRule(
        'PX-CAN-003',
        unclearCancellation,
        'REQUIRES_REVIEW',
        100,
        Array.from(new Set(contradictions.flatMap((item) => item.evidenceIds))),
        ['CANCELLATION_TIMELY', 'POLICY_ACCEPTED'],
      ),
    ];
  }

  private buildEvaluation(
    evaluationCase: CaseForEvaluation,
    requirements: PolicyRequirement[],
    rules: PolicyRule[],
    evidenceScores: EvidenceScoreDraft[],
    ruleResults: RuleResult[],
    facts: FactView[],
    contradictions: Contradiction[],
  ) {
    const appliedRuleResults = ruleResults.filter((result) => result.applied);
    const cardRuleScore = Math.max(
      0,
      ...appliedRuleResults
        .filter((rule) => rule.effect === 'SUPPORTS_CARD_MEMBER')
        .map((rule) => rule.scoreImpact),
    );
    const merchantRuleScore = Math.max(
      0,
      ...appliedRuleResults
        .filter((rule) => rule.effect === 'SUPPORTS_MERCHANT')
        .map((rule) => rule.scoreImpact),
    );
    const cardEvidenceScore = averageScore(
      evidenceScores,
      EvidenceSupportDirection.SUPPORTS_CARD_MEMBER,
    );
    const merchantEvidenceScore = averageScore(
      evidenceScores,
      EvidenceSupportDirection.SUPPORTS_MERCHANT,
    );
    const cardMemberScore = Math.max(cardRuleScore, cardEvidenceScore);
    const merchantScore = Math.max(merchantRuleScore, merchantEvidenceScore);
    const decisionMargin = Math.abs(cardMemberScore - merchantScore);
    const candidateOutcome =
      cardMemberScore > merchantScore
        ? RecommendedOutcome.CARD_MEMBER_SUPPORTED
        : RecommendedOutcome.MERCHANT_SUPPORTED;
    const confidence = Math.max(cardMemberScore, merchantScore);
    const gate = this.evaluateAutomationGate(
      requirements,
      appliedRuleResults,
      facts,
      contradictions,
      confidence,
      decisionMargin,
    );
    const recommendedOutcome = gate.passed
      ? candidateOutcome
      : RecommendedOutcome.HUMAN_REVIEW_REQUIRED;
    const ruleDescriptions = new Map(
      rules.map((rule) => [rule.ruleId, rule.description]),
    );
    const missingEvidence = requirements
      .filter(
        (requirement) =>
          requirement.isMandatory &&
          !evidenceScores.some(
            (score) => score.requirementId === requirement.id,
          ),
      )
      .map((requirement) => requirement.requirementName);
    const explanationData: ExplanationResponse = {
      disputeCategory: evaluationCase.reasonCode,
      whatNeededToBeProven: requirements.map(
        (requirement) =>
          `${requirement.requirementName}: ${requirement.description} This is a prototype assumption.`,
      ),
      evidenceSubmittedByEachParty: this.evidenceByParty(
        evaluationCase.evidenceItems,
        evidenceScores,
      ),
      verifiedFacts: facts
        .filter((fact) => fact.verifiedByUser)
        .map((fact) => ({
          factType: fact.factType,
          value: fact.value,
          evidenceId: fact.evidenceId,
        })),
      missingEvidence,
      contradictions,
      appliedRuleIdentifiers: appliedRuleResults.map((rule) => rule.ruleId),
      recommendedOutcome,
      confidence,
      humanReviewReason: gate.passed ? null : gate.reasons.join('; '),
    };

    return {
      recommendedOutcome,
      cardMemberScore,
      merchantScore,
      confidence,
      decisionMargin,
      modelMetadata: {
        aiDecisionUsed: false,
        deterministicPolicyEngine: true,
        policyVersion: POLICY_VERSION,
        qualityWeights: QUALITY_WEIGHTS,
        prototypeAssumptions: rules.map((rule) => ({
          ruleId: rule.ruleId,
          description: ruleDescriptions.get(rule.ruleId),
        })),
      },
      explanationData,
    };
  }

  private evaluateAutomationGate(
    requirements: PolicyRequirement[],
    appliedRuleResults: RuleResult[],
    facts: FactView[],
    contradictions: Contradiction[],
    confidence: number,
    decisionMargin: number,
  ): { passed: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const confidenceThreshold = this.configService.get<number>(
      'POLICY_AUTO_CONFIDENCE_THRESHOLD',
      85,
    );
    const marginThreshold = this.configService.get<number>(
      'POLICY_AUTO_DECISION_MARGIN_THRESHOLD',
      20,
    );
    const criticalFactThreshold = this.configService.get<number>(
      'POLICY_CRITICAL_FACT_CONFIDENCE_THRESHOLD',
      0.8,
    );

    if (confidence < confidenceThreshold) {
      reasons.push(
        `confidence ${confidence} is below threshold ${confidenceThreshold}`,
      );
    }

    if (decisionMargin < marginThreshold) {
      reasons.push(
        `decision margin ${decisionMargin} is below threshold ${marginThreshold}`,
      );
    }

    if (
      requirements.filter((requirement) => requirement.isMandatory).length === 0
    ) {
      reasons.push('mandatory requirements were not configured');
    }

    if (
      contradictions.some((contradiction) => contradiction.severity === 'HIGH')
    ) {
      reasons.push('unresolved high-severity contradiction is present');
    }

    const criticalFactTypes = Array.from(
      new Set(appliedRuleResults.flatMap((rule) => rule.criticalFactTypes)),
    );
    const unverifiedCriticalFacts = criticalFactTypes.filter((factType) => {
      const matchingFacts = facts.filter((fact) => fact.factType === factType);
      if (matchingFacts.length === 0) {
        return false;
      }

      return !matchingFacts.some(
        (fact) =>
          fact.verifiedByUser ||
          (fact.confidence !== null &&
            fact.confidence >= criticalFactThreshold),
      );
    });

    if (unverifiedCriticalFacts.length > 0) {
      reasons.push(
        `critical facts need verification or confidence >= ${criticalFactThreshold}: ${unverifiedCriticalFacts.join(', ')}`,
      );
    }

    if (hasTruthyFact(facts, 'POLICY_EXCEPTION')) {
      reasons.push('policy exception fact is present');
    }

    if (appliedRuleResults.some((rule) => rule.effect === 'REQUIRES_REVIEW')) {
      reasons.push('an applied prototype rule requires human review');
    }

    return { passed: reasons.length === 0, reasons };
  }

  private evidenceByParty(
    evidenceItems: EvidenceWithFacts[],
    evidenceScores: EvidenceScoreDraft[],
  ) {
    const scoreByEvidenceId = new Map(
      evidenceScores.map((score) => [score.evidenceId, score.finalScore]),
    );
    const serialize = (role: Role) =>
      evidenceItems
        .filter((evidence) => evidence.submittedByRole === role)
        .map((evidence) => ({
          evidenceId: evidence.id,
          evidenceType: evidence.evidenceType,
          finalScore: scoreByEvidenceId.get(evidence.id),
        }));

    return {
      cardMember: serialize(Role.CARD_MEMBER),
      merchant: serialize(Role.MERCHANT),
    };
  }
}

function buildRule(
  ruleId: string,
  applied: boolean,
  effect: RuleResult['effect'],
  scoreImpact: number,
  evidenceIds: string[],
  criticalFactTypes: string[],
): RuleResult {
  return {
    ruleId,
    applied,
    effect,
    scoreImpact,
    evidenceIds: Array.from(new Set(evidenceIds)),
    criticalFactTypes,
    explanation: `${ruleId} ${applied ? 'applied' : 'did not apply'}`,
  };
}

function requirementForEvidence(
  evidence: EvidenceWithFacts,
  requirements: PolicyRequirement[],
): PolicyRequirement | undefined {
  return requirements.find((requirement) => {
    const acceptedTypes = Array.isArray(requirement.acceptedEvidenceTypes)
      ? requirement.acceptedEvidenceTypes.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    return acceptedTypes.includes(evidence.evidenceType);
  });
}

function supportDirectionFor(
  evidence: EvidenceWithFacts,
  contradictory: boolean,
): EvidenceSupportDirection {
  if (contradictory) {
    return EvidenceSupportDirection.CONTRADICTORY;
  }

  if (
    evidence.extractedFacts.some(
      (fact) =>
        [
          'DELIVERY_CONFIRMED',
          'RECIPIENT_CONFIRMED',
          'DELIVERY_LOCATION_MATCH',
          'REFUND_COMPLETED',
          'POLICY_ACCEPTED',
          'SERVICE_DELIVERED',
        ].includes(fact.factType) && isTruthyValue(normalizedFactValue(fact)),
    )
  ) {
    return EvidenceSupportDirection.SUPPORTS_MERCHANT;
  }

  if (
    evidence.extractedFacts.some((fact) =>
      [
        'NON_DELIVERY_STATEMENT',
        'DELIVERY_NOT_RECEIVED',
        'REFUND_PROMISED',
        'CANCELLATION_TIMELY',
        'CANCELLATION_VALID',
        'NO_SERVICE_DELIVERY',
        'NO_REFUND',
      ].includes(fact.factType),
    )
  ) {
    return EvidenceSupportDirection.SUPPORTS_CARD_MEMBER;
  }

  return EvidenceSupportDirection.NEUTRAL;
}

function sourceReliabilityFor(evidenceType: string): number {
  if (
    [
      'delivery_confirmation',
      'tracking_record',
      'carrier_proof',
      'completed_refund_transaction',
      'settlement_record',
      'processor_record',
      'terms_acceptance',
      'policy_snapshot',
      'service_delivery_record',
      'attendance_record',
      'booking_record',
      'refund_confirmation',
      'refund_reference',
      'invoice',
      'receipt',
      'order_record',
    ].includes(evidenceType)
  ) {
    return 90;
  }

  if (
    [
      'email',
      'support_ticket',
      'refund_promise',
      'cancellation_proof',
    ].includes(evidenceType)
  ) {
    return 78;
  }

  return 70;
}

function directnessFor(evidenceType: string): number {
  if (
    [
      'delivery_confirmation',
      'completed_refund_transaction',
      'settlement_record',
      'cancellation_confirmation',
      'service_delivery_record',
      'non_delivery_statement',
      'refund_promise',
      'cancellation_proof',
    ].includes(evidenceType)
  ) {
    return 95;
  }

  if (
    [
      'dispatch_record',
      'shipping_manifest',
      'fulfillment_record',
      'invoice',
      'receipt',
      'order_record',
    ].includes(evidenceType)
  ) {
    return 55;
  }

  return 80;
}

function completenessFor(facts: ExtractedFact[]): number {
  if (facts.length === 0) {
    return 55;
  }

  if (facts.some((fact) => fact.verifiedByUser)) {
    return 95;
  }

  if (
    facts.every(
      (fact) =>
        normalizeConfidence(fact.confidence) !== null &&
        Number(normalizeConfidence(fact.confidence)) >= 0.8,
    )
  ) {
    return 85;
  }

  return 72;
}

function timelinessFor(transactionDate: Date, evidenceCreatedAt: Date): number {
  const days =
    Math.abs(evidenceCreatedAt.getTime() - transactionDate.getTime()) /
    (24 * 60 * 60 * 1000);
  if (days <= 45) {
    return 100;
  }

  if (days <= 90) {
    return 80;
  }

  return 60;
}

function averageScore(
  scores: EvidenceScoreDraft[],
  supportDirection: EvidenceSupportDirection,
): number {
  const matchingScores = scores.filter(
    (score) => score.supportDirection === supportDirection,
  );
  if (matchingScores.length === 0) {
    return 0;
  }

  return Math.round(
    matchingScores.reduce((sum, score) => sum + score.finalScore, 0) /
      matchingScores.length,
  );
}

function hasTruthyFact(facts: FactView[], factType: string): boolean {
  return facts.some(
    (fact) => fact.factType === factType && isTruthyValue(fact.value),
  );
}

function hasFalsyFact(facts: FactView[], factType: string): boolean {
  return facts.some(
    (fact) => fact.factType === factType && !isTruthyValue(fact.value),
  );
}

function hasAnyFact(facts: FactView[], factTypes: string[]): boolean {
  return facts.some((fact) => factTypes.includes(fact.factType));
}

function evidenceIdsFor(facts: FactView[], factTypes: string[]): string[] {
  return facts
    .filter((fact) => factTypes.includes(fact.factType))
    .map((fact) => fact.evidenceId);
}

function normalizedFactValue(fact: ExtractedFact): string {
  return (fact.normalizedValue ?? fact.factValue).trim();
}

function normalizeConfidence(confidence: number | null): number | null {
  if (confidence === null) {
    return null;
  }

  return confidence > 1 ? confidence / 100 : confidence;
}

function isTruthyValue(value: string): boolean {
  return [
    'true',
    'yes',
    'y',
    '1',
    'confirmed',
    'completed',
    'valid',
    'timely',
  ].includes(value.trim().toLowerCase());
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function serializeDecisionRecord(record: {
  id: string;
  caseId: string;
  recommendedOutcome: RecommendedOutcome;
  cardMemberScore: number;
  merchantScore: number;
  confidence: number;
  decisionMargin: number;
  decisionType: DecisionType;
  policyVersion: string;
  modelMetadata: Prisma.JsonValue;
  explanationData: Prisma.JsonValue;
  createdAt: Date;
}): EvaluationResponse {
  return {
    id: record.id,
    caseId: record.caseId,
    recommendedOutcome: record.recommendedOutcome,
    cardMemberScore: record.cardMemberScore,
    merchantScore: record.merchantScore,
    confidence: record.confidence,
    decisionMargin: record.decisionMargin,
    decisionType: record.decisionType,
    policyVersion: record.policyVersion,
    modelMetadata: record.modelMetadata,
    explanationData: record.explanationData as ExplanationResponse,
    createdAt: record.createdAt.toISOString(),
  };
}
