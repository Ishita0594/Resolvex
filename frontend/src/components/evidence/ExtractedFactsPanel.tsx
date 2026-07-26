import type { ExtractedFact } from '../../types/domain';
import { humanizeLabel } from '../../utils/format';
import { ConfidenceBadge } from './ConfidenceBadge';
import { FactCorrectionForm, type FactCorrectionInput } from './FactCorrectionForm';

interface ExtractedFactsPanelProps {
  facts: ExtractedFact[];
  /** Whether the current user submitted this evidence (or is an analyst) and may edit its facts. */
  canEdit: boolean;
  editingFactId?: string | null;
  submittingFactId?: string | null;
  submitError?: string | null;
  onStartEdit: (factId: string) => void;
  onCancelEdit: () => void;
  onSubmitCorrection: (factId: string, input: FactCorrectionInput) => void;
}

export function ExtractedFactsPanel({
  facts,
  canEdit,
  editingFactId = null,
  submittingFactId = null,
  submitError = null,
  onStartEdit,
  onCancelEdit,
  onSubmitCorrection,
}: ExtractedFactsPanelProps) {
  if (facts.length === 0) {
    return <p className="text-muted small mb-0">No facts have been extracted from this evidence yet.</p>;
  }

  return (
    <ul className="list-unstyled mb-0">
      {facts.map((fact, index) => {
        const isEditing = editingFactId === fact.id;

        return (
          <li key={fact.id} className={`pb-3 mb-3${index === facts.length - 1 ? '' : ' border-bottom'}`}>
            <div className="d-flex justify-content-between align-items-start gap-2 mb-2 flex-wrap">
              <span className="fw-semibold">{humanizeLabel(fact.factType)}</span>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <ConfidenceBadge confidence={fact.confidence} />
                {fact.verifiedByUser ? <span className="rx-badge rx-badge--resolved">Verified</span> : null}
                {fact.correctedByUser ? (
                  <span className="rx-badge rx-badge--submitted">User corrected</span>
                ) : (
                  <span className="rx-badge rx-badge--neutral">AI extracted</span>
                )}
              </div>
            </div>

            {isEditing ? (
              <FactCorrectionForm
                fact={fact}
                isSubmitting={submittingFactId === fact.id}
                submitError={submitError}
                onCancel={onCancelEdit}
                onSubmit={(input) => onSubmitCorrection(fact.id, input)}
              />
            ) : (
              <>
                <dl className="row mb-2 small">
                  <dt className="col-4 text-muted fw-normal">Extracted value</dt>
                  <dd className="col-8">{fact.factValue}</dd>

                  <dt className="col-4 text-muted fw-normal">Normalized value</dt>
                  <dd className="col-8">{fact.normalizedValue ?? <span className="text-muted">Not available</span>}</dd>

                  <dt className="col-4 text-muted fw-normal">Source page</dt>
                  <dd className="col-8">{fact.sourcePage ?? <span className="text-muted">Not available</span>}</dd>
                </dl>

                {canEdit ? (
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onStartEdit(fact.id)}>
                    <i className="bi bi-pencil me-1" aria-hidden="true" />
                    Edit
                  </button>
                ) : null}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
