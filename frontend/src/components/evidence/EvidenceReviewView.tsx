import { useState } from 'react';
import { getEvidenceDownloadUrl, replaceEvidenceFacts } from '../../api/evidence';
import { ErrorAlert } from '../common/ErrorAlert';
import { ErrorState, type ErrorStateVariant } from '../common/ErrorState';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ROLE_LABELS } from '../../auth/roles';
import type { EvidenceItem, UserRole } from '../../types/domain';
import { canModifyEvidenceFacts, getLowConfidenceFacts } from '../../utils/evidenceFacts';
import { resolveApiError } from '../../utils/apiError';
import { formatDateTime, formatFileSize, humanizeLabel } from '../../utils/format';
import { ConfidenceBadge } from './ConfidenceBadge';
import { EvidenceProcessingStatus } from './EvidenceProcessingStatus';
import { ExtractedFactsPanel } from './ExtractedFactsPanel';
import type { FactCorrectionInput } from './FactCorrectionForm';

interface EvidenceReviewViewProps {
  evidence: EvidenceItem[];
  isLoading: boolean;
  error?: { message: string; variant: ErrorStateVariant } | null;
  onRetryLoad?: () => void;
  currentUserId: string;
  currentUserRole: UserRole;
  onEvidenceUpdated: (evidence: EvidenceItem) => void;
}

export function EvidenceReviewView({
  evidence,
  isLoading,
  error,
  onRetryLoad,
  currentUserId,
  currentUserRole,
  onEvidenceUpdated,
}: EvidenceReviewViewProps) {
  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={3} label="Loading extracted facts" />;
  }

  if (error) {
    return <ErrorState message={error.message} variant={error.variant} onRetry={onRetryLoad} />;
  }

  if (evidence.length === 0) {
    return <p className="text-muted small mb-0">No evidence has been uploaded for this case yet.</p>;
  }

  return (
    <div>
      {evidence.map((item) => (
        <EvidenceReviewItem
          key={item.id}
          evidence={item}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onEvidenceUpdated={onEvidenceUpdated}
        />
      ))}
    </div>
  );
}

function EvidenceReviewItem({
  evidence,
  currentUserId,
  currentUserRole,
  onEvidenceUpdated,
}: {
  evidence: EvidenceItem;
  currentUserId: string;
  currentUserRole: UserRole;
  onEvidenceUpdated: (evidence: EvidenceItem) => void;
}) {
  const canEdit = canModifyEvidenceFacts(evidence, currentUserId, currentUserRole);
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [submittingFactId, setSubmittingFactId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const lowConfidenceFacts = getLowConfidenceFacts(evidence.facts);
  const noFactsExtracted = evidence.processingStatus === 'PROCESSED' && evidence.facts.length === 0;
  const hasWarnings = lowConfidenceFacts.length > 0 || noFactsExtracted;

  async function handlePreview() {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const target = await getEvidenceDownloadUrl(evidence.id);
      window.open(target.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setDownloadError(resolveApiError(err, 'Unable to open this file right now.').message);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSubmitCorrection(factId: string, input: FactCorrectionInput) {
    setSubmittingFactId(factId);
    setSubmitError(null);
    try {
      const updatedFacts = evidence.facts.map((fact) =>
        fact.id === factId
          ? {
              ...fact,
              factValue: input.factValue,
              verifiedByUser: input.verifiedByUser,
              correctedByUser: fact.correctedByUser || input.factValue !== fact.factValue,
            }
          : fact,
      );
      const updated = await replaceEvidenceFacts(evidence.id, updatedFacts);
      onEvidenceUpdated(updated);
      setEditingFactId(null);
    } catch (err) {
      setSubmitError(resolveApiError(err, 'Unable to save this correction right now.').message);
    } finally {
      setSubmittingFactId(null);
    }
  }

  return (
    <div className="rx-card p-3 mb-3">
      <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-3">
        <div className="min-width-0">
          <p className="mb-1 fw-semibold text-truncate">{evidence.fileName}</p>
          <p className="text-muted small mb-0">{humanizeLabel(evidence.evidenceType)}</p>
        </div>
        <EvidenceProcessingStatus evidence={evidence} canManage={canEdit} onUpdated={onEvidenceUpdated} />
      </div>

      {hasWarnings ? (
        <div className="alert alert-warning py-2 small" role="alert">
          <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
          <ul className="mb-0 ps-3">
            {noFactsExtracted ? <li>No facts could be extracted from this document.</li> : null}
            {lowConfidenceFacts.map((fact) => (
              <li key={fact.id}>{humanizeLabel(fact.factType)} was extracted with low confidence and should be reviewed.</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-md-5">
          <h4 className="h6 text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>
            Document
          </h4>
          <dl className="row mb-2 small">
            <dt className="col-5 text-muted fw-normal">Submitted by</dt>
            <dd className="col-7">{ROLE_LABELS[evidence.submittedByRole]}</dd>

            <dt className="col-5 text-muted fw-normal">Uploaded</dt>
            <dd className="col-7">{formatDateTime(evidence.createdAt)}</dd>

            <dt className="col-5 text-muted fw-normal">Size</dt>
            <dd className="col-7">{formatFileSize(evidence.sizeBytes)}</dd>

            <dt className="col-5 text-muted fw-normal">Overall confidence</dt>
            <dd className="col-7">
              <ConfidenceBadge confidence={evidence.extractionConfidence} />
            </dd>
          </dl>

          <button type="button" className="btn btn-sm btn-outline-primary" onClick={handlePreview} disabled={isDownloading}>
            <i className="bi bi-eye me-1" aria-hidden="true" />
            {isDownloading ? 'Opening…' : 'Preview / download'}
          </button>
          {downloadError ? (
            <div className="mt-2">
              <ErrorAlert message={downloadError} />
            </div>
          ) : null}
        </div>

        <div className="col-md-7">
          <h4 className="h6 text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>
            Extracted facts
          </h4>
          <ExtractedFactsPanel
            facts={evidence.facts}
            canEdit={canEdit}
            editingFactId={editingFactId}
            submittingFactId={submittingFactId}
            submitError={submitError}
            onStartEdit={setEditingFactId}
            onCancelEdit={() => {
              setEditingFactId(null);
              setSubmitError(null);
            }}
            onSubmitCorrection={handleSubmitCorrection}
          />
        </div>
      </div>
    </div>
  );
}
