import { useRef, useState } from 'react';
import { submitAnalystDecision } from '../../api/analyst';
import { ErrorAlert } from '../common/ErrorAlert';
import { Modal } from '../common/Modal';
import { ANALYST_DECISION_LABELS, CASE_STATUS_LABELS } from '../../types/domain';
import type { AnalystDecision, AnalystDecisionResult, RecommendedOutcome } from '../../types/domain';
import { decisionAlignsWithRecommendation, statusForAnalystDecision } from '../../utils/analystQueue';
import { submitErrorMessage } from '../../utils/apiError';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';

const DECISION_ORDER: AnalystDecision[] = ['SUPPORT_CARD_MEMBER', 'SUPPORT_MERCHANT', 'REQUEST_MORE_INFORMATION', 'ESCALATE'];

const DECISION_BUTTON_ICON: Record<AnalystDecision, string> = {
  SUPPORT_CARD_MEMBER: 'bi-person-check',
  SUPPORT_MERCHANT: 'bi-shop',
  REQUEST_MORE_INFORMATION: 'bi-question-circle',
  ESCALATE: 'bi-flag',
};

interface AnalystDecisionPanelProps {
  caseId: string;
  latestRecommendation: RecommendedOutcome | null;
  disabled?: boolean;
  disabledReason?: string;
  onDecided: (result: AnalystDecisionResult) => void;
}

export function AnalystDecisionPanel({ caseId, latestRecommendation, disabled, disabledReason, onDecided }: AnalystDecisionPanelProps) {
  const [pendingDecision, setPendingDecision] = useState<AnalystDecision | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [analystNotes, setAnalystNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const requiresOverride = pendingDecision !== null && !decisionAlignsWithRecommendation(pendingDecision, latestRecommendation);

  useUnsavedChangesWarning(pendingDecision !== null && (overrideReason.trim().length > 0 || analystNotes.trim().length > 0));

  function openConfirm(decision: AnalystDecision) {
    setPendingDecision(decision);
    setOverrideReason('');
    setAnalystNotes('');
    setValidationError(null);
    setSubmitError(null);
  }

  function closeConfirm() {
    if (isSubmitting) {
      return;
    }
    setPendingDecision(null);
  }

  async function handleConfirm() {
    if (isSubmittingRef.current || !pendingDecision) {
      return;
    }

    if (requiresOverride && overrideReason.trim().length === 0) {
      setValidationError('An override reason is required because this decision differs from the system recommendation.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setValidationError(null);
    setSubmitError(null);
    try {
      const result = await submitAnalystDecision(caseId, {
        decision: pendingDecision,
        overrideReason: overrideReason.trim() || undefined,
        analystNotes: analystNotes.trim() || undefined,
      });
      setPendingDecision(null);
      onDecided(result);
    } catch (err) {
      setSubmitError(submitErrorMessage(err));
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {disabled && disabledReason ? (
        <p className="text-muted small mb-3">{disabledReason}</p>
      ) : null}
      <div className="d-flex flex-wrap gap-2">
        {DECISION_ORDER.map((decision) => (
          <button
            key={decision}
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={disabled}
            onClick={() => openConfirm(decision)}
          >
            <i className={`bi ${DECISION_BUTTON_ICON[decision]} me-1`} aria-hidden="true" />
            {ANALYST_DECISION_LABELS[decision]}
          </button>
        ))}
      </div>

      {pendingDecision ? (
        <Modal
          titleId="confirm-decision-title"
          title="Confirm decision"
          onClose={closeConfirm}
          closeDisabled={isSubmitting}
          footer={
            <>
              <button type="button" className="btn btn-outline-secondary" onClick={closeConfirm} disabled={isSubmitting}>
                Go back
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    Submitting&hellip;
                  </>
                ) : (
                  'Confirm decision'
                )}
              </button>
            </>
          }
        >
          {submitError ? <ErrorAlert message={submitError} /> : null}
          {validationError ? <ErrorAlert message={validationError} /> : null}

          <p className="mb-3">
            You are about to record <strong>{ANALYST_DECISION_LABELS[pendingDecision]}</strong> for this case. The case
            status will change to <strong>{CASE_STATUS_LABELS[statusForAnalystDecision(pendingDecision)]}</strong>.
          </p>

          {requiresOverride ? (
            <div className="mb-3">
              <label htmlFor="override-reason" className="form-label fw-semibold">
                Override reason <span className="text-danger">*</span>
              </label>
              <p className="text-muted small mb-2">Required because this decision differs from the system&apos;s recommendation.</p>
              <textarea
                id="override-reason"
                className="form-control"
                rows={3}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="mb-1">
            <label htmlFor="analyst-notes" className="form-label fw-semibold">
              Analyst notes <span className="text-muted fw-normal">(optional)</span>
            </label>
            <textarea
              id="analyst-notes"
              className="form-control"
              rows={3}
              value={analystNotes}
              onChange={(event) => setAnalystNotes(event.target.value)}
            />
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
