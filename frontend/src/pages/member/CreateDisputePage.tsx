import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { getTransaction } from '../../api/transactions';
import { createDispute } from '../../api/disputes';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { resolveApiError } from '../../utils/apiError';
import { formatDate, toDateInputValue } from '../../utils/format';
import type { ReasonCode, Transaction } from '../../types/domain';
import { REASON_CODE_LABELS } from '../../types/domain';

const REASON_CODES = Object.keys(REASON_CODE_LABELS) as ReasonCode[];

type ExpectedResolution = 'FULL_REFUND' | 'REPLACEMENT' | 'CANCEL_AND_REFUND' | 'OTHER';

const EXPECTED_RESOLUTION_LABELS: Record<ExpectedResolution, string> = {
  FULL_REFUND: 'Full refund',
  REPLACEMENT: 'Replacement item',
  CANCEL_AND_REFUND: 'Cancel and refund',
  OTHER: 'Other',
};
const EXPECTED_RESOLUTIONS = Object.keys(EXPECTED_RESOLUTION_LABELS) as ExpectedResolution[];

const STATEMENT_MIN_LENGTH = 10;

function composeStatement(statement: string, issueDate: string, expectedResolution: ExpectedResolution): string {
  return [
    statement.trim(),
    '',
    `Issue occurred on: ${formatDate(issueDate)}`,
    `Requested resolution: ${EXPECTED_RESOLUTION_LABELS[expectedResolution]}`,
  ].join('\n');
}

export function CreateDisputePage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loadError, setLoadError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [reasonCode, setReasonCode] = useState<ReasonCode | ''>('');
  const [statement, setStatement] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expectedResolution, setExpectedResolution] = useState<ExpectedResolution | ''>('');
  const [declarationChecked, setDeclarationChecked] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!transactionId) {
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    getTransaction(transactionId)
      .then((data) => {
        setTransaction(data);
        setIssueDate(toDateInputValue(data.transactionDate));
      })
      .catch((err) => {
        setLoadError(resolveApiError(err, 'Unable to load this transaction.'));
      })
      .finally(() => setIsLoading(false));
  }, [transactionId]);

  function validate(): string | null {
    if (!reasonCode) return 'Choose a reason for this dispute.';
    if (!statement.trim() || statement.trim().length < STATEMENT_MIN_LENGTH) {
      return `Describe what happened in at least ${STATEMENT_MIN_LENGTH} characters.`;
    }
    if (!issueDate) return 'Enter the date the issue occurred.';
    if (transaction) {
      const issueTime = new Date(issueDate).getTime();
      const transactionTime = new Date(toDateInputValue(transaction.transactionDate)).getTime();
      const todayTime = new Date(toDateInputValue(new Date().toISOString())).getTime();
      if (issueTime < transactionTime) return 'The issue date cannot be before the transaction date.';
      if (issueTime > todayTime) return 'The issue date cannot be in the future.';
    }
    if (!expectedResolution) return 'Select what resolution you are requesting.';
    if (!declarationChecked) return 'Confirm the declaration before submitting.';
    return null;
  }

  function handleReview(event: FormEvent) {
    event.preventDefault();
    const message = validate();
    if (message) {
      setValidationError(message);
      return;
    }
    setValidationError(null);
    setIsConfirmOpen(true);
  }

  async function handleConfirmSubmit() {
    if (isSubmittingRef.current || !transactionId || !reasonCode || !expectedResolution) {
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const dispute = await createDispute({
        transactionId,
        reasonCode,
        cardMemberStatement: composeStatement(statement, issueDate, expectedResolution),
      });
      navigate(`/member/disputes/${dispute.id}`, { replace: true });
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
    return <LoadingSkeleton variant="card" rows={5} label="Loading transaction" />;
  }

  if (loadError || !transaction) {
    return <ErrorState message={loadError?.message ?? 'Transaction not found.'} variant={loadError?.variant ?? 'not-found'} />;
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <Link to="/member/dashboard" className="text-decoration-none small fw-semibold mb-3 d-inline-block">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />
        Back to transactions
      </Link>

      <h1 className="h3 fw-bold mb-1">File a dispute</h1>
      <p className="text-muted mb-4">Tell us what happened and we&apos;ll notify the merchant.</p>

      <div className="rx-card p-3 mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="fw-semibold">{transaction.merchantName}</div>
            <div className="text-muted small">
              {formatDate(transaction.transactionDate)} &middot; Card &bull;&bull;&bull;&bull; {transaction.maskedCardLast4}
            </div>
          </div>
          <CurrencyDisplay amount={transaction.amount} currency={transaction.currency} className="h5 mb-0 fw-bold" />
        </div>
      </div>

      <div className="rx-card p-4">
        {validationError ? (
          <div className="alert alert-danger py-2" role="alert">
            {validationError}
          </div>
        ) : null}

        <form onSubmit={handleReview} noValidate>
          <div className="mb-3">
            <label htmlFor="dispute-reason" className="form-label fw-semibold">
              Reason
            </label>
            <select
              id="dispute-reason"
              className="form-select form-select-lg"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value as ReasonCode)}
              required
            >
              <option value="" disabled>
                Select a reason
              </option>
              {REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {REASON_CODE_LABELS[code]}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label htmlFor="dispute-issue-date" className="form-label fw-semibold">
              When did the issue occur?
            </label>
            <input
              id="dispute-issue-date"
              type="date"
              className="form-control"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              max={toDateInputValue(new Date().toISOString())}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="dispute-resolution" className="form-label fw-semibold">
              Expected resolution
            </label>
            <select
              id="dispute-resolution"
              className="form-select form-select-lg"
              value={expectedResolution}
              onChange={(event) => setExpectedResolution(event.target.value as ExpectedResolution)}
              required
            >
              <option value="" disabled>
                Select an outcome
              </option>
              {EXPECTED_RESOLUTIONS.map((code) => (
                <option key={code} value={code}>
                  {EXPECTED_RESOLUTION_LABELS[code]}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label htmlFor="dispute-statement" className="form-label fw-semibold">
              What happened?
            </label>
            <textarea
              id="dispute-statement"
              className="form-control"
              rows={5}
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="Describe the issue with as much detail as possible."
              required
            />
          </div>

          <div className="form-check mb-4">
            <input
              id="dispute-declaration"
              type="checkbox"
              className="form-check-input"
              checked={declarationChecked}
              onChange={(event) => setDeclarationChecked(event.target.checked)}
            />
            <label htmlFor="dispute-declaration" className="form-check-label">
              I confirm the information provided is accurate to the best of my knowledge.
            </label>
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary">
              Review and submit
            </button>
            <Link to="/member/dashboard" className="btn btn-outline-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {isConfirmOpen ? (
        <div className="modal d-block" role="dialog" aria-modal="true" style={{ background: 'rgba(10, 31, 68, 0.55)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="modal-title h5">Confirm your dispute</h2>
                <button type="button" className="btn-close" aria-label="Close" onClick={closeConfirm} disabled={isSubmitting} />
              </div>
              <div className="modal-body">
                {submitError ? (
                  <div className="alert alert-danger py-2" role="alert">
                    {submitError}
                  </div>
                ) : null}
                <dl className="row mb-0">
                  <dt className="col-5 text-muted fw-normal">Merchant</dt>
                  <dd className="col-7">{transaction.merchantName}</dd>

                  <dt className="col-5 text-muted fw-normal">Amount</dt>
                  <dd className="col-7">
                    <CurrencyDisplay amount={transaction.amount} currency={transaction.currency} />
                  </dd>

                  <dt className="col-5 text-muted fw-normal">Reason</dt>
                  <dd className="col-7">{reasonCode ? REASON_CODE_LABELS[reasonCode] : ''}</dd>

                  <dt className="col-5 text-muted fw-normal">Issue date</dt>
                  <dd className="col-7">{issueDate ? formatDate(issueDate) : ''}</dd>

                  <dt className="col-5 text-muted fw-normal">Requested resolution</dt>
                  <dd className="col-7">{expectedResolution ? EXPECTED_RESOLUTION_LABELS[expectedResolution] : ''}</dd>
                </dl>
                <p className="mt-3 mb-0 small text-muted" style={{ whiteSpace: 'pre-wrap' }}>
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
