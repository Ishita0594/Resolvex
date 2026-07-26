import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DecisionExplanationPage } from './DecisionExplanationPage';
import * as disputesApi from '../../api/disputes';
import * as evaluationApi from '../../api/evaluation';
import * as authApi from '../../api/auth';
import { AuthProvider } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import type { DecisionRecord, DisputeCase } from '../../types/domain';

const MEMBER_USER = { id: 'member-1', name: 'Alex Card', email: 'member@resolvex.demo', role: 'CARD_MEMBER' as const };

function buildDispute(overrides: Partial<DisputeCase> = {}): DisputeCase {
  return {
    id: 'case-1',
    transactionId: 'txn-1',
    cardMemberId: 'member-1',
    merchantId: 'merchant-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    cardMemberStatement: 'Never arrived.',
    merchantStatement: null,
    merchantResponseDate: null,
    merchantResponseStatus: 'SUBMITTED',
    status: 'HUMAN_REVIEW',
    responseDeadline: '2026-07-31T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    resolvedAt: null,
    transaction: {
      id: 'txn-1',
      merchantName: 'Northstar Electronics',
      amount: '249.99',
      currency: 'USD',
      maskedCardLast4: '4242',
    },
    ...overrides,
  };
}

function buildEvaluation(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id: 'decision-1',
    caseId: 'case-1',
    recommendedOutcome: 'HUMAN_REVIEW_REQUIRED',
    cardMemberScore: 55,
    merchantScore: 50,
    confidence: 55,
    decisionMargin: 5,
    decisionType: 'AUTOMATED_RECOMMENDATION',
    policyVersion: 'prototype-v1',
    modelMetadata: {
      aiDecisionUsed: false,
      deterministicPolicyEngine: true,
      prototypeAssumptions: [{ ruleId: 'PX-GNR-004', description: 'Conflicting delivery details require review.' }],
    },
    explanationData: {
      disputeCategory: 'GOODS_NOT_RECEIVED',
      whatNeededToBeProven: ['Delivery confirmation: proof the package arrived. This is a prototype assumption.'],
      evidenceSubmittedByEachParty: {
        cardMember: [{ evidenceId: 'ev-1', evidenceType: 'non_delivery_statement', finalScore: 70 }],
        merchant: [{ evidenceId: 'ev-2', evidenceType: 'dispatch_record' }],
      },
      verifiedFacts: [{ factType: 'DELIVERY_LOCATION', value: '123 Main St', evidenceId: 'ev-1' }],
      missingEvidence: ['Recipient confirmation'],
      contradictions: [
        {
          factType: 'DELIVERY_LOCATION',
          severity: 'HIGH',
          values: ['123 Main St', '456 Oak Ave'],
          evidenceIds: ['ev-1', 'ev-2'],
          description: 'DELIVERY_LOCATION has conflicting structured values.',
        },
      ],
      appliedRuleIdentifiers: ['PX-GNR-004'],
      recommendedOutcome: 'HUMAN_REVIEW_REQUIRED',
      confidence: 55,
      humanReviewReason: 'unresolved high-severity contradiction is present',
    },
    createdAt: '2026-07-25T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/member/disputes/case-1/decision']}>
      <AuthProvider>
        <Routes>
          <Route path="/member/disputes/:caseId/decision" element={<DecisionExplanationPage />} />
          <Route path="/member/disputes/:caseId" element={<div>Case details page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('DecisionExplanationPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(MEMBER_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
  });

  it('shows an unevaluated state before any decision exists', async () => {
    vi.spyOn(disputesApi, 'getDispute').mockResolvedValue(buildDispute({ status: 'AWAITING_MERCHANT' }));
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockRejectedValue(
      new ApiError({ statusCode: 404, error: 'Not Found', message: 'Evaluation not found', timestamp: '', path: '' }),
    );

    renderPage();

    expect(await screen.findByText('Not yet evaluated')).toBeInTheDocument();
  });

  it('shows an evaluating state while the case is under evaluation', async () => {
    vi.spyOn(disputesApi, 'getDispute').mockResolvedValue(buildDispute({ status: 'UNDER_EVALUATION' }));
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockRejectedValue(
      new ApiError({ statusCode: 404, error: 'Not Found', message: 'Evaluation not found', timestamp: '', path: '' }),
    );

    renderPage();

    expect(await screen.findByText('Evaluation in progress')).toBeInTheDocument();
  });

  it('renders the human-review banner and every required explanation section without raw JSON', async () => {
    vi.spyOn(disputesApi, 'getDispute').mockResolvedValue(buildDispute());
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockResolvedValue(buildEvaluation());

    const { container } = renderPage();

    expect(await screen.findByText('This case needs human review')).toBeInTheDocument();
    expect(screen.getByText(/does not mean either party has already won or lost/i)).toBeInTheDocument();

    expect(screen.getByText(/Goods not received/)).toBeInTheDocument();
    expect(screen.getByText(/Delivery confirmation: proof the package arrived/)).toBeInTheDocument();
    expect(screen.getByText('Non Delivery Statement')).toBeInTheDocument();
    expect(screen.getByText('Dispatch Record')).toBeInTheDocument();
    expect(screen.getByText('Not yet scored')).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
    expect(screen.getByText('Recipient confirmation')).toBeInTheDocument();
    expect(screen.getByText(/conflicting structured values/)).toBeInTheDocument();
    expect(screen.getByText('Prototype rules')).toBeInTheDocument();
    expect(screen.getByText('PX-GNR-004')).toBeInTheDocument();
    expect(screen.getByText('Conflicting delivery details require review.')).toBeInTheDocument();
    expect(screen.getByText(/analyst will review the evidence from both parties/i)).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/[{[]"\w+":/);
  });

  it('renders a resolved automated recommendation without the human-review banner', async () => {
    vi.spyOn(disputesApi, 'getDispute').mockResolvedValue(buildDispute({ status: 'RESOLVED' }));
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockResolvedValue(
      buildEvaluation({
        recommendedOutcome: 'MERCHANT_SUPPORTED',
        confidence: 90,
        decisionMargin: 40,
        explanationData: { ...buildEvaluation().explanationData, recommendedOutcome: 'MERCHANT_SUPPORTED', humanReviewReason: null },
      }),
    );

    renderPage();

    expect(await screen.findByText('Evidence weighed toward the merchant')).toBeInTheDocument();
    expect(screen.queryByText('This case needs human review')).not.toBeInTheDocument();
    expect(screen.getByText(/automated recommendation from the prototype policy engine/i)).toBeInTheDocument();
  });

  it('shows an error state when the case cannot be loaded', async () => {
    vi.spyOn(disputesApi, 'getDispute').mockRejectedValue(
      new ApiError({ statusCode: 404, error: 'Not Found', message: 'Dispute case not found', timestamp: '', path: '' }),
    );
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockRejectedValue(
      new ApiError({ statusCode: 404, error: 'Not Found', message: 'Evaluation not found', timestamp: '', path: '' }),
    );

    renderPage();

    expect(await screen.findByText('Dispute case not found')).toBeInTheDocument();
  });
});
