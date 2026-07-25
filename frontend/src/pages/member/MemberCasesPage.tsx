import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDisputes } from '../../api/disputes';
import { CaseStatusBadge } from '../../components/common/StatusBadge';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { resolveApiError } from '../../utils/apiError';
import { formatDate } from '../../utils/format';
import type { CaseStatus, DisputeCase, ReasonCode } from '../../types/domain';
import { CASE_STATUS_LABELS, REASON_CODE_LABELS } from '../../types/domain';

const STATUS_OPTIONS = Object.keys(CASE_STATUS_LABELS) as CaseStatus[];
const REASON_OPTIONS = Object.keys(REASON_CODE_LABELS) as ReasonCode[];

export function MemberCasesPage() {
  const [disputes, setDisputes] = useState<DisputeCase[] | null>(null);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'ALL'>('ALL');
  const [reasonFilter, setReasonFilter] = useState<ReasonCode | 'ALL'>('ALL');

  function loadDisputes() {
    setIsLoading(true);
    setError(null);
    listDisputes()
      .then(setDisputes)
      .catch((err) => {
        setError(resolveApiError(err, 'Unable to load your disputes right now.'));
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadDisputes();
  }, []);

  const filteredDisputes = useMemo(() => {
    if (!disputes) return [];
    return disputes.filter((dispute) => {
      const matchesStatus = statusFilter === 'ALL' || dispute.status === statusFilter;
      const matchesReason = reasonFilter === 'ALL' || dispute.reasonCode === reasonFilter;
      return matchesStatus && matchesReason;
    });
  }, [disputes, statusFilter, reasonFilter]);

  function clearFilters() {
    setStatusFilter('ALL');
    setReasonFilter('ALL');
  }

  const hasAnyDisputes = Boolean(disputes && disputes.length > 0);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">My Disputes</h1>
          <p className="text-muted mb-0">Track every case you&apos;ve raised, from submission to resolution.</p>
        </div>
        <Link to="/member/dashboard" className="btn btn-outline-primary">
          <i className="bi bi-credit-card-2-front me-2" aria-hidden="true" />
          Transactions
        </Link>
      </div>

      {hasAnyDisputes ? (
        <div className="d-flex gap-3 mb-3 flex-wrap">
          <div>
            <label htmlFor="filter-status" className="form-label small fw-semibold mb-1">
              Status
            </label>
            <select
              id="filter-status"
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as CaseStatus | 'ALL')}
            >
              <option value="ALL">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {CASE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filter-reason" className="form-label small fw-semibold mb-1">
              Reason
            </label>
            <select
              id="filter-reason"
              className="form-select form-select-sm"
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value as ReasonCode | 'ALL')}
            >
              <option value="ALL">All reasons</option>
              {REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>
                  {REASON_CODE_LABELS[reason]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {isLoading ? <LoadingSkeleton variant="table" rows={4} label="Loading your disputes" /> : null}

      {!isLoading && error ? <ErrorState message={error.message} variant={error.variant} onRetry={loadDisputes} /> : null}

      {!isLoading && !error && !hasAnyDisputes ? (
        <EmptyState
          icon="bi-clipboard-data"
          title="No disputes yet"
          description="File a dispute from your transactions list and it will show up here."
        />
      ) : null}

      {!isLoading && !error && hasAnyDisputes && filteredDisputes.length === 0 ? (
        <EmptyState
          icon="bi-funnel"
          title="No cases match your filters"
          description="Try a different status or reason."
          action={
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      ) : null}

      {!isLoading && !error && filteredDisputes.length > 0 ? (
        <div className="rx-card p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Merchant</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDisputes.map((dispute) => (
                  <tr key={dispute.id}>
                    <td className="fw-semibold">{dispute.transaction.merchantName}</td>
                    <td>{REASON_CODE_LABELS[dispute.reasonCode]}</td>
                    <td>
                      <CurrencyDisplay amount={dispute.transaction.amount} currency={dispute.transaction.currency} />
                    </td>
                    <td>{formatDate(dispute.createdAt)}</td>
                    <td>
                      <CaseStatusBadge status={dispute.status} />
                    </td>
                    <td className="text-end">
                      <Link to={`/member/disputes/${dispute.id}`} className="btn btn-sm btn-outline-primary">
                        View case
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
