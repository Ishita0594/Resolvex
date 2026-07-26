import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMerchantDispute, getPolicyRequirements, submitMerchantResponse } from '../../api/merchant';
import { listCaseEvidence } from '../../api/evidence';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { CaseStatusBadge } from '../../components/common/StatusBadge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { DeadlineBadge } from '../../components/common/DeadlineBadge';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { PolicyChecklist, type PolicyChecklistEntry } from '../../components/merchant/PolicyChecklist';
import { DecisionStatusCard } from '../../components/decision/DecisionStatusCard';
import { EvidenceList } from '../../components/evidence/EvidenceList';
import { EvidenceReviewView } from '../../components/evidence/EvidenceReviewView';
import { EvidenceUploader } from '../../components/evidence/EvidenceUploader';
import type { EvidenceTypeOption } from '../../constants/evidenceTypes';
import { useCaseEvaluation } from '../../hooks/useCaseEvaluation';
import { useCaseEvent } from '../../realtime/useCaseEvent';
import { useRealtime } from '../../realtime/RealtimeContext';
import { resolveApiError } from '../../utils/apiError';
import { formatDate, humanizeLabel } from '../../utils/format';
import { canSubmitMerchantResponse, isDeadlineExpired } from '../../utils/merchantCase';
import type { CaseEventPayload, DisputeCase, EvidenceItem, PolicyRequirement } from '../../types/domain';
import { REASON_CODE_LABELS } from '../../types/domain';

const STATEMENT_MIN_LENGTH = 10;

export function MerchantCaseDetailsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuth();
  const { subscribeToCase } = useRealtime();

  const [dispute, setDispute] = useState<DisputeCase | null>(null);
  const [requirements, setRequirements] = useState<PolicyRequirement[] | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(true);
  const [evidenceError, setEvidenceError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const { evaluation, isLoading: isEvaluationLoading, error: evaluationError, reload: reloadEvaluation } =
    useCaseEvaluation(caseId);

  const [statement, setStatement] = useState('');
  const [evidenceState, setEvidenceState] = useState<Record<string, PolicyChecklistEntry>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isSubmittingRef = useRef(false);

  const loadCase = useCallback(() => {
    if (!caseId) {
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    Promise.all([getMerchantDispute(caseId), getPolicyRequirements(caseId)])
      .then(([disputeData, requirementsData]) => {
        setDispute(disputeData);
        setRequirements(requirementsData);
      })
      .catch((err) => {
        setLoadError(resolveApiError(err, 'Unable to load this case right now.'));
      })
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
      .catch((err) => {
        setEvidenceError(resolveApiError(err, 'Unable to load evidence for this case right now.'));
      })
      .finally(() => setIsEvidenceLoading(false));
  }, [caseId]);

  useEffect(() => {
    loadCase();
    loadEvidence();
  }, [loadCase, loadEvidence]);

  useEffect(() => {
    if (caseId) {
      subscribeToCase(caseId);
    }
  }, [caseId, subscribeToCase]);

  const handleCaseEvent = useCallback(
    (payload: CaseEventPayload) => {
      if (payload.caseId !== caseId) {
        return;
      }
      loadCase();
      loadEvidence();
      reloadEvaluation();
    },
    [caseId, loadCase, loadEvidence, reloadEvaluation],
  );

  useCaseEvent('case.status.updated', handleCaseEvent);
  useCaseEvent('evidence.processing.completed', handleCaseEvent);
  useCaseEvent('decision.generated', handleCaseEvent);
  useCaseEvent('analyst.review.required', handleCaseEvent);
  useCaseEvent('information.requested', handleCaseEvent);

  const evidenceTypeOptions = useMemo<EvidenceTypeOption[]>(() => {
    const seen = new Map<string, EvidenceTypeOption>();
    (requirements ?? []).forEach((requirement) => {
      requirement.acceptedEvidenceTypes.forEach((type) => {
        if (!seen.has(type)) {
          seen.set(type, { value: type, label: humanizeLabel(type) });
        }
      });
    });
    return Array.from(seen.values());
  }, [requirements]);

  const alreadySubmitted = dispute?.merchantResponseStatus === 'SUBMITTED';
  const canRespond = dispute ? canSubmitMerchantResponse(dispute) : false;
  const deadlineExpired = dispute ? isDeadlineExpired(dispute) : false;

  const missingMandatoryRequirements = useMemo(() => {
    if (!requirements) return [];
    return requirements.filter((requirement) => {
      if (!requirement.isMandatory) return false;
      const entry = evidenceState[requirement.requirementKey];
      return !entry?.evidenceType || !entry.value.trim();
    });
  }, [requirements, evidenceState]);

  function handleEvidenceChange(requirementKey: string, entry: PolicyChecklistEntry) {
    setEvidenceState((current) => ({ ...current, [requirementKey]: entry }));
  }

  function validate(): string | null {
    if (!statement.trim() || statement.trim().length < STATEMENT_MIN_LENGTH) {
      return `Provide a merchant statement of at least ${STATEMENT_MIN_LENGTH} characters.`;
    }
    if (missingMandatoryRequirements.length > 0) {
      const names = missingMandatoryRequirements.map((requirement) => requirement.requirementName).join(', ');
      return `Provide evidence for all mandatory requirements: ${names}.`;
    }
    return null;
  }

  function handleReview() {
    const message = validate();
    if (message) {
      setValidationError(message);
      return;
    }
    setValidationError(null);
    setIsConfirmOpen(true);
  }

  async function handleConfirmSubmit() {
    if (isSubmittingRef.current || !caseId || !requirements) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const evidence = requirements
        .filter((requirement) => isEntryComplete(evidenceState[requirement.requirementKey]))
        .map((requirement) => ({
          requirementKey: requirement.requirementKey,
          evidenceType: evidenceState[requirement.requirementKey].evidenceType,
          value: evidenceState[requirement.requirementKey].value.trim(),
        }));

      const updatedDispute = await submitMerchantResponse(caseId, {
        merchantStatement: statement.trim(),
        evidence,
      });
      setDispute(updatedDispute);
      setIsConfirmOpen(false);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function closeConfirm() {
    if (isSubmitting) {
      return;
    }
    setIsConfirmOpen(false);
  }

  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={6} label="Loading case" />;
  }

  if (loadError || !dispute || !requirements) {
    return (
      <ErrorState message={loadError?.message ?? 'Case not found.'} variant={loadError?.variant ?? 'not-found'} onRetry={loadCase} />
    );
  }

  return (
    <div>
      <Link to="/merchant/disputes" className="text-decoration-none small fw-semibold mb-3 d-inline-block">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />
        Back to cases
      </Link>

      <div className="d-flex align-items-start justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Case against {dispute.transaction.merchantName}</h1>
          <p className="text-muted mb-0">Case {dispute.id}</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          <CaseStatusBadge status={dispute.status} />
          <DeadlineBadge dispute={dispute} />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Transaction details
            </h2>
            <dl className="row mb-0">
              <dt className="col-5 text-muted fw-normal">Amount</dt>
              <dd className="col-7">
                <CurrencyDisplay amount={dispute.transaction.amount} currency={dispute.transaction.currency} />
              </dd>

              <dt className="col-5 text-muted fw-normal">Card</dt>
              <dd className="col-7">&bull;&bull;&bull;&bull; {dispute.transaction.maskedCardLast4}</dd>

              <dt className="col-5 text-muted fw-normal">Dispute category</dt>
              <dd className="col-7">{REASON_CODE_LABELS[dispute.reasonCode]}</dd>

              <dt className="col-5 text-muted fw-normal">Received</dt>
              <dd className="col-7">{formatDate(dispute.createdAt)}</dd>

              <dt className="col-5 text-muted fw-normal">Response deadline</dt>
              <dd className="col-7">{formatDate(dispute.responseDeadline)}</dd>
            </dl>
          </div>

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Card-member statement
            </h2>
            <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
              {dispute.cardMemberStatement}
            </p>
          </div>

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Policy requirement checklist
            </h2>
            <PolicyChecklist
              requirements={requirements}
              values={evidenceState}
              onChange={handleEvidenceChange}
              readOnly={!canRespond}
              submitted={alreadySubmitted}
            />
          </div>

          <div className="rx-card p-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Merchant response
            </h2>

            {alreadySubmitted ? (
              <>
                <p className="text-muted small mb-2">
                  Response submitted {dispute.merchantResponseDate ? formatDate(dispute.merchantResponseDate) : ''}. A final
                  response has already been recorded for this case and cannot be resubmitted.
                </p>
                <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {dispute.merchantStatement}
                </p>
              </>
            ) : !canRespond ? (
              <div className="alert alert-warning mb-0" role="alert">
                <i className="bi bi-exclamation-triangle me-2" aria-hidden="true" />
                {deadlineExpired
                  ? 'The response deadline for this case has passed. You can no longer submit a response.'
                  : `This case is not currently awaiting a merchant response (status: ${dispute.status}).`}
              </div>
            ) : (
              <>
                {validationError ? (
                  <div className="alert alert-danger py-2" role="alert">
                    {validationError}
                  </div>
                ) : null}

                <div className="mb-3">
                  <label htmlFor="merchant-statement" className="form-label fw-semibold">
                    Your response to the card-member claim
                  </label>
                  <textarea
                    id="merchant-statement"
                    className="form-control"
                    rows={5}
                    value={statement}
                    onChange={(event) => setStatement(event.target.value)}
                    placeholder="Describe your response and reference the evidence provided above."
                    required
                  />
                </div>

                <button type="button" className="btn btn-primary" onClick={handleReview}>
                  Review and submit response
                </button>
              </>
            )}
          </div>
        </div>

        <div className="col-lg-5">
          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Evidence attachments
            </h2>
            {user ? (
              <EvidenceUploader caseId={dispute.id} evidenceTypeOptions={evidenceTypeOptions} onUploaded={loadEvidence} />
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

          <div className="rx-card p-4 mb-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Extracted facts
            </h2>
            {user ? (
              <EvidenceReviewView
                evidence={evidence}
                isLoading={isEvidenceLoading}
                error={evidenceError}
                onRetryLoad={loadEvidence}
                currentUserId={user.id}
                currentUserRole={user.role}
                onEvidenceUpdated={(updated) =>
                  setEvidence((current) => current.map((item) => (item.id === updated.id ? updated : item)))
                }
              />
            ) : null}
          </div>

          <div className="rx-card p-4">
            <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
              Decision &amp; explanation
            </h2>
            <DecisionStatusCard
              caseStatus={dispute.status}
              evaluation={evaluation}
              isLoading={isEvaluationLoading}
              error={evaluationError}
              onRetryLoad={reloadEvaluation}
              explanationPath={`/merchant/disputes/${dispute.id}/decision`}
            />
          </div>
        </div>
      </div>

      {isConfirmOpen ? (
        <div className="modal d-block" role="dialog" aria-modal="true" style={{ background: 'rgba(10, 31, 68, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">Confirm your response</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeConfirm} disabled={isSubmitting} />
              </div>
              <div className="modal-body">
                {submitError ? (
                  <div className="alert alert-danger py-2" role="alert">
                    {submitError}
                  </div>
                ) : null}
                <p className="text-muted small mb-2">
                  Once submitted, this response is final and cannot be resubmitted or edited.
                </p>
                <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {statement.trim()}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={closeConfirm} disabled={isSubmitting}>
                  Go back
                </button>
                <button type="button" className="btn btn-primary" onClick={handleConfirmSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                      Submitting&hellip;
                    </>
                  ) : (
                    'Confirm and submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isEntryComplete(entry: PolicyChecklistEntry | undefined): boolean {
  return Boolean(entry?.evidenceType && entry.value.trim().length > 0);
}
