import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceMatrix } from './EvidenceMatrix';
import type { EvidenceMatrixResponse, EvidenceMatrixScore } from '../../types/domain';

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

function buildMatrix(overrides: Partial<EvidenceMatrixResponse> = {}): EvidenceMatrixResponse {
  return {
    caseId: 'case-1',
    policyVersion: 'prototype-v1',
    disputeCategory: 'GOODS_NOT_RECEIVED',
    requirements: [
      {
        requirementId: 'req-1',
        requirementKey: 'delivery_confirmation',
        requirementName: 'Delivery confirmation',
        isMandatory: true,
        evaluated: true,
        evidenceScores: [buildScore()],
      },
      {
        requirementId: 'req-2',
        requirementKey: 'refund_reference',
        requirementName: 'Refund reference',
        isMandatory: true,
        evaluated: true,
        evidenceScores: [],
      },
      {
        requirementId: 'req-3',
        requirementKey: 'recipient_confirmation',
        requirementName: 'Recipient confirmation',
        isMandatory: false,
        evaluated: true,
        evidenceScores: [
          buildScore({
            evidenceId: 'contradicting-evidence',
            evidenceType: 'recipient_statement',
            submittedByRole: 'CARD_MEMBER',
            supportDirection: 'CONTRADICTORY',
          }),
        ],
      },
    ],
    ...overrides,
  };
}

describe('EvidenceMatrix', () => {
  it('shows a loading skeleton while loading', () => {
    render(<EvidenceMatrix matrix={null} isLoading error={null} />);
    expect(screen.getByRole('status', { name: 'Loading evidence matrix' })).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', () => {
    const onRetryLoad = vi.fn();
    render(<EvidenceMatrix matrix={null} isLoading={false} error={{ message: 'Boom', variant: 'error' }} onRetryLoad={onRetryLoad} />);
    expect(screen.getByText('Boom')).toBeInTheDocument();
    screen.getByRole('button', { name: /try again/i }).click();
    expect(onRetryLoad).toHaveBeenCalled();
  });

  it('shows an empty state when there are no requirements', () => {
    render(<EvidenceMatrix matrix={buildMatrix({ requirements: [] })} isLoading={false} error={null} />);
    expect(screen.getByText('No policy requirements configured')).toBeInTheDocument();
  });

  it('renders each requirement row with card-member and merchant columns', () => {
    render(<EvidenceMatrix matrix={buildMatrix()} isLoading={false} error={null} />);

    expect(screen.getByText('Card member evidence')).toBeInTheDocument();
    expect(screen.getByText('Policy requirement')).toBeInTheDocument();
    expect(screen.getByText('Merchant evidence')).toBeInTheDocument();
    expect(screen.getByText('Delivery confirmation')).toBeInTheDocument();
    expect(screen.getByText('Refund reference')).toBeInTheDocument();
    expect(screen.getByText('Delivery Confirmation')).toBeInTheDocument();
    expect(screen.getByText('90/100')).toBeInTheDocument();
  });

  it('displays missing evidence clearly', () => {
    render(<EvidenceMatrix matrix={buildMatrix()} isLoading={false} error={null} />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.getAllByText('No evidence submitted').length).toBeGreaterThan(0);
  });

  it('displays contradictory evidence clearly', () => {
    render(<EvidenceMatrix matrix={buildMatrix()} isLoading={false} error={null} />);
    expect(screen.getByText('Contradictory')).toBeInTheDocument();
    expect(screen.getByText('Contradicts other evidence')).toBeInTheDocument();
  });

  it('wraps the table in a responsive scroll container', () => {
    const { container } = render(<EvidenceMatrix matrix={buildMatrix()} isLoading={false} error={null} />);
    expect(container.querySelector('.table-responsive')).toBeInTheDocument();
  });

  it('never renders raw JSON', () => {
    const { container } = render(<EvidenceMatrix matrix={buildMatrix()} isLoading={false} error={null} />);
    expect(container.textContent).not.toMatch(/[{[]"\w+":/);
  });
});
