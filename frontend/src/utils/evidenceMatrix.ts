import type { EvidenceMatrixRequirement, EvidenceMatrixScore, UserRole } from '../types/domain';

export type RequirementStatus = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_SUPPORTED' | 'MISSING' | 'CONTRADICTORY';

const SUPPORTED_SCORE_MIN = 75;
const PARTIALLY_SUPPORTED_SCORE_MIN = 45;

export function scoresForRole(
  requirement: EvidenceMatrixRequirement,
  role: Extract<UserRole, 'CARD_MEMBER' | 'MERCHANT'>,
): EvidenceMatrixScore[] {
  return requirement.evidenceScores.filter((score) => score.submittedByRole === role);
}

/**
 * Derives a single at-a-glance requirement status from the raw per-evidence scores.
 * No evidence at all is treated as MISSING regardless of whether the requirement is mandatory;
 * any contradictory evidence takes priority over a score-based read since it needs the most attention.
 */
export function getRequirementStatus(requirement: EvidenceMatrixRequirement): RequirementStatus {
  const { evidenceScores } = requirement;
  if (evidenceScores.length === 0) {
    return 'MISSING';
  }
  if (evidenceScores.some((score) => score.supportDirection === 'CONTRADICTORY')) {
    return 'CONTRADICTORY';
  }

  const bestScore = Math.max(...evidenceScores.map((score) => score.finalScore));
  if (bestScore >= SUPPORTED_SCORE_MIN) {
    return 'SUPPORTED';
  }
  if (bestScore >= PARTIALLY_SUPPORTED_SCORE_MIN) {
    return 'PARTIALLY_SUPPORTED';
  }
  return 'NOT_SUPPORTED';
}
