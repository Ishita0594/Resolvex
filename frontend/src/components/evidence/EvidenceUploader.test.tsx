import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceUploader } from './EvidenceUploader';
import { EvidenceList } from './EvidenceList';
import * as evidenceApi from '../../api/evidence';
import { ApiError } from '../../api/client';
import type { EvidenceItem, EvidenceUploadTarget } from '../../types/domain';

const EVIDENCE_TYPE_OPTIONS = [{ value: 'receipt', label: 'Receipt' }];

const UPLOAD_TARGET: EvidenceUploadTarget = {
  evidenceId: 'evidence-1',
  uploadUrl: 'http://localhost:3000/api/evidence/evidence-1/local-upload',
  method: 'POST',
  headers: {},
  fields: { fileField: 'file' },
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

function pdfFile(name = 'proof.pdf', sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: 'application/pdf' });
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
    sizeBytes: 1024,
    fileHash: 'a'.repeat(64),
    processingStatus: 'UPLOADED',
    extractionConfidence: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    facts: [],
    ...overrides,
  };
}

async function selectFile(file: File) {
  const input = screen.getByLabelText('Choose evidence file') as HTMLInputElement;
  await userEvent.upload(input, file);
}

async function selectEvidenceType() {
  await userEvent.selectOptions(screen.getByLabelText('Evidence type'), 'receipt');
}

describe('EvidenceUploader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads a valid selected file through the upload-target/confirm flow', async () => {
    const createSpy = vi.spyOn(evidenceApi, 'createEvidenceUploadTarget').mockResolvedValue(UPLOAD_TARGET);
    const uploadSpy = vi.spyOn(evidenceApi, 'uploadEvidenceFile').mockResolvedValue({ fileHash: 'a'.repeat(64) });
    const confirmSpy = vi.spyOn(evidenceApi, 'confirmEvidenceUpload').mockResolvedValue(buildEvidence());
    const onUploaded = vi.fn();

    render(<EvidenceUploader caseId="case-1" evidenceTypeOptions={EVIDENCE_TYPE_OPTIONS} onUploaded={onUploaded} />);

    await selectEvidenceType();
    await selectFile(pdfFile());

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith('case-1', {
      evidenceType: 'receipt',
      fileName: 'proof.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(uploadSpy).toHaveBeenCalled();
    expect(confirmSpy).toHaveBeenCalledWith('case-1', { evidenceId: 'evidence-1', fileHash: 'a'.repeat(64) });
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
  });

  it('rejects an unsupported file type dropped onto the dropzone before any network call', async () => {
    // Simulated via drag-and-drop rather than the file input: a native file picker constrained by
    // `accept` can't produce a mismatched file, but drag-and-drop can, so this is the realistic path
    // for exercising client-side type rejection.
    const createSpy = vi.spyOn(evidenceApi, 'createEvidenceUploadTarget');

    render(<EvidenceUploader caseId="case-1" evidenceTypeOptions={EVIDENCE_TYPE_OPTIONS} onUploaded={vi.fn()} />);
    await selectEvidenceType();

    const dropzone = screen.getByRole('button', { name: /drop evidence files here or choose files/i });
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [textFile] } });

    expect(await screen.findByText(/only pdf, png, jpg, and jpeg files are supported/i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('rejects an oversized file before any network call', async () => {
    const createSpy = vi.spyOn(evidenceApi, 'createEvidenceUploadTarget');

    render(
      <EvidenceUploader caseId="case-1" evidenceTypeOptions={EVIDENCE_TYPE_OPTIONS} maxSizeBytes={100} onUploaded={vi.fn()} />,
    );
    await selectEvidenceType();
    await selectFile(pdfFile('big.pdf', 200));

    expect(await screen.findByText(/exceeds the 100 B size limit/i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('shows upload progress while the file transfers', async () => {
    vi.spyOn(evidenceApi, 'createEvidenceUploadTarget').mockResolvedValue(UPLOAD_TARGET);
    let resolveUpload: (value: { fileHash?: string }) => void = () => {};
    vi.spyOn(evidenceApi, 'uploadEvidenceFile').mockImplementation(
      (_target, _file, options) =>
        new Promise((resolve) => {
          options?.onProgress?.(42);
          resolveUpload = resolve;
        }),
    );
    vi.spyOn(evidenceApi, 'confirmEvidenceUpload').mockResolvedValue(buildEvidence());

    render(<EvidenceUploader caseId="case-1" evidenceTypeOptions={EVIDENCE_TYPE_OPTIONS} onUploaded={vi.fn()} />);
    await selectEvidenceType();
    await selectFile(pdfFile());

    const progressBar = await screen.findByRole('progressbar');
    await waitFor(() => expect(progressBar).toHaveAttribute('aria-valuenow', '42'));

    resolveUpload({ fileHash: 'a'.repeat(64) });
    await waitFor(() => expect(screen.getByText('Uploaded')).toBeInTheDocument());
  });

  it('allows retrying a failed upload caused by a recoverable network/server error', async () => {
    vi.spyOn(evidenceApi, 'createEvidenceUploadTarget')
      .mockRejectedValueOnce(
        new ApiError({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Temporary failure, try again.',
          timestamp: new Date().toISOString(),
          path: '/api/disputes/case-1/evidence/upload-target',
        }),
      )
      .mockResolvedValueOnce(UPLOAD_TARGET);
    vi.spyOn(evidenceApi, 'uploadEvidenceFile').mockResolvedValue({ fileHash: 'a'.repeat(64) });
    const confirmSpy = vi.spyOn(evidenceApi, 'confirmEvidenceUpload').mockResolvedValue(buildEvidence());

    render(<EvidenceUploader caseId="case-1" evidenceTypeOptions={EVIDENCE_TYPE_OPTIONS} onUploaded={vi.fn()} />);
    await selectEvidenceType();
    await selectFile(pdfFile());

    expect(await screen.findByText('Temporary failure, try again.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
  });

  it('shows a confirmed upload in the evidence list once the parent refreshes it', async () => {
    vi.spyOn(evidenceApi, 'createEvidenceUploadTarget').mockResolvedValue(UPLOAD_TARGET);
    vi.spyOn(evidenceApi, 'uploadEvidenceFile').mockResolvedValue({ fileHash: 'a'.repeat(64) });
    vi.spyOn(evidenceApi, 'confirmEvidenceUpload').mockResolvedValue(buildEvidence());

    function Harness() {
      const [items, setItems] = useState<EvidenceItem[]>([]);
      return (
        <div>
          <EvidenceUploader
            caseId="case-1"
            evidenceTypeOptions={EVIDENCE_TYPE_OPTIONS}
            onUploaded={(evidence) => setItems((current) => [...current, evidence])}
          />
          <EvidenceList
            evidence={items}
            isLoading={false}
            currentUserId="member-1"
            currentUserRole="CARD_MEMBER"
            caseStatus="AWAITING_MERCHANT"
            onDeleted={() => {}}
          />
        </div>
      );
    }

    render(<Harness />);
    await selectEvidenceType();
    await selectFile(pdfFile());

    expect(await screen.findByText('Card-member evidence (1)')).toBeInTheDocument();
  });
});
