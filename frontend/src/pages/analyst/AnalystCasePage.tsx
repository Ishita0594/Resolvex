import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAnalystCase } from '../../api/analyst';
import { getCaseAuditLog } from '../../api/disputes';
import { getEvidenceMatrix } from '../../api/evaluation';
import { listCaseEvidence } from '../../api/evidence';
import { AnalystDecisionPanel } from '../../components/analyst/AnalystDecisionPanel';
import { AppliedPolicyPanel } from '../../components/decision/AppliedPolicyPanel';
import { EvaluationSummary } from '../../components/decision/EvaluationSummary';
import { HumanReviewBanner } from '../../components/decision/HumanReviewBanner';
import { CaseStatusBadge } from '../../components/common/StatusBadge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { EvidenceList } from '../../components/evidence/EvidenceList';
import { EvidenceMatrix } from '../../components/evidence/EvidenceMatrix';
import { EvidenceReviewView } from '../../components/evidence/EvidenceReviewView';
import { useAuth } from '../../auth/AuthContext';
import { useCaseEvaluation } from '../../hooks/useCaseEvaluation';
import { useCaseEvent } from '../../realtime/useCaseEvent';
import { useRealtime } from '../../realtime/RealtimeContext';
import { ANALYST_DECISION_LABELS, CASE_STATUS_LABELS, REASON_CODE_LABELS } from '../../types/domain';
import type { AnalystCaseDetail, AuditLogEntry, CaseEventPayload, EvidenceItem, EvidenceMatrixResponse } from '../../types/domain';
import { getDecisionState } from '../../utils/decisionExplanation';
import { resolveApiError } from '../../utils/apiError';
import { formatDate, formatDateTime, humanizeLabel } from '../../utils/format';

export function AnalystCasePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuth();
  const { subscribeToCase } = useRealtime();

  const [caseDetail, setCaseDetail] = useState<AnalystCaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const [matrix, setMatrix] = useState<EvidenceMatrixResponse | null>(null);
  const [isMatrixLoading, setIsMatrixLoading] = useState(true);
  const [matrixError, setMatrixError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null);
  const [isAuditLoading, setIsAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const { evaluation, isLoading: isEvaluationLoading, error: evaluationError, reload: reloadEvaluation } =
    useCaseEvaluation(caseId);

  const loadCase = useCallback(() => {
    if (!caseId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    getAnalystCase(caseId)
      .then(setCaseDetail)
      .catch((err) => setError(resolveApiError(err, 'Unable to load this case right now.')))
      .finally(() => setIsLoading(false));
  }, [caseId]);

  const loadEvidence = useCallback(() => {
    if (!caseId) {
      return;
    }
    setIsEvidenceLoading(true);
    setEvidenceError(null);
    listCaseEvidence(caseId)
      .then(setEvidence)
      .catch((err) => setEvidenceError(resolveApiError(err, 'Unable to load evidence for this case right now.')))
      .finally(() => setIsEvidenceLoading(false));
  }, [caseId]);

  const loadMatrix = useCallback(() => {
    if (!caseId) {
      return;
    }
    setIsMatrixLoading(true);
    setMatrixError(null);
    getEvidenceMatrix(caseId)
      .then(setMatrix)
      .catch((err) => setMatrixError(resolveApiError(err, 'Unable to load the evidence matrix right now.')))
      .finally(() => setIsMatrixLoading(false));
  }, [caseId]);

  const loadAuditLog = useCallback(() => {
    if (!caseId) {
      return;
    }
    setIsAuditLoading(true);
    setAuditError(null);
    getCaseAuditLog(caseId)
      .then(setAuditLog)
      .catch((err) => setAuditError(resolveApiError(err, 'Unable to load the audit timeline right now.')))
      .finally(() => setIsAuditLoading(false));
  }, [caseId]);

  useEffect(() => {
    loadCase();
    loadEvidence();
    loadMatrix();
    loadAuditLog();
  }, [loadCase, loadEvidence, loadMatrix, loadAuditLog]);

  useEffect(() => {
    if (caseId) {
      subscribeToCase(caseId);
    }
  }, [caseId, subscribeToCase]);

  const refreshAll = useCallback(
    (payload: CaseEventPayload) => {
      if (payload.caseId !== caseId) {
        return;
      }
      loadCase();
      loadEvidence();
      loadMatrix();
      loadAuditLog();
      reloadEvaluation();
    },
    [caseId, loadCase, loadEvidence, loadMatrix, loadAuditLog, reloadEvaluation],
  );

  useCaseEvent('case.status.updated', refreshAll);
  useCaseEvent('evidence.processing.completed', refreshAll);
  useCaseEvent('merchant.response.received', refreshAll);
  useCaseEvent('decision.generated', refreshAll);
  useCaseEvent('information.requested', refreshAll);

  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={6} label="Loading case" />;
  }

  if (error || !caseDetail) {
    return <ErrorState message={error?.message ?? 'Case not found.'} variant={error?.variant ?? 'not-found'} onRetry={loadCase} />;
  }

  const decisionState = getDecisionState(caseDetail.status, evaluation);
  const canDecide = caseDetail.status !== 'CLOSED' && caseDetail.status !== 'RESOLVED';

  return (
    <div>
      <Link to="/analyst/queue" className="text-decoration-none small fw-semibold mb-3 d-inline-block">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />
        Back to queue
      </Link>

      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Case against {caseDetail.merchantName}</h1>
          <p className="text-muted mb-0">
            Case {caseDetail.id} &middot; {REASON_CODE_LABELS[caseDetail.reasonCode]} &middot;{' '}
            <CurrencyDisplay amount={caseDetail.amount} currency={caseDetail.currency} />
          </p>
        </div>
        <CaseStatusBadge status={caseDetail.status} />
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Card-member claim
            </h2>
            <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
              {caseDetail.cardMemberStatement}
            </p>
          </div>

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Merchant response
            </h2>
            {caseDetail.merchantStatement ? (
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                {caseDetail.merchantStatement}
              </p>
            ) : (
              <p className="text-muted small mb-0">The merchant has not responded yet.</p>
            )}
          </div>

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Complete evidence matrix
            </h2>
            <EvidenceMatrix matrix={matrix} isLoading={isMatrixLoading} error={matrixError} onRetryLoad={loadMatrix} />
          </div>

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Uploaded evidence
            </h2>
            <EvidenceList
              evidence={evidence}
              isLoading={isEvidenceLoading}
              error={evidenceError}
              onRetryLoad={loadEvidence}
              currentUserId={user?.id ?? ''}
              currentUserRole="ANALYST"
              caseStatus={caseDetail.status}
              onDeleted={(evidenceId) => setEvidence((current) => current.filter((item) => item.id !== evidenceId))}
            />
          </div>

          <div className="rx-card p-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Extracted &amp; corrected facts
            </h2>
            <EvidenceReviewView
              evidence={evidence}
              isLoading={isEvidenceLoading}
              error={evidenceError}
              onRetryLoad={loadEvidence}
              currentUserId={user?.id ?? ''}
              currentUserRole="ANALYST"
              onEvidenceUpdated={(updated) =>
                setEvidence((current) => current.map((item) => (item.id === updated.id ? updated : item)))
              }
            />
          </div>
        </div>

        <div className="col-lg-5">
          {evaluationError ? (
            <div className="rx-card p-4 mb-4">
              <ErrorState message={evaluationError.message} variant={evaluationError.variant} onRetry={reloadEvaluation} />
            </div>
          ) : null}

          {isEvaluationLoading ? (
            <div className="mb-4">
              <LoadingSkeleton variant="card" rows={3} label="Loading system recommendation" />
            </div>
          ) : null}

          {!isEvaluationLoading && !evaluationError && (decisionState === 'UNEVALUATED' || decisionState === 'EVALUATING') ? (
            <div className="mb-4">
              <EmptyState
                icon="bi-hourglass-split"
                title={decisionState === 'EVALUATING' ? 'Evaluation in progress' : 'Not yet evaluated'}
                description="The policy engine has not produced a recommendation for this case yet."
              />
            </div>
          ) : null}

          {evaluation && (decisionState === 'HUMAN_REVIEW' || decisionState === 'RESOLVED') ? (
            <>
              {decisionState === 'HUMAN_REVIEW' ? (
                <div className="mb-4">
                  <HumanReviewBanner reason={evaluation.explanationData.humanReviewReason} />
                </div>
              ) : null}

              <div className="rx-card p-4 mb-4">
                <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                  System recommendation
                </h2>
                <EvaluationSummary evaluation={evaluation} />
              </div>

              <div className="rx-card p-4 mb-4">
                <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                  Missing requirements
                </h2>
                {evaluation.explanationData.missingEvidence.length === 0 ? (
                  <p className="text-muted small mb-0">No mandatory evidence is missing.</p>
                ) : (
                  <ul className="mb-0 ps-3 small">
                    {evaluation.explanationData.missingEvidence.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rx-card p-4 mb-4">
                <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                  Contradictions
                </h2>
                {evaluation.explanationData.contradictions.length === 0 ? (
                  <p className="text-muted small mb-0">No contradictions were found between the evidence submitted.</p>
                ) : (
                  <ul className="list-unstyled mb-0 small">
                    {evaluation.explanationData.contradictions.map((item, index) => (
                      <li key={index} className="mb-2">
                        <span className="rx-badge rx-badge--review me-2">{humanizeLabel(item.factType)}</span>
                        {item.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rx-card p-4 mb-4">
                <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                  Applied policy
                </h2>
                <AppliedPolicyPanel
                  policyVersion={evaluation.policyVersion}
                  appliedRuleIdentifiers={evaluation.explanationData.appliedRuleIdentifiers}
                  ruleDescriptions={evaluation.modelMetadata.prototypeAssumptions ?? []}
                />
              </div>
            </>
          ) : null}

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Decision
            </h2>
            <AnalystDecisionPanel
              caseId={caseDetail.id}
              latestRecommendation={caseDetail.latestRecommendation}
              disabled={!canDecide}
              disabledReason={
                !canDecide
                  ? `This case is ${CASE_STATUS_LABELS[caseDetail.status].toLowerCase()} and can no longer be decided.`
                  : undefined
              }
              onDecided={() => {
                loadCase();
                loadAuditLog();
                reloadEvaluation();
              }}
            />

            {caseDetail.reviews.length > 0 ? (
              <div className="mt-4">
                <h3 className="h6 text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>
                  Previous reviews
                </h3>
                <ul className="list-unstyled mb-0 small">
                  {caseDetail.reviews.map((review) => (
                    <li key={review.id} className="mb-2 pb-2 border-bottom">
                      <span className="fw-semibold">{ANALYST_DECISION_LABELS[review.analystDecision]}</span>
                      <span className="text-muted"> &middot; {formatDateTime(review.createdAt)}</span>
                      {review.overrideReason ? <p className="mb-0 text-muted">Override: {review.overrideReason}</p> : null}
                      {review.analystNotes ? <p className="mb-0 text-muted">Notes: {review.analystNotes}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="rx-card p-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Audit timeline
            </h2>
            {isAuditLoading ? (
              <LoadingSkeleton variant="card" rows={3} label="Loading audit timeline" />
            ) : auditError ? (
              <ErrorState message={auditError.message} variant={auditError.variant} onRetry={loadAuditLog} />
            ) : !auditLog || auditLog.length === 0 ? (
              <p className="text-muted small mb-0">No analyst actions have been recorded for this case yet.</p>
            ) : (
              <ol className="rx-timeline">
                {auditLog.map((entry) => (
                  <li key={entry.id} className="rx-timeline-item">
                    <span className="rx-timeline-icon">
                      <i className="bi bi-shield-check" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="mb-0 fw-semibold">{humanizeLabel(entry.action)}</p>
                      <p className="mb-0 small text-muted">{formatDate(entry.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
