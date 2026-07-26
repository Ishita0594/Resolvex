import type { EvidenceItem, ExtractedFact, UserRole } from '../types/domain';
import { getConfidenceLevel } from '../components/evidence/ConfidenceBadge';

/** Mirrors the backend's ai-processing.service.ts / evidence.service.ts assertCanModifyEvidence({ allowAnalyst: true }) rule. */
export function canModifyEvidenceFacts(evidence: EvidenceItem, currentUserId: string, currentUserRole: UserRole): boolean {
  if (currentUserRole === 'ANALYST') {
    return true;
  }
  return evidence.submittedByUserId === currentUserId && evidence.submittedByRole === currentUserRole;
}

/** Mirrors the backend's ai-processing.service.ts retry guard: only FAILED evidence, owned by the submitter (or an analyst), may be retried. */
export function canRetryEvidenceProcessing(evidence: EvidenceItem, currentUserId: string, currentUserRole: UserRole): boolean {
  return evidence.processingStatus === 'FAILED' && canModifyEvidenceFacts(evidence, currentUserId, currentUserRole);
}

export function getLowConfidenceFacts(facts: ExtractedFact[]): ExtractedFact[] {
  return facts.filter((fact) => fact.confidence !== null && getConfidenceLevel(fact.confidence) === 'low');
}
