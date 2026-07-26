import { EmptyState } from '../common/EmptyState';
import { ErrorState, type ErrorStateVariant } from '../common/ErrorState';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { humanizeLabel } from '../../utils/format';
import { getRequirementStatus, scoresForRole, type RequirementStatus } from '../../utils/evidenceMatrix';
import { useIsMobileViewport } from '../../hooks/useMediaQuery';
import type { EvidenceMatrixRequirement, EvidenceMatrixResponse, EvidenceMatrixScore } from '../../types/domain';

const STATUS_TONE: Record<RequirementStatus, 'resolved' | 'processing' | 'neutral' | 'failed' | 'review'> = {
  SUPPORTED: 'resolved',
  PARTIALLY_SUPPORTED: 'processing',
  NOT_SUPPORTED: 'neutral',
  MISSING: 'failed',
  CONTRADICTORY: 'review',
};

const STATUS_LABEL: Record<RequirementStatus, string> = {
  SUPPORTED: 'Supported',
  PARTIALLY_SUPPORTED: 'Partially supported',
  NOT_SUPPORTED: 'Not supported',
  MISSING: 'Missing',
  CONTRADICTORY: 'Contradictory',
};

interface EvidenceMatrixProps {
  matrix: EvidenceMatrixResponse | null;
  isLoading: boolean;
  error?: { message: string; variant: ErrorStateVariant } | null;
  onRetryLoad?: () => void;
}

export function EvidenceMatrix({ matrix, isLoading, error, onRetryLoad }: EvidenceMatrixProps) {
  const isMobile = useIsMobileViewport();

  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={4} label="Loading evidence matrix" />;
  }

  if (error) {
    return <ErrorState message={error.message} variant={error.variant} onRetry={onRetryLoad} />;
  }

  if (!matrix || matrix.requirements.length === 0) {
    return (
      <EmptyState
        icon="bi-grid-3x3-gap"
        title="No policy requirements configured"
        description="There is nothing to compare for this dispute category yet."
      />
    );
  }

  if (isMobile) {
    return (
      <div className="rx-card p-3">
        {matrix.requirements.map((requirement) => (
          <EvidenceMatrixCard key={requirement.requirementId} requirement={requirement} />
        ))}
      </div>
    );
  }

  return (
    <div className="rx-card p-0">
      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Card member evidence</th>
              <th scope="col">Policy requirement</th>
              <th scope="col">Merchant evidence</th>
            </tr>
          </thead>
          <tbody>
            {matrix.requirements.map((requirement) => (
              <EvidenceMatrixRow key={requirement.requirementId} requirement={requirement} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EvidenceMatrixRow({ requirement }: { requirement: EvidenceMatrixRequirement }) {
  const status = getRequirementStatus(requirement);
  const cardMemberScores = scoresForRole(requirement, 'CARD_MEMBER');
  const merchantScores = scoresForRole(requirement, 'MERCHANT');

  return (
    <tr>
      <td style={{ minWidth: 200 }}>
        <EvidenceCell scores={cardMemberScores} />
      </td>
      <td style={{ minWidth: 220 }}>
        <p className="fw-semibold mb-1">{requirement.requirementName}</p>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className={`rx-badge rx-badge--${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
          <span className="text-muted small">{requirement.isMandatory ? 'Mandatory' : 'Optional'}</span>
        </div>
      </td>
      <td style={{ minWidth: 200 }}>
        <EvidenceCell scores={merchantScores} />
      </td>
    </tr>
  );
}

function EvidenceMatrixCard({ requirement }: { requirement: EvidenceMatrixRequirement }) {
  const status = getRequirementStatus(requirement);
  const cardMemberScores = scoresForRole(requirement, 'CARD_MEMBER');
  const merchantScores = scoresForRole(requirement, 'MERCHANT');

  return (
    <div className="rx-table-card">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
        <p className="fw-semibold mb-0">{requirement.requirementName}</p>
        <span className={`rx-badge rx-badge--${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
      </div>
      <p className="text-muted small mb-3">{requirement.isMandatory ? 'Mandatory' : 'Optional'}</p>

      <p className="small fw-semibold text-uppercase text-muted mb-1" style={{ letterSpacing: '0.06em' }}>
        Card member evidence
      </p>
      <EvidenceCell scores={cardMemberScores} />

      <p className="small fw-semibold text-uppercase text-muted mb-1 mt-3" style={{ letterSpacing: '0.06em' }}>
        Merchant evidence
      </p>
      <EvidenceCell scores={merchantScores} />
    </div>
  );
}

function EvidenceCell({ scores }: { scores: EvidenceMatrixScore[] }) {
  if (scores.length === 0) {
    return <p className="text-muted small mb-0">No evidence submitted</p>;
  }

  return (
    <ul className="list-unstyled mb-0 small">
      {scores.map((score) => (
        <li key={score.evidenceId} className="mb-1">
          <span>{humanizeLabel(score.evidenceType)}</span>
          {score.supportDirection === 'CONTRADICTORY' ? (
            <span className="rx-badge rx-badge--review ms-2">Contradicts other evidence</span>
          ) : (
            <span className="text-muted ms-2">{score.finalScore}/100</span>
          )}
        </li>
      ))}
    </ul>
  );
}
