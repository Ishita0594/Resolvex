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
  };
  explanationData: ExplanationData;
  createdAt: string;
}

export interface ExplanationData {
  disputeCategory: ReasonCode;
  appliedRuleIdentifiers: string[];
  recommendedOutcome: RecommendedOutcome;
  confidence: number;
  humanReviewReason: string | null;
  [key: string]: unknown;
}

export interface AnalystCaseSummary extends DisputeCase {
  latestDecision?: DecisionRecord | null;
}

export interface Notification {
  id: string;
  userId: string;
  caseId: string | null;
  title: string;
  message: string;
  notificationType: string;
  isRead: boolean;
  createdAt: string;
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
