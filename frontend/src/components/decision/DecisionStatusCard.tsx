import { Link } from 'react-router-dom';
import { ErrorState, type ErrorStateVariant } from '../common/ErrorState';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { EvaluationSummary } from './EvaluationSummary';
import { HumanReviewBanner } from './HumanReviewBanner';
import { getDecisionState } from '../../utils/decisionExplanation';
import type { CaseStatus, DecisionRecord } from '../../types/domain';

interface DecisionStatusCardProps {
  caseStatus: CaseStatus;
  evaluation: DecisionRecord | null;
  isLoading: boolean;
  error?: { message: string; variant: ErrorStateVariant } | null;
  onRetryLoad?: () => void;
  explanationPath: string;
}

/** Compact "at a glance" version of the decision, embedded on case-details pages; the full breakdown lives at explanationPath. */
export function DecisionStatusCard({ caseStatus, evaluation, isLoading, error, onRetryLoad, explanationPath }: DecisionStatusCardProps) {
  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={3} label="Loading decision status" />;
  }

  if (error) {
    return <ErrorState message={error.message} variant={error.variant} onRetry={onRetryLoad} />;
  }

  const state = getDecisionState(caseStatus, evaluation);

  return (
    <div>
      {state === 'UNEVALUATED' ? (
        <p className="text-muted mb-0 small">
          This case hasn&apos;t been evaluated yet. A policy-based recommendation will appear here once evidence review is
          complete.
        </p>
      ) : null}

      {state === 'EVALUATING' ? (
        <p className="text-muted mb-0 small">
          The policy engine is evaluating the evidence submitted for this case. Check back shortly for a recommendation.
        </p>
      ) : null}

      {state === 'HUMAN_REVIEW' ? <HumanReviewBanner reason={evaluation?.explanationData.humanReviewReason ?? null} /> : null}

      {evaluation && (state === 'HUMAN_REVIEW' || state === 'RESOLVED') ? (
        <>
          <EvaluationSummary evaluation={evaluation} />
          <Link to={explanationPath} className="btn btn-sm btn-outline-primary mt-3">
            View full explanation
          </Link>
        </>
      ) : null}
    </div>
  );
}
