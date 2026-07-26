import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { listTransactions } from '../../api/transactions';
import { listDisputes } from '../../api/disputes';
import { TransactionTable } from '../../components/transactions/TransactionTable';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { resolveApiError } from '../../utils/apiError';
import type { DisputeCase, Transaction } from '../../types/domain';

export function CardMemberDashboard() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [disputes, setDisputes] = useState<DisputeCase[] | null>(null);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [transactionsData, disputesData] = await Promise.all([listTransactions(), listDisputes()]);
      setTransactions(transactionsData);
      setDisputes(disputesData);
    } catch (err) {
      setError(resolveApiError(err, 'Unable to load your transactions right now.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const disputeByTransactionId = useMemo(() => {
    const map = new Map<string, DisputeCase>();
    for (const dispute of disputes ?? []) {
      map.set(dispute.transactionId, dispute);
    }
    return map;
  }, [disputes]);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Welcome back, {user?.name.split(' ')[0]}</h1>
          <p className="text-muted mb-0">Review recent transactions and raise a dispute in a few clicks.</p>
        </div>
        <Link to="/member/disputes" className="btn btn-outline-primary">
          <i className="bi bi-clipboard-data me-2" aria-hidden="true" />
          My Disputes
        </Link>
      </div>

      {isLoading ? <LoadingSkeleton variant="table" rows={5} label="Loading your transactions" /> : null}

      {!isLoading && error ? <ErrorState message={error.message} variant={error.variant} onRetry={loadData} /> : null}

      {!isLoading && !error && transactions && transactions.length === 0 ? (
        <EmptyState
          icon="bi-credit-card-2-front"
          title="No transactions yet"
          description="Once you make a purchase, it will show up here so you can dispute it if needed."
        />
      ) : null}

      {!isLoading && !error && transactions && transactions.length > 0 ? (
        <TransactionTable transactions={transactions} disputeByTransactionId={disputeByTransactionId} />
      ) : null}
    </div>
  );
}
