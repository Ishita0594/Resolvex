import type { AnalystDecision, AnalystQueueCase, RecommendedOutcome } from '../types/domain';

export type AnalystPriority = 'HIGH' | 'STANDARD';

const HIGH_PRIORITY_CONFIDENCE_MAX = 60;
const HIGH_PRIORITY_MARGIN_MAX = 10;
const APPROACHING_DEADLINE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

export function isDeadlinePassed(responseDeadline: string, now: Date = new Date()): boolean {
  return new Date(responseDeadline).getTime() <= now.getTime();
}

export function isApproachingDeadline(responseDeadline: string, now: Date = new Date()): boolean {
  const remainingMs = new Date(responseDeadline).getTime() - now.getTime();
  return remainingMs > 0 && remainingMs <= APPROACHING_DEADLINE_THRESHOLD_MS;
}

export function ageInDays(createdAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)));
}

/**
 * The backend stores no priority column, so this is a frontend heuristic: a case is HIGH priority
 * when the system's own recommendation was weak (low confidence and/or a thin margin between the
 * two sides) or its response deadline is about to pass or already has.
 */
export function getAnalystPriority(caseItem: AnalystQueueCase, now: Date = new Date()): AnalystPriority {
  const lowConfidence = caseItem.latestConfidence !== null && caseItem.latestConfidence < HIGH_PRIORITY_CONFIDENCE_MAX;
  const thinMargin = caseItem.latestDecisionMargin !== null && caseItem.latestDecisionMargin < HIGH_PRIORITY_MARGIN_MAX;
  const urgentDeadline = isApproachingDeadline(caseItem.responseDeadline, now) || isDeadlinePassed(caseItem.responseDeadline, now);

  return lowConfidence || thinMargin || urgentDeadline ? 'HIGH' : 'STANDARD';
}

/** Mirrors the backend's analyst-review.service.ts decisionAlignsWithRecommendation() exactly. */
export function decisionAlignsWithRecommendation(
  decision: AnalystDecision,
  recommendation: RecommendedOutcome | null,
): boolean {
  if (recommendation === 'CARD_MEMBER_SUPPORTED') {
    return decision === 'SUPPORT_CARD_MEMBER';
  }
  if (recommendation === 'MERCHANT_SUPPORTED') {
    return decision === 'SUPPORT_MERCHANT';
  }
  return decision === 'REQUEST_MORE_INFORMATION' || decision === 'ESCALATE';
}

/** Mirrors the backend's analyst-review.service.ts statusForDecision() exactly, for confirmation-dialog copy. */
export function statusForAnalystDecision(decision: AnalystDecision): 'RESOLVED' | 'HUMAN_REVIEW' {
  return decision === 'SUPPORT_CARD_MEMBER' || decision === 'SUPPORT_MERCHANT' ? 'RESOLVED' : 'HUMAN_REVIEW';
}
