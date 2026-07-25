import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDispute, getDisputeTimeline } from '../../api/disputes';
import { listCaseEvidence } from '../../api/evidence';
import { useAuth } from '../../auth/AuthContext';
import { CaseStatusBadge } from '../../components/common/StatusBadge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { CaseTimeline } from '../../components/disputes/CaseTimeline';
import { EvidenceList } from '../../components/evidence/EvidenceList';
import { EvidenceUploader } from '../../components/evidence/EvidenceUploader';
import { CARD_MEMBER_EVIDENCE_TYPE_OPTIONS } from '../../constants/evidenceTypes';
import { resolveApiError } from '../../utils/apiError';
import { REASON_CODE_LABELS } from '../../types/domain';
import type { DisputeCase, EvidenceItem, TimelineEvent } from '../../types/domain';
import { formatDate } from '../../utils/format';

export function CaseDetailsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuth();

  const [dispute, setDispute] = useState<DisputeCase | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  function loadCase() {
    if (!caseId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    Promise.all([getDispute(caseId), getDisputeTimeline(caseId)])
      .then(([disputeData, timelineData]) => {
        setDispute(disputeData);
        setTimeline(timelineData);
      })
      .catch((err) => {
        setError(resolveApiError(err, 'Unable to load this case right now.'));
      })
      .finally(() => setIsLoading(false));
  }

  function loadEvidence() {
    if (!caseId) {
      return;
    }
    setIsEvidenceLoading(true);
    setEvidenceError(null);
    listCaseEvidence(caseId)
      .then(setEvidence)
      .catch((err) => {
        setEvidenceError(resolveApiError(err, 'Unable to load evidence for this case right now.'));
      })
      .finally(() => setIsEvidenceLoading(false));
  }

  useEffect(() => {
    loadCase();
    loadEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={6} label="Loading case" />;
  }

  if (error || !dispute) {
    return <ErrorState message={error?.message ?? 'Case not found.'} variant={error?.variant ?? 'not-found'} onRetry={loadCase} />;
  }

  return (
    <div>
      <Link to="/member/disputes" className="text-decoration-none small fw-semibold mb-3 d-inline-block">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />
        Back to disputes
      </Link>

      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">{dispute.transaction.merchantName}</h1>
          <p className="text-muted mb-0">Case {dispute.id}</p>
        </div>
        <CaseStatusBadge status={dispute.status} />
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Case details
            </h2>
            <dl className="row mb-0">
              <dt className="col-5 text-muted fw-normal">Amount</dt>
              <dd className="col-7">
                <CurrencyDisplay amount={dispute.transaction.amount} currency={dispute.transaction.currency} />
              </dd>

              <dt className="col-5 text-muted fw-normal">Card</dt>
              <dd className="col-7">&bull;&bull;&bull;&bull; {dispute.transaction.maskedCardLast4}</dd>

              <dt className="col-5 text-muted fw-normal">Reason</dt>
              <dd className="col-7">{REASON_CODE_LABELS[dispute.reasonCode]}</dd>

              <dt className="col-5 text-muted fw-normal">Submitted</dt>
              <dd className="col-7">{formatDate(dispute.createdAt)}</dd>

              <dt className="col-5 text-muted fw-normal">Merchant response due</dt>
              <dd className="col-7">{formatDate(dispute.responseDeadline)}</dd>

              {dispute.resolvedAt ? (
                <>
                  <dt className="col-5 text-muted fw-normal">Resolved</dt>
                  <dd className="col-7">{formatDate(dispute.resolvedAt)}</dd>
                </>
              ) : null}
            </dl>
          </div>

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Your statement
            </h2>
            <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
              {dispute.cardMemberStatement}
            </p>
          </div>

          {dispute.merchantStatement ? (
            <div className="rx-card p-4 mb-4">
              <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                Merchant response
              </h2>
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                {dispute.merchantStatement}
              </p>
            </div>
          ) : null}

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Evidence
            </h2>
            {user ? (
              <EvidenceUploader
                caseId={dispute.id}
                evidenceTypeOptions={CARD_MEMBER_EVIDENCE_TYPE_OPTIONS}
                onUploaded={loadEvidence}
              />
            ) : null}
            <div className="mt-4">
              {user ? (
                <EvidenceList
                  evidence={evidence}
                  isLoading={isEvidenceLoading}
                  error={evidenceError}
                  onRetryLoad={loadEvidence}
                  currentUserId={user.id}
                  currentUserRole={user.role}
                  caseStatus={dispute.status}
                  onDeleted={(evidenceId) => setEvidence((current) => current.filter((item) => item.id !== evidenceId))}
                />
              ) : null}
            </div>
          </div>

          <div className="rx-card p-4 mb-4 rx-card--placeholder">
            <h2 className="h6 text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>
              Extracted facts
            </h2>
            <p className="text-muted mb-0 small">AI-extracted facts from submitted evidence will be available for review in a later phase.</p>
          </div>

          <div className="rx-card p-4 rx-card--placeholder">
            <h2 className="h6 text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>
              Decision &amp; explanation
            </h2>
            <p className="text-muted mb-0 small">The policy engine&apos;s decision and explanation will appear here in a later phase.</p>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="rx-card p-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Timeline
            </h2>
            <CaseTimeline events={timeline ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
