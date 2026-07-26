import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTransaction } from '../../api/transactions';
import { listDisputes } from '../../api/disputes';
import { TransactionStatusBadge, CaseStatusBadge } from '../../components/common/StatusBadge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { resolveApiError } from '../../utils/apiError';
import { formatDate } from '../../utils/format';
import type { DisputeCase, Transaction } from '../../types/domain';

export function TransactionDetailsPage() {
  const { transactionId } = useParams<{ transactionId: string }>();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [existingDispute, setExistingDispute] = useState<DisputeCase | null>(null);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function loadData() {
    if (!transactionId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    Promise.all([getTransaction(transactionId), listDisputes()])
      .then(([transactionData, disputes]) => {
        setTransaction(transactionData);
        setExistingDispute(disputes.find((dispute) => dispute.transactionId === transactionId) ?? null);
      })
      .catch((err) => {
        setError(resolveApiError(err, 'Unable to load this transaction right now.'));
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={5} label="Loading transaction" />;
  }

  if (error || !transaction) {
    return <ErrorState message={error?.message ?? 'Transaction not found.'} variant={error?.variant ?? 'not-found'} onRetry={loadData} />;
  }

  const isEligibleForDispute = !existingDispute;

  return (
    <div style={{ maxWidth: 640 }}>
      <Link to="/member/dashboard" className="text-decoration-none small fw-semibold mb-3 d-inline-block">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />
        Back to transactions
      </Link>

      <h1 className="h3 fw-bold mb-1">{transaction.merchantName}</h1>
      <p className="text-muted mb-4">Transaction details</p>

      <div className="rx-card p-4 mb-4">
        <dl className="row mb-0">
          <dt className="col-5 text-muted fw-normal">Amount</dt>
          <dd className="col-7">
            <CurrencyDisplay amount={transaction.amount} currency={transaction.currency} className="fw-semibold" />
          </dd>

          <dt className="col-5 text-muted fw-normal">Card</dt>
          <dd className="col-7">&bull;&bull;&bull;&bull; {transaction.maskedCardLast4}</dd>

          <dt className="col-5 text-muted fw-normal">Transaction date</dt>
          <dd className="col-7">{formatDate(transaction.transactionDate)}</dd>

          <dt className="col-5 text-muted fw-normal">Status</dt>
          <dd className="col-7">
            <TransactionStatusBadge status={transaction.status} />
          </dd>
        </dl>
      </div>

      <div className="rx-card p-4">
        <h2 className="h6 text-uppercase text-muted mb-3" style={{ letterSpacing: '0.06em' }}>
          Dispute eligibility
        </h2>

        {isEligibleForDispute ? (
          <>
            <p className="text-muted mb-3">This transaction has no dispute on file yet. You can raise one now.</p>
            <Link to={`/member/transactions/${transaction.id}/dispute`} className="btn btn-primary">
              Dispute this transaction
            </Link>
          </>
        ) : (
          <>
            <p className="text-muted mb-2">
              A dispute already exists for this transaction with status:{' '}
              <CaseStatusBadge status={existingDispute!.status} />
            </p>
            <Link to={`/member/disputes/${existingDispute!.id}`} className="btn btn-outline-primary">
              View case
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
