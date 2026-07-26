import { describe, expect, it } from 'vitest';
import { getRequirementStatus, scoresForRole } from './evidenceMatrix';
import type { EvidenceMatrixRequirement, EvidenceMatrixScore } from '../types/domain';

function buildScore(overrides: Partial<EvidenceMatrixScore> = {}): EvidenceMatrixScore {
  return {
    caseId: 'case-1',
    evidenceId: 'evidence-1',
    requirementId: 'req-1',
    sourceReliability: 90,
    directness: 90,
    completeness: 90,
    consistency: 90,
    timeliness: 90,
    finalScore: 90,
    supportDirection: 'SUPPORTS_MERCHANT',
    evidenceType: 'delivery_confirmation',
    submittedByRole: 'MERCHANT',
    ...overrides,
  };
}

function buildRequirement(evidenceScores: EvidenceMatrixScore[] = []): EvidenceMatrixRequirement {
  return {
    requirementId: 'req-1',
    requirementKey: 'delivery_confirmation',
    requirementName: 'Delivery confirmation',
    isMandatory: true,
    evaluated: true,
    evidenceScores,
  };
}

describe('getRequirementStatus', () => {
  it('is MISSING when no evidence was scored, regardless of mandatory status', () => {
    expect(getRequirementStatus(buildRequirement([]))).toBe('MISSING');
    expect(getRequirementStatus({ ...buildRequirement([]), isMandatory: false })).toBe('MISSING');
  });

  it('is CONTRADICTORY when any scored evidence contradicts other evidence', () => {
    const requirement = buildRequirement([
      buildScore({ finalScore: 95, supportDirection: 'SUPPORTS_MERCHANT' }),
      buildScore({ evidenceId: 'evidence-2', supportDirection: 'CONTRADICTORY', submittedByRole: 'CARD_MEMBER' }),
    ]);
    expect(getRequirementStatus(requirement)).toBe('CONTRADICTORY');
  });

  it('is SUPPORTED once the best score clears the supported threshold', () => {
    expect(getRequirementStatus(buildRequirement([buildScore({ finalScore: 80 })]))).toBe('SUPPORTED');
  });

  it('is PARTIALLY_SUPPORTED in the mid-range', () => {
    expect(getRequirementStatus(buildRequirement([buildScore({ finalScore: 60 })]))).toBe('PARTIALLY_SUPPORTED');
  });

  it('is NOT_SUPPORTED for low scores', () => {
    expect(getRequirementStatus(buildRequirement([buildScore({ finalScore: 20 })]))).toBe('NOT_SUPPORTED');
  });

  it('uses the best of multiple scores for the same requirement', () => {
    const requirement = buildRequirement([
      buildScore({ finalScore: 20 }),
      buildScore({ evidenceId: 'evidence-2', finalScore: 85 }),
    ]);
    expect(getRequirementStatus(requirement)).toBe('SUPPORTED');
  });
});

describe('scoresForRole', () => {
  it('filters scores to only the requested submitter role', () => {
    const requirement = buildRequirement([
      buildScore({ evidenceId: 'merchant-evidence', submittedByRole: 'MERCHANT' }),
      buildScore({ evidenceId: 'member-evidence', submittedByRole: 'CARD_MEMBER' }),
    ]);
    expect(scoresForRole(requirement, 'MERCHANT').map((score) => score.evidenceId)).toEqual(['merchant-evidence']);
    expect(scoresForRole(requirement, 'CARD_MEMBER').map((score) => score.evidenceId)).toEqual(['member-evidence']);
  });
});
