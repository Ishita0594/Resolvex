import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDispute } from '../../api/disputes';
import { getMerchantDispute } from '../../api/merchant';
import { useAuth } from '../../auth/AuthContext';
import { AppliedPolicyPanel } from '../../components/decision/AppliedPolicyPanel';
import { EvaluationSummary } from '../../components/decision/EvaluationSummary';
import { HumanReviewBanner } from '../../components/decision/HumanReviewBanner';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useCaseEvaluation } from '../../hooks/useCaseEvaluation';
import { REASON_CODE_LABELS } from '../../types/domain';
import type { DisputeCase, ExplanationEvidenceSummary } from '../../types/domain';
import { getDecisionState, getNextActions } from '../../utils/decisionExplanation';
import { resolveApiError } from '../../utils/apiError';
import { humanizeLabel } from '../../utils/format';

const SEVERITY_TONE: Record<'LOW' | 'HIGH', 'processing' | 'review'> = {
  LOW: 'processing',
  HIGH: 'review',
};

export function DecisionExplanationPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuth();

  const [dispute, setDispute] = useState<DisputeCase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const { evaluation, isLoading: isEvaluationLoading, error: evaluationError, reload: reloadEvaluation } =
    useCaseEvaluation(caseId);

  function loadDispute() {
    if (!caseId || !user) {
      return;
    }
    setIsLoading(true);
    setError(null);
    const request = user.role === 'MERCHANT' ? getMerchantDispute(caseId) : getDispute(caseId);
    request
      .then(setDispute)
      .catch((err) => setError(resolveApiError(err, 'Unable to load this case right now.')))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadDispute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, user?.role]);

  const backPath = user?.role === 'MERCHANT' ? '/merchant/disputes' : '/member/disputes';

  if (isLoading || isEvaluationLoading) {
    return <LoadingSkeleton variant="card" rows={6} label="Loading decision explanation" />;
  }

  if (error || !dispute) {
    return <ErrorState message={error?.message ?? 'Case not found.'} variant={error?.variant ?? 'not-found'} onRetry={loadDispute} />;
  }

  if (evaluationError) {
    return <ErrorState message={evaluationError.message} variant={evaluationError.variant} onRetry={reloadEvaluation} />;
  }

  const state = getDecisionState(dispute.status, evaluation);
  const disputeCategory = evaluation?.explanationData.disputeCategory ?? dispute.reasonCode;
  const nextActions = getNextActions(state, evaluation);

  return (
    <div>
      <Link to={`${backPath}/${dispute.id}`} className="text-decoration-none small fw-semibold mb-3 d-inline-block">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />
        Back to case
      </Link>

      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">Decision explanation</h1>
        <p className="text-muted mb-0">
          Case {dispute.id} &middot; {REASON_CODE_LABELS[disputeCategory]}
        </p>
      </div>

      {state === 'UNEVALUATED' ? (
        <EmptyState
          icon="bi-hourglass-split"
          title="Not yet evaluated"
          description="This case hasn't been evaluated yet. A policy-based recommendation will appear here once evidence review is complete."
        />
      ) : null}

      {state === 'EVALUATING' ? (
        <EmptyState
          icon="bi-hourglass-split"
          title="Evaluation in progress"
          description="The policy engine is weighing the evidence submitted for this case. Check back shortly for a recommendation."
        />
      ) : null}

      {evaluation && (state === 'HUMAN_REVIEW' || state === 'RESOLVED') ? (
        <div className="row g-4">
          <div className="col-lg-7">
            {state === 'HUMAN_REVIEW' ? (
              <div className="mb-4">
                <HumanReviewBanner reason={evaluation.explanationData.humanReviewReason} />
              </div>
            ) : null}

            <div className="rx-card p-4 mb-4">
              <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                Outcome
              </h2>
              <EvaluationSummary evaluation={evaluation} />
            </div>

            <div className="rx-card p-4 mb-4">
              <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                What needed to be proven
              </h2>
              {evaluation.explanationData.whatNeededToBeProven.length === 0 ? (
                <p className="text-muted small mb-0">No policy requirements were configured for this dispute category.</p>
              ) : (
                <ul className="mb-0 ps-3">
                  {evaluation.explanationData.whatNeededToBeProven.map((item, index) => (
                    <li key={index} className="mb-1">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="rx-card p-4 h-100">
                  <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                    Card-member evidence considered
                  </h2>
                  <EvidenceConsideredList items={evaluation.explanationData.evidenceSubmittedByEachParty.cardMember} />
                </div>
              </div>
              <div className="col-md-6">
                <div className="rx-card p-4 h-100">
                  <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                    Merchant evidence considered
                  </h2>
                  <EvidenceConsideredList items={evaluation.explanationData.evidenceSubmittedByEachParty.merchant} />
                </div>
              </div>
            </div>

            <div className="rx-card p-4 mb-4">
              <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                Verified facts
              </h2>
              {evaluation.explanationData.verifiedFacts.length === 0 ? (
                <p className="text-muted small mb-0">No facts have been manually verified for this case yet.</p>
              ) : (
                <ul className="mb-0 ps-3 small">
                  {evaluation.explanationData.verifiedFacts.map((fact, index) => (
                    <li key={index} className="mb-1">
                      <span className="fw-semibold">{humanizeLabel(fact.factType)}:</span> {fact.value}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rx-card p-4 mb-4">
              <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                Missing evidence
              </h2>
              {evaluation.explanationData.missingEvidence.length === 0 ? (
                <p className="text-muted small mb-0">No mandatory evidence is missing.</p>
              ) : (
                <ul className="mb-0 ps-3 small">
                  {evaluation.explanationData.missingEvidence.map((item, index) => (
                    <li key={index} className="mb-1">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rx-card p-4">
              <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                Contradictions
              </h2>
              {evaluation.explanationData.contradictions.length === 0 ? (
                <p className="text-muted small mb-0">No contradictions were found between the evidence submitted.</p>
              ) : (
                <ul className="list-unstyled mb-0 small">
                  {evaluation.explanationData.contradictions.map((item, index) => (
                    <li key={index} className="mb-2">
                      <span className={`rx-badge rx-badge--${SEVERITY_TONE[item.severity]} me-2`}>{humanizeLabel(item.factType)}</span>
                      {item.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="col-lg-5">
            <div className="rx-card p-4 mb-4">
              <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                Applied prototype policy
              </h2>
              <AppliedPolicyPanel
                policyVersion={evaluation.policyVersion}
                appliedRuleIdentifiers={evaluation.explanationData.appliedRuleIdentifiers}
                ruleDescriptions={evaluation.modelMetadata.prototypeAssumptions ?? []}
              />
            </div>

            <div className="rx-card p-4">
              <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
                Next actions
              </h2>
              <ul className="mb-0 ps-3 small">
                {nextActions.map((item, index) => (
                  <li key={index} className="mb-1">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceConsideredList({ items }: { items: ExplanationEvidenceSummary[] }) {
  if (items.length === 0) {
    return <p className="text-muted small mb-0">No evidence was submitted by this party.</p>;
  }

  return (
    <ul className="list-unstyled mb-0 small">
      {items.map((item) => (
        <li key={item.evidenceId} className="mb-1">
          {humanizeLabel(item.evidenceType)}
          <span className="text-muted ms-2">{item.finalScore !== undefined ? `${item.finalScore}/100` : 'Not yet scored'}</span>
        </li>
      ))}
    </ul>
  );
}
