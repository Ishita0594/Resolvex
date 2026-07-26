import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AnalystCasePage } from './AnalystCasePage';
import * as analystApi from '../../api/analyst';
import * as disputesApi from '../../api/disputes';
import * as evaluationApi from '../../api/evaluation';
import * as evidenceApi from '../../api/evidence';
import * as authApi from '../../api/auth';
import { AuthProvider } from '../../auth/AuthContext';
import { RealtimeProvider } from '../../realtime/RealtimeContext';
import type { AnalystCaseDetail, DecisionRecord, EvidenceMatrixResponse } from '../../types/domain';

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    io: { on: vi.fn(), off: vi.fn() },
  }),
}));

const ANALYST_USER = { id: 'analyst-1', name: 'Rae Analyst', email: 'analyst@resolvex.demo', role: 'ANALYST' as const };

function buildCaseDetail(overrides: Partial<AnalystCaseDetail> = {}): AnalystCaseDetail {
  return {
    id: 'case-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    status: 'HUMAN_REVIEW',
    cardMemberId: 'member-1',
    merchantId: 'merchant-1',
    merchantName: 'Northstar Electronics',
    amount: '249.99',
    currency: 'USD',
    latestRecommendation: 'HUMAN_REVIEW_REQUIRED',
    latestConfidence: 62,
    latestDecisionMargin: 8,
    latestEscalationReason: 'unresolved high-severity contradiction is present',
    responseDeadline: '2026-08-05T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z',
    cardMemberStatement: 'The package never arrived at my address.',
    merchantStatement: 'We shipped the package on time with tracking.',
    latestExplanation: null,
    reviews: [],
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
    confidence: 62,
    decisionMargin: 8,
    decisionType: 'AUTOMATED_RECOMMENDATION',
    policyVersion: 'prototype-v1',
    modelMetadata: { aiDecisionUsed: false, deterministicPolicyEngine: true, prototypeAssumptions: [] },
    explanationData: {
      disputeCategory: 'GOODS_NOT_RECEIVED',
      whatNeededToBeProven: [],
      evidenceSubmittedByEachParty: { cardMember: [], merchant: [] },
      verifiedFacts: [],
      missingEvidence: ['Recipient confirmation'],
      contradictions: [
        {
          factType: 'DELIVERY_LOCATION',
          severity: 'HIGH',
          values: ['123 Main St', '456 Oak Ave'],
          evidenceIds: [],
          description: 'DELIVERY_LOCATION has conflicting structured values.',
        },
      ],
      appliedRuleIdentifiers: [],
      recommendedOutcome: 'HUMAN_REVIEW_REQUIRED',
      confidence: 62,
      humanReviewReason: 'unresolved high-severity contradiction is present',
    },
    createdAt: '2026-07-24T00:00:00.000Z',
    ...overrides,
  };
}

function buildMatrix(): EvidenceMatrixResponse {
  return { caseId: 'case-1', policyVersion: 'prototype-v1', disputeCategory: 'GOODS_NOT_RECEIVED', requirements: [] };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/analyst/cases/case-1']}>
      <AuthProvider>
        <RealtimeProvider>
          <Routes>
            <Route path="/analyst/cases/:caseId" element={<AnalystCasePage />} />
            <Route path="/analyst/queue" element={<div>Queue page</div>} />
          </Routes>
        </RealtimeProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AnalystCasePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(ANALYST_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
    vi.spyOn(evidenceApi, 'listCaseEvidence').mockResolvedValue([]);
    vi.spyOn(evaluationApi, 'getEvidenceMatrix').mockResolvedValue(buildMatrix());
    vi.spyOn(disputesApi, 'getCaseAuditLog').mockResolvedValue([]);
  });

  it('shows the card-member claim, merchant response, system recommendation, and decision actions', async () => {
    vi.spyOn(analystApi, 'getAnalystCase').mockResolvedValue(buildCaseDetail());
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockResolvedValue(buildEvaluation());

    renderPage();

    expect(await screen.findByText('The package never arrived at my address.')).toBeInTheDocument();
    expect(screen.getByText('We shipped the package on time with tracking.')).toBeInTheDocument();
    expect(screen.getByText('This case needs human review')).toBeInTheDocument();
    expect(screen.getByText('Recipient confirmation')).toBeInTheDocument();
    expect(screen.getByText(/conflicting structured values/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /support card member/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /escalate/i })).toBeEnabled();
  });

  it('shows an honest message when the merchant has not responded yet', async () => {
    vi.spyOn(analystApi, 'getAnalystCase').mockResolvedValue(buildCaseDetail({ merchantStatement: null }));
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockResolvedValue(buildEvaluation());

    renderPage();

    expect(await screen.findByText('The merchant has not responded yet.')).toBeInTheDocument();
  });

  it('disables decision actions once the case is already resolved', async () => {
    vi.spyOn(analystApi, 'getAnalystCase').mockResolvedValue(
      buildCaseDetail({ status: 'RESOLVED', latestRecommendation: 'MERCHANT_SUPPORTED' }),
    );
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockResolvedValue(
      buildEvaluation({ recommendedOutcome: 'MERCHANT_SUPPORTED', decisionType: 'HUMAN_DECISION' }),
    );

    renderPage();

    expect(await screen.findByText(/can no longer be decided/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /support card member/i })).toBeDisabled();
  });

  it('links back to the review queue', async () => {
    vi.spyOn(analystApi, 'getAnalystCase').mockResolvedValue(buildCaseDetail());
    vi.spyOn(evaluationApi, 'getLatestEvaluation').mockResolvedValue(buildEvaluation());

    renderPage();

    expect(await screen.findByRole('link', { name: /back to queue/i })).toHaveAttribute('href', '/analyst/queue');
  });
});
