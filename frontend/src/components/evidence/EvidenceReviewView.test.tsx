import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceReviewView } from './EvidenceReviewView';
import * as evidenceApi from '../../api/evidence';
import type { EvidenceItem, ExtractedFact } from '../../types/domain';

function buildFact(overrides: Partial<ExtractedFact> = {}): ExtractedFact {
  return {
    id: 'fact-1',
    evidenceId: 'evidence-1',
    factType: 'REFUND_AMOUNT',
    factValue: '49.99',
    normalizedValue: '49.99 USD',
    confidence: 0.91,
    sourcePage: 2,
    verifiedByUser: false,
    correctedByUser: false,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function buildEvidence(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: 'evidence-1',
    caseId: 'case-1',
    submittedByUserId: 'member-1',
    submittedByRole: 'CARD_MEMBER',
    evidenceType: 'receipt',
    fileName: 'proof.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    fileHash: 'a'.repeat(64),
    processingStatus: 'PROCESSED',
    extractionConfidence: 0.9,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    facts: [buildFact()],
    ...overrides,
  };
}

describe('EvidenceReviewView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state', () => {
    render(
      <EvidenceReviewView
        evidence={[]}
        isLoading
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error state', () => {
    render(
      <EvidenceReviewView
        evidence={[]}
        isLoading={false}
        error={{ message: 'Unable to load evidence.', variant: 'error' }}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={vi.fn()}
      />,
    );
    expect(screen.getByText('Unable to load evidence.')).toBeInTheDocument();
  });

  it('renders each processing state', () => {
    (['UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED', 'VERIFIED'] as const).forEach((status) => {
      const { unmount } = render(
        <EvidenceReviewView
          evidence={[buildEvidence({ processingStatus: status })]}
          isLoading={false}
          currentUserId="someone-else"
          currentUserRole="MERCHANT"
          onEvidenceUpdated={vi.fn()}
        />,
      );
      const labels: Record<typeof status, string> = {
        UPLOADED: 'Waiting to process',
        PROCESSING: 'Processing',
        PROCESSED: 'Processed',
        FAILED: 'Failed',
        VERIFIED: 'Verified',
      };
      expect(screen.getByText(labels[status])).toBeInTheDocument();
      unmount();
    });
  });

  it('renders extracted facts from the evidence data', () => {
    render(
      <EvidenceReviewView
        evidence={[buildEvidence()]}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText('Refund Amount')).toBeInTheDocument();
    expect(screen.getByText('49.99')).toBeInTheDocument();
    expect(screen.getByText('49.99 USD')).toBeInTheDocument();
  });

  it('displays a warning when a fact was extracted with low confidence', () => {
    render(
      <EvidenceReviewView
        evidence={[buildEvidence({ facts: [buildFact({ confidence: 0.35 })] })]}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={vi.fn()}
      />,
    );

    expect(screen.getByText(/extracted with low confidence and should be reviewed/i)).toBeInTheDocument();
  });

  it('does not show a low-confidence warning when every fact scores well', () => {
    render(
      <EvidenceReviewView
        evidence={[buildEvidence({ facts: [buildFact({ confidence: 0.95 })] })]}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={vi.fn()}
      />,
    );

    expect(screen.queryByText(/should be reviewed/i)).not.toBeInTheDocument();
  });

  it('hides the edit action for evidence submitted by the other party', () => {
    render(
      <EvidenceReviewView
        evidence={[buildEvidence({ submittedByUserId: 'merchant-1', submittedByRole: 'MERCHANT' })]}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('sends a correction request and reports the updated evidence once confirmed', async () => {
    const correctedFact = buildFact({ factValue: 'Corrected value', verifiedByUser: true, correctedByUser: true });
    const replaceSpy = vi
      .spyOn(evidenceApi, 'replaceEvidenceFacts')
      .mockResolvedValue(buildEvidence({ facts: [correctedFact] }));
    const onEvidenceUpdated = vi.fn();

    render(
      <EvidenceReviewView
        evidence={[buildEvidence()]}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={onEvidenceUpdated}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    const input = screen.getByLabelText('Corrected value');
    await userEvent.clear(input);
    await userEvent.type(input, 'Corrected value');
    await userEvent.click(screen.getByLabelText(/i have verified this value is correct/i));

    await userEvent.click(screen.getByRole('button', { name: /save correction/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm correction/i }));

    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith(
        'evidence-1',
        expect.arrayContaining([
          expect.objectContaining({ id: 'fact-1', factValue: 'Corrected value', verifiedByUser: true, correctedByUser: true }),
        ]),
      ),
    );
    expect(onEvidenceUpdated).toHaveBeenCalledWith(expect.objectContaining({ facts: [correctedFact] }));
  });

  it('shows the fact as verified once the parent re-renders with the updated evidence', () => {
    const { rerender } = render(
      <EvidenceReviewView
        evidence={[buildEvidence({ facts: [buildFact({ verifiedByUser: false })] })]}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();

    rerender(
      <EvidenceReviewView
        evidence={[buildEvidence({ facts: [buildFact({ verifiedByUser: true })] })]}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        onEvidenceUpdated={vi.fn()}
      />,
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });
});
