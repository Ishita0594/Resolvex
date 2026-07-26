import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceList } from './EvidenceList';
import * as evidenceApi from '../../api/evidence';
import type { EvidenceItem } from '../../types/domain';

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
    processingStatus: 'UPLOADED',
    extractionConfidence: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    facts: [],
    ...overrides,
  };
}

describe('EvidenceList', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state', () => {
    render(
      <EvidenceList
        evidence={[]}
        isLoading
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        caseStatus="AWAITING_MERCHANT"
        onDeleted={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an empty state when there is no evidence', () => {
    render(
      <EvidenceList
        evidence={[]}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        caseStatus="AWAITING_MERCHANT"
        onDeleted={vi.fn()}
      />,
    );
    expect(screen.getByText(/no evidence has been uploaded for this case yet/i)).toBeInTheDocument();
  });

  it('groups evidence by card member and merchant', () => {
    const items = [
      buildEvidence({ id: 'ev-1', submittedByUserId: 'member-1', submittedByRole: 'CARD_MEMBER', fileName: 'member-file.pdf' }),
      buildEvidence({ id: 'ev-2', submittedByUserId: 'merchant-1', submittedByRole: 'MERCHANT', fileName: 'merchant-file.pdf' }),
    ];

    render(
      <EvidenceList
        evidence={items}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        caseStatus="AWAITING_MERCHANT"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByText('Card-member evidence (1)')).toBeInTheDocument();
    expect(screen.getByText('Merchant evidence (1)')).toBeInTheDocument();
    expect(screen.getByText('member-file.pdf')).toBeInTheDocument();
    expect(screen.getByText('merchant-file.pdf')).toBeInTheDocument();
  });

  it('enables delete for the current user\'s own evidence while the case still allows changes', async () => {
    const deleteSpy = vi.spyOn(evidenceApi, 'deleteEvidence').mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    const items = [buildEvidence({ id: 'ev-1', submittedByUserId: 'member-1', submittedByRole: 'CARD_MEMBER' })];

    render(
      <EvidenceList
        evidence={items}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        caseStatus="AWAITING_MERCHANT"
        onDeleted={onDeleted}
      />,
    );

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeEnabled();

    await userEvent.click(deleteButton);
    await userEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('ev-1'));
    expect(onDeleted).toHaveBeenCalledWith('ev-1');
  });

  it('disables delete for evidence submitted by the other party', () => {
    const items = [buildEvidence({ id: 'ev-1', submittedByUserId: 'merchant-1', submittedByRole: 'MERCHANT' })];

    render(
      <EvidenceList
        evidence={items}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        caseStatus="AWAITING_MERCHANT"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(screen.getByText(/only the submitter can delete their own evidence/i)).toBeInTheDocument();
  });

  it('disables delete once the case has moved past evidence-processing statuses', () => {
    const items = [buildEvidence({ id: 'ev-1', submittedByUserId: 'member-1', submittedByRole: 'CARD_MEMBER' })];

    render(
      <EvidenceList
        evidence={items}
        isLoading={false}
        currentUserId="member-1"
        currentUserRole="CARD_MEMBER"
        caseStatus="UNDER_EVALUATION"
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled();
    expect(screen.getByText(/evidence can no longer be deleted once case evaluation has started/i)).toBeInTheDocument();
  });
});
