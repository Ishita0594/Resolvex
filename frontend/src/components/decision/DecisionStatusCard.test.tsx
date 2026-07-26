import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DecisionStatusCard } from './DecisionStatusCard';
import type { DecisionRecord } from '../../types/domain';

function buildEvaluation(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: 'decision-1',
    caseId: 'case-1',
    recommendedOutcome: 'CARD_MEMBER_SUPPORTED',
    cardMemberScore: 90,
    merchantScore: 30,
    confidence: 90,
    decisionMargin: 60,
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
      recommendedOutcome: 'CARD_MEMBER_SUPPORTED',
      confidence: 90,
      humanReviewReason: null,
    },
    createdAt: '2026-07-25T00:00:00.000Z',
    ...overrides,
  };
}

function renderCard(props: Partial<ComponentProps<typeof DecisionStatusCard>> = {}) {
  return render(
    <MemoryRouter>
      <DecisionStatusCard
        caseStatus="RESOLVED"
        evaluation={null}
        isLoading={false}
        error={null}
        explanationPath="/member/disputes/case-1/decision"
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('DecisionStatusCard', () => {
  it('shows an unevaluated message before any decision exists', () => {
    renderCard({ caseStatus: 'AWAITING_MERCHANT', evaluation: null });
    expect(screen.getByText(/hasn't been evaluated yet/i)).toBeInTheDocument();
  });

  it('shows an evaluating message while the case is under evaluation', () => {
    renderCard({ caseStatus: 'UNDER_EVALUATION', evaluation: null });
    expect(screen.getByText(/policy engine is evaluating/i)).toBeInTheDocument();
  });

  it('shows the human-review banner and a link to the full explanation when review is required', () => {
    renderCard({
      caseStatus: 'HUMAN_REVIEW',
      evaluation: buildEvaluation({ recommendedOutcome: 'HUMAN_REVIEW_REQUIRED' }),
    });
    expect(screen.getByText('This case needs human review')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view full explanation/i })).toHaveAttribute(
      'href',
      '/member/disputes/case-1/decision',
    );
  });

  it('shows the evaluation summary and a link to the full explanation once resolved', () => {
    renderCard({ caseStatus: 'RESOLVED', evaluation: buildEvaluation() });
    expect(screen.getByText('Evidence weighed toward the card member')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view full explanation/i })).toBeInTheDocument();
  });

  it('shows an error state with retry on failure', () => {
    renderCard({ error: { message: 'Boom', variant: 'error' } });
    expect(screen.getByText('Boom')).toBeInTheDocument();
  });
});
