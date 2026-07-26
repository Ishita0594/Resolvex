import { DECISION_TYPE_LABELS, RECOMMENDED_OUTCOME_LABELS } from '../../types/domain';
import type { DecisionRecord } from '../../types/domain';

const SCORE_MAX = 100;

export function EvaluationSummary({ evaluation }: { evaluation: DecisionRecord }) {
  const confidencePercent = Math.max(0, Math.min(SCORE_MAX, Math.round(evaluation.confidence)));
  const isAutomated = evaluation.recommendedOutcome !== 'HUMAN_REVIEW_REQUIRED';

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <p className="text-muted small mb-1">Recommendation</p>
          <p className="h6 mb-0">{RECOMMENDED_OUTCOME_LABELS[evaluation.recommendedOutcome]}</p>
        </div>
        <span className={`rx-badge rx-badge--${isAutomated ? 'resolved' : 'review'}`}>
          {isAutomated ? 'Automatic recommendation' : 'Human review required'}
        </span>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-sm-6">
          <ScoreBar label="Card member evidence strength" score={evaluation.cardMemberScore} />
        </div>
        <div className="col-sm-6">
          <ScoreBar label="Merchant evidence strength" score={evaluation.merchantScore} />
        </div>
      </div>

      <dl className="row mb-2 small">
        <dt className="col-6 text-muted fw-normal">Decision margin</dt>
        <dd className="col-6">{Math.round(evaluation.decisionMargin)} points</dd>

        <dt className="col-6 text-muted fw-normal">Confidence</dt>
        <dd className="col-6">{confidencePercent}%</dd>

        <dt className="col-6 text-muted fw-normal">Decision type</dt>
        <dd className="col-6">{DECISION_TYPE_LABELS[evaluation.decisionType]}</dd>
      </dl>
      <p className="text-muted small mb-0">
        Confidence reflects how strongly the available evidence favors one side under the prototype policy engine. It is not a
        finding of fact or a legal determination.
      </p>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const clamped = Math.max(0, Math.min(SCORE_MAX, Math.round(score)));
  return (
    <div>
      <p className="small text-muted mb-1">{label}</p>
      <div
        className="progress"
        style={{ height: 8 }}
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={SCORE_MAX}
      >
        <div className="progress-bar" style={{ width: `${clamped}%` }} />
      </div>
      <p className="small mb-0 mt-1">{clamped}/100</p>
    </div>
  );
}
