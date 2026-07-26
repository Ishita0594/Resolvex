import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceProcessingStatus } from './EvidenceProcessingStatus';
import * as evidenceApi from '../../api/evidence';
import type { EvidenceItem, EvidenceProcessingStatus as ProcessingStatusValue } from '../../types/domain';

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

describe('EvidenceProcessingStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const cases: { status: ProcessingStatusValue; label: string }[] = [
    { status: 'UPLOADED', label: 'Waiting to process' },
    { status: 'PROCESSING', label: 'Processing' },
    { status: 'PROCESSED', label: 'Processed' },
    { status: 'FAILED', label: 'Failed' },
    { status: 'VERIFIED', label: 'Verified' },
  ];

  it.each(cases)('renders the $status processing state as "$label"', ({ status, label }) => {
    vi.spyOn(evidenceApi, 'processEvidence').mockResolvedValue(buildEvidence({ processingStatus: status }));
    render(<EvidenceProcessingStatus evidence={buildEvidence({ processingStatus: status })} canManage={false} onUpdated={vi.fn()} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('automatically starts processing uploaded evidence when the current user can manage it', async () => {
    const processSpy = vi.spyOn(evidenceApi, 'processEvidence').mockResolvedValue(buildEvidence({ processingStatus: 'PROCESSING' }));
    const onUpdated = vi.fn();

    render(<EvidenceProcessingStatus evidence={buildEvidence({ processingStatus: 'UPLOADED' })} canManage onUpdated={onUpdated} />);

    await waitFor(() => expect(processSpy).toHaveBeenCalledWith('evidence-1'));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ processingStatus: 'PROCESSING' })));
  });

  it('does not start processing uploaded evidence submitted by the other party', () => {
    const processSpy = vi.spyOn(evidenceApi, 'processEvidence');

    render(<EvidenceProcessingStatus evidence={buildEvidence({ processingStatus: 'UPLOADED' })} canManage={false} onUpdated={vi.fn()} />);

    expect(processSpy).not.toHaveBeenCalled();
  });

  it('shows a retry action for failed processing when authorized, and it triggers a retry request', async () => {
    const retrySpy = vi
      .spyOn(evidenceApi, 'retryEvidenceProcessing')
      .mockResolvedValue(buildEvidence({ processingStatus: 'PROCESSING' }));
    const onUpdated = vi.fn();

    render(<EvidenceProcessingStatus evidence={buildEvidence({ processingStatus: 'FAILED' })} canManage onUpdated={onUpdated} />);

    const retryButton = screen.getByRole('button', { name: /retry processing/i });
    await userEvent.click(retryButton);

    await waitFor(() => expect(retrySpy).toHaveBeenCalledWith('evidence-1'));
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ processingStatus: 'PROCESSING' }));
  });

  it('hides the retry action for failed processing when the user is not authorized', () => {
    render(<EvidenceProcessingStatus evidence={buildEvidence({ processingStatus: 'FAILED' })} canManage={false} onUpdated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /retry processing/i })).not.toBeInTheDocument();
  });

  it('polls for updates while processing is in progress', async () => {
    vi.useFakeTimers();
    const getSpy = vi.spyOn(evidenceApi, 'getEvidence').mockResolvedValue(buildEvidence({ processingStatus: 'PROCESSED' }));
    const onUpdated = vi.fn();

    render(<EvidenceProcessingStatus evidence={buildEvidence({ processingStatus: 'PROCESSING' })} canManage onUpdated={onUpdated} />);

    await vi.advanceTimersByTimeAsync(4000);

    expect(getSpy).toHaveBeenCalledWith('evidence-1');
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ processingStatus: 'PROCESSED' }));
  });
});
