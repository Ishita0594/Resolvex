import { useState } from 'react';
import { ErrorAlert } from '../common/ErrorAlert';
import type { ExtractedFact } from '../../types/domain';

export interface FactCorrectionInput {
  factValue: string;
  verifiedByUser: boolean;
}

interface FactCorrectionFormProps {
  fact: ExtractedFact;
  isSubmitting?: boolean;
  submitError?: string | null;
  onCancel: () => void;
  onSubmit: (input: FactCorrectionInput) => void;
}

export function FactCorrectionForm({ fact, isSubmitting = false, submitError = null, onCancel, onSubmit }: FactCorrectionFormProps) {
  // Captured once when the form opens so the original AI-extracted (or previously saved) value stays
  // visible for comparison even as the user edits the draft value below.
  const [originalValue] = useState(fact.factValue);
  const [value, setValue] = useState(fact.factValue);
  const [verified, setVerified] = useState(fact.verifiedByUser);
  const [isConfirming, setIsConfirming] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasChanges = value.trim() !== originalValue || verified !== fact.verifiedByUser;

  function handleReview() {
    if (!value.trim()) {
      setValidationError('Enter a value before saving this correction.');
      return;
    }
    setValidationError(null);
    setIsConfirming(true);
  }

  function handleConfirm() {
    onSubmit({ factValue: value.trim(), verifiedByUser: verified });
  }

  if (isConfirming) {
    return (
      <div className="rx-card p-3 bg-light border-0">
        <p className="small fw-semibold mb-2">Confirm this correction</p>
        <dl className="row mb-2 small">
          <dt className="col-4 text-muted fw-normal">Original value</dt>
          <dd className="col-8">{originalValue}</dd>
          <dt className="col-4 text-muted fw-normal">Corrected value</dt>
          <dd className="col-8 fw-semibold">{value.trim()}</dd>
          <dt className="col-4 text-muted fw-normal">Verified</dt>
          <dd className="col-8">{verified ? 'Yes' : 'No'}</dd>
        </dl>

        {submitError ? <ErrorAlert message={submitError} /> : null}

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-sm btn-primary" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Confirm correction'}
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setIsConfirming(false)} disabled={isSubmitting}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rx-card p-3 bg-light border-0">
      <p className="text-muted small mb-2">
        Original AI-extracted value: <span className="fw-semibold text-body">{originalValue}</span>
      </p>

      <div className="mb-2">
        <label htmlFor={`fact-value-${fact.id}`} className="form-label small fw-semibold">
          Corrected value
        </label>
        <input
          id={`fact-value-${fact.id}`}
          type="text"
          className="form-control form-control-sm"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>

      <div className="form-check mb-2">
        <input
          id={`fact-verified-${fact.id}`}
          type="checkbox"
          className="form-check-input"
          checked={verified}
          onChange={(event) => setVerified(event.target.checked)}
        />
        <label htmlFor={`fact-verified-${fact.id}`} className="form-check-label small">
          I have verified this value is correct
        </label>
      </div>

      {validationError ? <ErrorAlert message={validationError} /> : null}

      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={handleReview} disabled={!hasChanges}>
          Save correction
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </div>
  );
}
