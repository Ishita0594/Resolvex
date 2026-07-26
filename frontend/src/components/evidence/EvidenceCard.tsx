import { useState } from 'react';
import { getEvidenceDownloadUrl } from '../../api/evidence';
import { ErrorAlert } from '../common/ErrorAlert';
import { EvidenceStatusBadge } from '../common/StatusBadge';
import type { EvidenceItem } from '../../types/domain';
import { formatDateTime, formatFileSize, humanizeLabel } from '../../utils/format';
import { submitErrorMessage } from '../../utils/apiError';

interface EvidenceCardProps {
  evidence: EvidenceItem;
  submittedByLabel: string;
  canDelete: boolean;
  deleteBlockedReason?: string | null;
  isDeleting?: boolean;
  onDelete: (evidenceId: string) => void;
}

export function EvidenceCard({
  evidence,
  submittedByLabel,
  canDelete,
  deleteBlockedReason,
  isDeleting = false,
  onDelete,
}: EvidenceCardProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handlePreview() {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const target = await getEvidenceDownloadUrl(evidence.id);
      window.open(target.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDownloadError(submitErrorMessage(err, 'Unable to open this file right now.'));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="rx-card p-3 mb-3">
      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
        <div className="min-width-0">
          <p className="mb-1 fw-semibold text-truncate">{evidence.fileName}</p>
          <p className="text-muted small mb-1">{humanizeLabel(evidence.evidenceType)}</p>
          <p className="text-muted small mb-0">
            Submitted by {submittedByLabel} &bull; {formatDateTime(evidence.createdAt)} &bull; {formatFileSize(evidence.sizeBytes)}
          </p>
        </div>
        <EvidenceStatusBadge status={evidence.processingStatus} />
      </div>

      {downloadError ? (
        <div className="mt-2">
          <ErrorAlert message={downloadError} />
        </div>
      ) : null}

      <div className="d-flex align-items-center gap-2 mt-3">
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={handlePreview} disabled={isDownloading}>
          <i className="bi bi-eye me-1" aria-hidden="true" />
          {isDownloading ? 'Opening…' : 'Preview / download'}
        </button>

        {isConfirmingDelete ? (
          <>
            <span className="small text-danger">Delete this evidence?</span>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => onDelete(evidence.id)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setIsConfirmingDelete(false)}
              disabled={isDeleting}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => setIsConfirmingDelete(true)}
            disabled={!canDelete}
            title={canDelete ? undefined : deleteBlockedReason ?? undefined}
          >
            <i className="bi bi-trash me-1" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>

      {!canDelete && deleteBlockedReason ? <p className="text-muted small mb-0 mt-2">{deleteBlockedReason}</p> : null}
    </div>
  );
}
