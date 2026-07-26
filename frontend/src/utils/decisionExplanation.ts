import type { CaseStatus, DecisionRecord } from '../types/domain';

export type DecisionState = 'UNEVALUATED' | 'EVALUATING' | 'HUMAN_REVIEW' | 'RESOLVED';

/**
 * Maps the raw case status + latest decision record onto the four lifecycle states the UI needs
 * to render distinctly. A decision record always wins once it exists (it reflects the freshest
 * outcome even if the case status hasn't caught up yet).
 */
export function getDecisionState(caseStatus: CaseStatus, evaluation: DecisionRecord | null): DecisionState {
  if (!evaluation) {
    return caseStatus === 'UNDER_EVALUATION' ? 'EVALUATING' : 'UNEVALUATED';
  }
  if (evaluation.recommendedOutcome === 'HUMAN_REVIEW_REQUIRED' || caseStatus === 'HUMAN_REVIEW') {
    return 'HUMAN_REVIEW';
  }
  return 'RESOLVED';
}

/** Splits the backend's semicolon-joined humanReviewReason into standalone, capitalized sentences. */
export function splitHumanReviewReasons(reason: string | null): string[] {
  if (!reason) {
    return [];
  }
  return reason
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
}

/** Generic, role-agnostic UI copy for what happens next. Never references case-specific reasoning. */
export function getNextActions(state: DecisionState, evaluation: DecisionRecord | null): string[] {
  switch (state) {
    case 'UNEVALUATED':
      return [
        'No further action is needed right now. A policy-based recommendation will appear here once the case is ready for evaluation.',
      ];
    case 'EVALUATING':
      return [
        'The policy engine is currently weighing the evidence submitted so far. This page will update once a recommendation is ready.',
      ];
    case 'HUMAN_REVIEW':
      return [
        'A ResolveX analyst will review the evidence from both parties before a final decision is made.',
        'No action is required from you unless the analyst requests more information.',
      ];
    case 'RESOLVED':
      return evaluation?.decisionType === 'HUMAN_DECISION'
        ? ['An analyst has recorded a final decision for this case. Refer to the case status for what happens next.']
        : [
            'This case has an automated recommendation from the prototype policy engine. The case status will update to reflect the next step.',
          ];
    default:
      return [];
  }
}
