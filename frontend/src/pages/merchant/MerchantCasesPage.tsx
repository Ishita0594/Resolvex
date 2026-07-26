import { useEffect, useMemo, useState } from 'react';
import { listMerchantDisputes } from '../../api/merchant';
import { MerchantCaseTable } from '../../components/merchant/MerchantCaseTable';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { resolveApiError } from '../../utils/apiError';
import type { CaseStatus, DisputeCase, ReasonCode } from '../../types/domain';
import { CASE_STATUS_LABELS, REASON_CODE_LABELS } from '../../types/domain';

const STATUS_OPTIONS = Object.keys(CASE_STATUS_LABELS) as CaseStatus[];
const REASON_OPTIONS = Object.keys(REASON_CODE_LABELS) as ReasonCode[];

export function MerchantCasesPage() {
  const [disputes, setDisputes] = useState<DisputeCase[] | null>(null);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'ALL'>('ALL');
  const [reasonFilter, setReasonFilter] = useState<ReasonCode | 'ALL'>('ALL');

  function loadDisputes() {
    setIsLoading(true);
    setError(null);
    listMerchantDisputes()
      .then(setDisputes)
      .catch((err) => {
        setError(resolveApiError(err, 'Unable to load your assigned disputes right now.'));
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
          <h1 className="h3 fw-bold mb-1">Assigned Cases</h1>
          <p className="text-muted mb-0">Every dispute routed to your merchant account, in one place.</p>
        </div>
      </div>

      {hasAnyDisputes ? (
        <div className="d-flex gap-3 mb-3 flex-wrap">
          <div>
            <label htmlFor="merchant-filter-status" className="form-label small fw-semibold mb-1">
              Status
            </label>
            <select
              id="merchant-filter-status"
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
            <label htmlFor="merchant-filter-category" className="form-label small fw-semibold mb-1">
              Category
            </label>
            <select
              id="merchant-filter-category"
              className="form-select form-select-sm"
              value={reasonFilter}
              onChange={(event) => setReasonFilter(event.target.value as ReasonCode | 'ALL')}
            >
              <option value="ALL">All categories</option>
              {REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>
                  {REASON_CODE_LABELS[reason]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {isLoading ? <LoadingSkeleton variant="table" rows={4} label="Loading your assigned cases" /> : null}

      {!isLoading && error ? <ErrorState message={error.message} variant={error.variant} onRetry={loadDisputes} /> : null}

      {!isLoading && !error && !hasAnyDisputes ? (
        <EmptyState
          icon="bi-shop"
          title="No disputes assigned yet"
          description="Cases routed to your merchant account will show up here."
        />
      ) : null}

      {!isLoading && !error && hasAnyDisputes && filteredDisputes.length === 0 ? (
        <EmptyState
          icon="bi-funnel"
          title="No cases match your filters"
          description="Try a different status or category."
          action={
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      ) : null}

      {!isLoading && !error && filteredDisputes.length > 0 ? <MerchantCaseTable disputes={filteredDisputes} /> : null}
    </div>
  );
}
