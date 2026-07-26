import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluationSummary } from './EvaluationSummary';
import type { DecisionRecord } from '../../types/domain';

function buildEvaluation(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: 'decision-1',
    caseId: 'case-1',
    recommendedOutcome: 'MERCHANT_SUPPORTED',
    cardMemberScore: 40,
    merchantScore: 88,
    confidence: 88,
    decisionMargin: 48,
    decisionType: 'AUTOMATED_RECOMMENDATION',
    policyVersion: 'prototype-v1',
    modelMetadata: { aiDecisionUsed: false, deterministicPolicyEngine: true },
    explanationData: {
      disputeCategory: 'GOODS_NOT_RECEIVED',
      whatNeededToBeProven: [],
      evidenceSubmittedByEachParty: { cardMember: [], merchant: [] },
      verifiedFacts: [],
      missingEvidence: [],
      contradictions: [],
      appliedRuleIdentifiers: [],
      recommendedOutcome: 'MERCHANT_SUPPORTED',
      confidence: 88,
      humanReviewReason: null,
    },
    createdAt: '2026-07-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('EvaluationSummary', () => {
  it('shows scores, confidence, margin, and a neutral recommendation label', () => {
    render(<EvaluationSummary evaluation={buildEvaluation()} />);

    expect(screen.getByText('Evidence weighed toward the merchant')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('48 points')).toBeInTheDocument();
    expect(screen.getByText('Automatic recommendation')).toBeInTheDocument();
    expect(screen.getAllByText('40/100')).toHaveLength(1);
    expect(screen.getAllByText('88/100')).toHaveLength(1);
  });

  it('never claims confidence equals legal certainty', () => {
    render(<EvaluationSummary evaluation={buildEvaluation()} />);
    expect(screen.getByText(/not a finding of fact or a legal determination/i)).toBeInTheDocument();
    expect(screen.queryByText(/certain/i)).not.toBeInTheDocument();
  });

  it('labels a human-review outcome distinctly from an automatic recommendation', () => {
    render(
      <EvaluationSummary
        evaluation={buildEvaluation({ recommendedOutcome: 'HUMAN_REVIEW_REQUIRED', confidence: 55, decisionMargin: 5 })}
      />,
    );
    expect(screen.getByText('Needs human review')).toBeInTheDocument();
    expect(screen.getByText('Human review required')).toBeInTheDocument();
  });

  it('never renders raw JSON', () => {
    const { container } = render(<EvaluationSummary evaluation={buildEvaluation()} />);
    expect(container.textContent).not.toMatch(/[{[]"\w+":/);
  });
});
