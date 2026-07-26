import { useEffect, useRef, useState } from 'react';
import { getEvidence, processEvidence, retryEvidenceProcessing } from '../../api/evidence';
import type { EvidenceItem, EvidenceProcessingStatus as ProcessingStatusValue } from '../../types/domain';
import { resolveApiError } from '../../utils/apiError';

const STATUS_DISPLAY: Record<ProcessingStatusValue, { label: string; tone: 'neutral' | 'processing' | 'resolved' | 'failed' }> = {
  UPLOADED: { label: 'Waiting to process', tone: 'neutral' },
  PROCESSING: { label: 'Processing', tone: 'processing' },
  PROCESSED: { label: 'Processed', tone: 'resolved' },
  FAILED: { label: 'Failed', tone: 'failed' },
  VERIFIED: { label: 'Verified', tone: 'resolved' },
};

const POLL_INTERVAL_MS = 4000;

interface EvidenceProcessingStatusProps {
  evidence: EvidenceItem;
  /** Whether the current user is the evidence submitter (or an analyst) and may trigger/retry processing. */
  canManage: boolean;
  onUpdated: (evidence: EvidenceItem) => void;
}

export function EvidenceProcessingStatus({ evidence, canManage, onUpdated }: EvidenceProcessingStatusProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const triggeredForId = useRef<string | null>(null);

  useEffect(() => {
    if (!canManage || evidence.processingStatus !== 'UPLOADED' || triggeredForId.current === evidence.id) {
      return;
    }
    triggeredForId.current = evidence.id;
    processEvidence(evidence.id)
      .then(onUpdated)
      .catch((err) => setActionError(resolveApiError(err, 'Unable to start evidence processing.').message));
  }, [canManage, evidence.id, evidence.processingStatus, onUpdated]);

  useEffect(() => {
    if (evidence.processingStatus !== 'PROCESSING') {
      return;
    }
    let cancelled = false;
    const interval = window.setInterval(() => {
      getEvidence(evidence.id)
        .then((updated) => {
          if (!cancelled) {
            onUpdated(updated);
          }
        })
        .catch(() => {
          // A transient poll failure isn't worth surfacing; the next tick (or a manual retry) will recover.
        });
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [evidence.id, evidence.processingStatus, onUpdated]);

  async function handleRetry() {
    setIsRetrying(true);
    setActionError(null);
    try {
      const updated = await retryEvidenceProcessing(evidence.id);
      onUpdated(updated);
    } catch (err) {
      setActionError(resolveApiError(err, 'Unable to retry evidence processing.').message);
    } finally {
      setIsRetrying(false);
    }
  }

  const display = STATUS_DISPLAY[evidence.processingStatus];

  return (
    <div>
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <span className={`rx-badge rx-badge--${display.tone}`}>{display.label}</span>
        {evidence.processingStatus === 'PROCESSING' ? (
          <span className="spinner-border spinner-border-sm text-muted" role="status" aria-label="Processing" />
        ) : null}
        {evidence.processingStatus === 'FAILED' && canManage ? (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleRetry} disabled={isRetrying}>
            {isRetrying ? 'Retrying…' : 'Retry processing'}
          </button>
        ) : null}
      </div>
      {actionError ? (
        <p className="text-danger small mb-0 mt-2" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
