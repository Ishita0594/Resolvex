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
const MAX_POLL_ATTEMPTS = 15; // ~1 minute of polling before we stop and let the user check manually

interface EvidenceProcessingStatusProps {
  evidence: EvidenceItem;
  /** Whether the current user is the evidence submitter (or an analyst) and may trigger/retry processing. */
  canManage: boolean;
  onUpdated: (evidence: EvidenceItem) => void;
}

export function EvidenceProcessingStatus({ evidence, canManage, onUpdated }: EvidenceProcessingStatusProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCheckingNow, setIsCheckingNow] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
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
    setHasTimedOut(false);
    if (evidence.processingStatus !== 'PROCESSING') {
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        if (!cancelled) {
          setHasTimedOut(true);
        }
        window.clearInterval(interval);
        return;
      }
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
    // onUpdated is intentionally omitted: callers pass a fresh inline function on every render,
    // and including it would restart the poll (and its attempt counter) on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evidence.id, evidence.processingStatus]);

  async function handleCheckNow() {
    setIsCheckingNow(true);
    setActionError(null);
    try {
      const updated = await getEvidence(evidence.id);
      onUpdated(updated);
      if (updated.processingStatus === 'PROCESSING') {
        setHasTimedOut(false);
      }
    } catch (err) {
      setActionError(resolveApiError(err, 'Unable to check the current status right now.').message);
    } finally {
      setIsCheckingNow(false);
    }
  }

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
        {evidence.processingStatus === 'PROCESSING' && !hasTimedOut ? (
          <span className="spinner-border spinner-border-sm text-muted" role="status" aria-label="Processing" />
        ) : null}
        {evidence.processingStatus === 'PROCESSING' && hasTimedOut ? (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleCheckNow} disabled={isCheckingNow}>
            {isCheckingNow ? 'Checking…' : 'Check status now'}
          </button>
        ) : null}
        {evidence.processingStatus === 'FAILED' && canManage ? (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleRetry} disabled={isRetrying}>
            {isRetrying ? 'Retrying…' : 'Retry processing'}
          </button>
        ) : null}
      </div>
      {evidence.processingStatus === 'PROCESSING' && hasTimedOut ? (
        <p className="text-muted small mb-0 mt-2">
          <i className="bi bi-hourglass-split me-1" aria-hidden="true" />
          This is taking longer than expected. We&apos;ve stopped checking automatically &mdash; use &ldquo;Check status
          now&rdquo; to see if it has finished.
        </p>
      ) : null}
      {actionError ? (
        <p className="text-danger small mb-0 mt-2" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
