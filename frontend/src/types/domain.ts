export type UserRole = 'CARD_MEMBER' | 'MERCHANT' | 'ANALYST';

export type ReasonCode =
  | 'GOODS_NOT_RECEIVED'
  | 'REFUND_NOT_PROCESSED'
  | 'CANCELLED_GOODS_OR_SERVICES';

export type CaseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'AWAITING_MERCHANT'
  | 'EVIDENCE_PROCESSING'
  | 'UNDER_EVALUATION'
  | 'HUMAN_REVIEW'
  | 'RESOLVED'
  | 'APPEALED'
  | 'CLOSED';

export type MerchantResponseStatus = 'PENDING' | 'SUBMITTED' | 'REOPENED';

export type EvidenceProcessingStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'VERIFIED';

export type RecommendedOutcome =
  | 'CARD_MEMBER_SUPPORTED'
  | 'MERCHANT_SUPPORTED'
  | 'HUMAN_REVIEW_REQUIRED';

export type DecisionType = 'AUTOMATED_RECOMMENDATION' | 'HUMAN_DECISION';

export type AnalystDecision =
  | 'SUPPORT_CARD_MEMBER'
  | 'SUPPORT_MERCHANT'
  | 'REQUEST_MORE_INFORMATION'
  | 'ESCALATE';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: PublicUser;
}

export interface Transaction {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: string;
  currency: string;
  transactionDate: string;
  status: string;
  maskedCardLast4: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeCaseTransactionSummary {
  id: string;
  merchantName: string;
  amount: string;
  currency: string;
  maskedCardLast4: string;
}

export interface DisputeCase {
  id: string;
  transactionId: string;
  cardMemberId: string;
  merchantId: string;
  reasonCode: ReasonCode;
  cardMemberStatement: string;
  merchantStatement: string | null;
  merchantResponseDate: string | null;
  merchantResponseStatus: MerchantResponseStatus;
  status: CaseStatus;
  responseDeadline: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  transaction: DisputeCaseTransactionSummary;
}

export interface TimelineEvent {
  id: string;
  caseId: string;
  eventType: string;
  description: string;
  performedBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PolicyRequirement {
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
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedFact {
  id: string;
  evidenceId: string;
  factType: string;
  factValue: string;
  normalizedValue: string | null;
  confidence: number | null;
  sourcePage: number | null;
  verifiedByUser: boolean;
  correctedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  submittedByUserId: string;
  submittedByRole: UserRole;
  evidenceType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string | null;
  processingStatus: EvidenceProcessingStatus;
  extractionConfidence: number | null;
  createdAt: string;
  updatedAt: string;
  facts: ExtractedFact[];
}

export interface EvidenceUploadTarget {
  evidenceId: string;
  uploadUrl: string;
  method: 'POST' | 'PUT';
  headers: Record<string, string>;
  fields?: Record<string, string>;
  expiresAt: string;
}

export interface PolicyRuleDescriptor {
  ruleId: string;
  description?: string;
}

export interface DecisionRecord {
  id: string;
  caseId: string;
  recommendedOutcome: RecommendedOutcome;
  cardMemberScore: number;
  merchantScore: number;
  confidence: number;
  decisionMargin: number;
  decisionType: DecisionType;
  policyVersion: string;
  modelMetadata: {
    aiDecisionUsed: boolean;
    deterministicPolicyEngine: boolean;
    policyVersion?: string;
    qualityWeights?: Record<string, number>;
    prototypeAssumptions?: PolicyRuleDescriptor[];
  };
  explanationData: ExplanationData;
  createdAt: string;
}

export type EvidenceSupportDirection = 'SUPPORTS_CARD_MEMBER' | 'SUPPORTS_MERCHANT' | 'NEUTRAL' | 'CONTRADICTORY';

export interface ExplanationContradiction {
  factType: string;
  severity: 'LOW' | 'HIGH';
  values: string[];
  evidenceIds: string[];
  description: string;
}

export interface ExplanationEvidenceSummary {
  evidenceId: string;
  evidenceType: string;
  finalScore?: number;
}

export interface ExplanationVerifiedFact {
  factType: string;
  value: string;
  evidenceId: string;
}

export interface ExplanationData {
  disputeCategory: ReasonCode;
  whatNeededToBeProven: string[];
  evidenceSubmittedByEachParty: {
    cardMember: ExplanationEvidenceSummary[];
    merchant: ExplanationEvidenceSummary[];
  };
  verifiedFacts: ExplanationVerifiedFact[];
  missingEvidence: string[];
  contradictions: ExplanationContradiction[];
  appliedRuleIdentifiers: string[];
  recommendedOutcome: RecommendedOutcome;
  confidence: number;
  humanReviewReason: string | null;
}

export interface EvidenceMatrixScore {
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
  evidenceType: string;
  submittedByRole: UserRole;
}

export interface EvidenceMatrixRequirement {
  requirementId: string;
  requirementKey: string;
  requirementName: string;
  isMandatory: boolean;
  evaluated: boolean;
  evidenceScores: EvidenceMatrixScore[];
}

export interface EvidenceMatrixResponse {
  caseId: string;
  policyVersion: string;
  disputeCategory: ReasonCode;
  requirements: EvidenceMatrixRequirement[];
}

export interface AnalystQueueCase {
  id: string;
  reasonCode: ReasonCode;
  status: CaseStatus;
  cardMemberId: string;
  merchantId: string;
  merchantName: string;
  amount: string;
  currency: string;
  latestRecommendation: RecommendedOutcome | null;
  latestConfidence: number | null;
  latestDecisionMargin: number | null;
  /** Plain-language reasons the policy engine could not decide automatically (semicolon-joined by the backend), or null once/if resolved without escalation. */
  latestEscalationReason: string | null;
  responseDeadline: string;
  createdAt: string;
}

export interface AnalystReviewEntry {
  id: string;
  analystId: string;
  systemRecommendation: RecommendedOutcome;
  analystDecision: AnalystDecision;
  overrideReason: string | null;
  analystNotes: string | null;
  createdAt: string;
}

export interface AnalystCaseDetail extends AnalystQueueCase {
  cardMemberStatement: string;
  merchantStatement: string | null;
  latestExplanation: ExplanationData | null;
  reviews: AnalystReviewEntry[];
}

export interface AnalystDecisionPayload {
  decision: AnalystDecision;
  overrideReason?: string;
  analystNotes?: string;
}

export interface AnalystDecisionResult {
  reviewId: string;
  caseId: string;
  systemRecommendation: RecommendedOutcome;
  analystDecision: AnalystDecision;
  status: CaseStatus;
  overrideReason: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  caseId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  caseId: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export type CaseEventName =
  | 'case.status.updated'
  | 'evidence.processing.completed'
  | 'merchant.response.received'
  | 'analyst.review.required'
  | 'decision.generated'
  | 'information.requested';

export interface CaseEventPayload {
  caseId: string;
  newStatus?: CaseStatus;
  title?: string;
  message?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
  requestId?: string;
}

export const REASON_CODE_LABELS: Record<ReasonCode, string> = {
  GOODS_NOT_RECEIVED: 'Goods not received',
  REFUND_NOT_PROCESSED: 'Refund not processed',
  CANCELLED_GOODS_OR_SERVICES: 'Cancelled goods or services',
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  AWAITING_MERCHANT: 'Awaiting merchant',
  EVIDENCE_PROCESSING: 'Evidence processing',
  UNDER_EVALUATION: 'Under evaluation',
  HUMAN_REVIEW: 'Human review',
  RESOLVED: 'Resolved',
  APPEALED: 'Appealed',
  CLOSED: 'Closed',
};

export const MERCHANT_RESPONSE_STATUS_LABELS: Record<MerchantResponseStatus, string> = {
  PENDING: 'Response pending',
  SUBMITTED: 'Response submitted',
  REOPENED: 'Reopened for response',
};

export const EVIDENCE_PROCESSING_STATUS_LABELS: Record<EvidenceProcessingStatus, string> = {
  UPLOADED: 'Uploaded',
  PROCESSING: 'Processing',
  PROCESSED: 'Processed',
  FAILED: 'Failed',
  VERIFIED: 'Verified',
};

/** Deliberately neutral: avoids "won/lost" framing so an automated recommendation doesn't read as a final verdict. */
export const RECOMMENDED_OUTCOME_LABELS: Record<RecommendedOutcome, string> = {
  CARD_MEMBER_SUPPORTED: 'Evidence weighed toward the card member',
  MERCHANT_SUPPORTED: 'Evidence weighed toward the merchant',
  HUMAN_REVIEW_REQUIRED: 'Needs human review',
};

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  AUTOMATED_RECOMMENDATION: 'Automated recommendation',
  HUMAN_DECISION: 'Human decision',
};

export const ANALYST_DECISION_LABELS: Record<AnalystDecision, string> = {
  SUPPORT_CARD_MEMBER: 'Support card member',
  SUPPORT_MERCHANT: 'Support merchant',
  REQUEST_MORE_INFORMATION: 'Request more information',
  ESCALATE: 'Escalate',
};
