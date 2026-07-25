import { useMemo } from 'react';
import type { PolicyRequirement } from '../../types/domain';
import { humanizeLabel } from '../../utils/format';

export interface PolicyChecklistEntry {
  evidenceType: string;
  value: string;
}

interface PolicyChecklistProps {
  requirements: PolicyRequirement[];
  values: Record<string, PolicyChecklistEntry>;
  onChange?: (requirementKey: string, entry: PolicyChecklistEntry) => void;
  /** When true, renders the checklist as read-only reference material with no input controls. */
  readOnly?: boolean;
  /** When true (a final response was already submitted), items show as satisfied rather than needed. */
  submitted?: boolean;
}

function isEntryComplete(entry: PolicyChecklistEntry | undefined): boolean {
  return Boolean(entry?.evidenceType && entry.value.trim().length > 0);
}

export function PolicyChecklist({ requirements, values, onChange, readOnly = false, submitted = false }: PolicyChecklistProps) {
  const sortedRequirements = useMemo(
    () =>
      [...requirements].sort((a, b) => {
        if (a.isMandatory !== b.isMandatory) {
          return a.isMandatory ? -1 : 1;
        }
        return a.requirementName.localeCompare(b.requirementName);
      }),
    [requirements],
  );

  if (sortedRequirements.length === 0) {
    return <p className="text-muted small mb-0">No policy requirements are configured for this dispute reason.</p>;
  }

  return (
    <ul className="list-unstyled mb-0">
      {sortedRequirements.map((requirement, index) => {
        const entry = values[requirement.requirementKey];
        const complete = submitted || isEntryComplete(entry);

        let statusTone: 'resolved' | 'failed' | 'neutral';
        let statusLabel: string;
        if (complete) {
          statusTone = 'resolved';
          statusLabel = submitted ? 'Submitted' : 'Complete';
        } else if (requirement.isMandatory) {
          statusTone = 'failed';
          statusLabel = 'Needed';
        } else {
          statusTone = 'neutral';
          statusLabel = 'Not provided';
        }

        return (
          <li
            key={requirement.id}
            className={`pb-3 mb-3${index === sortedRequirements.length - 1 ? '' : ' border-bottom'}`}
          >
            <div className="d-flex justify-content-between align-items-start gap-2 mb-1 flex-wrap">
              <div>
                <span className="fw-semibold">{requirement.requirementName}</span>
                <span className={`rx-badge ms-2 rx-badge--${requirement.isMandatory ? 'submitted' : 'neutral'}`}>
                  {requirement.isMandatory ? 'Mandatory' : 'Optional'}
                </span>
              </div>
              <span className={`rx-badge rx-badge--${statusTone}`}>{statusLabel}</span>
            </div>

            <p className="text-muted small mb-2">{requirement.description}</p>

            <p className="text-muted small mb-2">
              Accepted evidence: {requirement.acceptedEvidenceTypes.map(humanizeLabel).join(', ')}
            </p>

            {readOnly ? null : (
              <div className="row g-2">
                <div className="col-sm-4">
                  <select
                    className="form-select form-select-sm"
                    aria-label={`Evidence type for ${requirement.requirementName}`}
                    value={entry?.evidenceType ?? ''}
                    onChange={(event) =>
                      onChange?.(requirement.requirementKey, {
                        evidenceType: event.target.value,
                        value: entry?.value ?? '',
                      })
                    }
                  >
                    <option value="" disabled>
                      Evidence type
                    </option>
                    {requirement.acceptedEvidenceTypes.map((type) => (
                      <option key={type} value={type}>
                        {humanizeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-sm-8">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    aria-label={`Evidence details for ${requirement.requirementName}`}
                    placeholder="Evidence reference or details"
                    value={entry?.value ?? ''}
                    onChange={(event) =>
                      onChange?.(requirement.requirementKey, {
                        evidenceType: entry?.evidenceType ?? '',
                        value: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-12">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary disabled"
                    disabled
                    title="File attachments will be available in a future phase"
                  >
                    <i className="bi bi-paperclip me-1" aria-hidden="true" />
                    Attach file (coming soon)
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
