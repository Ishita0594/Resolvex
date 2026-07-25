import type { CaseStatus, EvidenceProcessingStatus } from '../../types/domain';
import { CASE_STATUS_LABELS, EVIDENCE_PROCESSING_STATUS_LABELS } from '../../types/domain';
import { humanizeLabel } from '../../utils/format';

type Tone = 'submitted' | 'processing' | 'review' | 'resolved' | 'failed' | 'neutral';

const CASE_STATUS_TONE: Record<CaseStatus, Tone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'submitted',
  AWAITING_MERCHANT: 'submitted',
  EVIDENCE_PROCESSING: 'processing',
  UNDER_EVALUATION: 'processing',
  HUMAN_REVIEW: 'review',
  RESOLVED: 'resolved',
  APPEALED: 'review',
  CLOSED: 'neutral',
};

const EVIDENCE_STATUS_TONE: Record<EvidenceProcessingStatus, Tone> = {
  UPLOADED: 'neutral',
  PROCESSING: 'processing',
  PROCESSED: 'resolved',
  FAILED: 'failed',
  VERIFIED: 'resolved',
};

function transactionStatusTone(status: string): Tone {
  if (status.includes('REFUND')) return 'processing';
  if (status.includes('CANCEL')) return 'review';
  if (status.includes('FAIL') || status.includes('DECLINE')) return 'failed';
  return 'neutral';
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <span className={`rx-badge rx-badge--${CASE_STATUS_TONE[status]}`}>{CASE_STATUS_LABELS[status]}</span>;
}

export function EvidenceStatusBadge({ status }: { status: EvidenceProcessingStatus }) {
  return <span className={`rx-badge rx-badge--${EVIDENCE_STATUS_TONE[status]}`}>{EVIDENCE_PROCESSING_STATUS_LABELS[status]}</span>;
}

export function TransactionStatusBadge({ status }: { status: string }) {
  return <span className={`rx-badge rx-badge--${transactionStatusTone(status)}`}>{humanizeLabel(status)}</span>;
}
