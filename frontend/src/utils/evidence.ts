import type { CaseStatus, EvidenceItem, UserRole } from '../types/domain';

const DELETE_ALLOWED_CASE_STATUSES = new Set<CaseStatus>([
  'DRAFT',
  'SUBMITTED',
  'AWAITING_MERCHANT',
  'EVIDENCE_PROCESSING',
]);

function isOwnedByCurrentUser(evidence: EvidenceItem, currentUserId: string, currentUserRole: UserRole): boolean {
  return evidence.submittedByUserId === currentUserId && evidence.submittedByRole === currentUserRole;
}

/** Mirrors the backend's evidence.service.ts assertCanModifyEvidence + DELETE_ALLOWED_STATUSES rules. */
export function canDeleteEvidence(
  evidence: EvidenceItem,
  currentUserId: string,
  currentUserRole: UserRole,
  caseStatus: CaseStatus,
): boolean {
  return isOwnedByCurrentUser(evidence, currentUserId, currentUserRole) && DELETE_ALLOWED_CASE_STATUSES.has(caseStatus);
}

export function evidenceDeleteBlockedReason(
  evidence: EvidenceItem,
  currentUserId: string,
  currentUserRole: UserRole,
  caseStatus: CaseStatus,
): string | null {
  if (!isOwnedByCurrentUser(evidence, currentUserId, currentUserRole)) {
    return 'Only the submitter can delete their own evidence.';
  }
  if (!DELETE_ALLOWED_CASE_STATUSES.has(caseStatus)) {
    return 'Evidence can no longer be deleted once case evaluation has started.';
  }
  return null;
}
