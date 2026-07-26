import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAnalystQueue } from '../../api/analyst';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useCaseEvent } from '../../realtime/useCaseEvent';
import { REASON_CODE_LABELS, RECOMMENDED_OUTCOME_LABELS } from '../../types/domain';
import type { AnalystQueueCase, ReasonCode } from '../../types/domain';
import { ageInDays, getAnalystPriority, isDeadlinePassed, type AnalystPriority } from '../../utils/analystQueue';
import { resolveApiError } from '../../utils/apiError';
import { formatCountdown } from '../../utils/merchantCase';

type PriorityFilter = 'ALL' | AnalystPriority;
type CategoryFilter = 'ALL' | ReasonCode;
type SortKey = 'age' | 'confidence' | 'deadline' | 'priority';
type SortDirection = 'asc' | 'desc';

const PRIORITY_RANK: Record<AnalystPriority, number> = { HIGH: 1, STANDARD: 0 };

function compareCases(a: AnalystQueueCase, b: AnalystQueueCase, sortKey: SortKey, direction: SortDirection): number {
  let result = 0;
  if (sortKey === 'age') {
    result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  } else if (sortKey === 'confidence') {
    result = (a.latestConfidence ?? -1) - (b.latestConfidence ?? -1);
  } else if (sortKey === 'deadline') {
    result = new Date(a.responseDeadline).getTime() - new Date(b.responseDeadline).getTime();
  } else {
    result = PRIORITY_RANK[getAnalystPriority(a)] - PRIORITY_RANK[getAnalystPriority(b)];
  }
  return direction === 'asc' ? result : -result;
}

function firstEscalationReason(reason: string | null): string | null {
  if (!reason) {
    return null;
  }
  const [first] = reason.split(';');
  return first.trim();
}

export function AnalystQueuePage() {
  const [cases, setCases] = useState<AnalystQueueCase[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    listAnalystQueue()
      .then(setCases)
      .catch((err) => setError(resolveApiError(err, 'Unable to load the review queue right now.')))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useCaseEvent('analyst.review.required', load);
  useCaseEvent('decision.generated', load);
  useCaseEvent('case.status.updated', load);

  const categories = useMemo(() => {
    const seen = new Set<ReasonCode>();
    (cases ?? []).forEach((item) => seen.add(item.reasonCode));
    return Array.from(seen);
  }, [cases]);

  const visibleCases = useMemo(() => {
    if (!cases) {
      return [];
    }
    return cases
      .filter((item) => priorityFilter === 'ALL' || getAnalystPriority(item) === priorityFilter)
      .filter((item) => categoryFilter === 'ALL' || item.reasonCode === categoryFilter)
      .sort((a, b) => compareCases(a, b, sortKey, sortDirection));
  }, [cases, priorityFilter, categoryFilter, sortKey, sortDirection]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) {
      return null;
    }
    return <i className={`bi ${sortDirection === 'asc' ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} ms-1`} aria-hidden="true" />;
  }

  if (isLoading) {
    return <LoadingSkeleton variant="table" rows={6} label="Loading review queue" />;
  }

  if (error || !cases) {
    return <ErrorState message={error?.message ?? 'Unable to load the review queue.'} variant={error?.variant ?? 'error'} onRetry={load} />;
  }

  return (
    <div>
      <h1 className="h3 fw-bold mb-1">Review queue</h1>
      <p className="text-muted mb-4">Cases the policy engine could not decide automatically.</p>

      <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
        <div>
          <label htmlFor="priority-filter" className="form-label small fw-semibold mb-1">
            Priority
          </label>
          <select
            id="priority-filter"
            className="form-select form-select-sm"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
          >
            <option value="ALL">All priorities</option>
            <option value="HIGH">High</option>
            <option value="STANDARD">Standard</option>
          </select>
        </div>

        <div>
          <label htmlFor="category-filter" className="form-label small fw-semibold mb-1">
            Dispute category
          </label>
          <select
            id="category-filter"
            className="form-select form-select-sm"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
          >
            <option value="ALL">All categories</option>
            {categories.map((reasonCode) => (
              <option key={reasonCode} value={reasonCode}>
                {REASON_CODE_LABELS[reasonCode]}
              </option>
            ))}
          </select>
        </div>

        <p className="text-muted small mb-0 ms-auto">
          {visibleCases.length} of {cases.length} case{cases.length === 1 ? '' : 's'}
        </p>
      </div>

      {cases.length === 0 ? (
        <EmptyState icon="bi-clipboard-check" title="Nothing needs review right now" description="New cases will appear here as soon as the policy engine escalates them." />
      ) : visibleCases.length === 0 ? (
        <EmptyState icon="bi-funnel" title="No cases match these filters" description="Try a different priority or dispute category." />
      ) : (
        <div className="rx-card p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Category</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Recommendation</th>
                  <th scope="col">
                    <button type="button" className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold text-body" onClick={() => toggleSort('confidence')}>
                      Confidence {sortIndicator('confidence')}
                    </button>
                  </th>
                  <th scope="col">Reason for escalation</th>
                  <th scope="col">
                    <button type="button" className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold text-body" onClick={() => toggleSort('age')}>
                      Age {sortIndicator('age')}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold text-body" onClick={() => toggleSort('deadline')}>
                      Deadline {sortIndicator('deadline')}
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold text-body" onClick={() => toggleSort('priority')}>
                      Priority {sortIndicator('priority')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((item) => {
                  const priority = getAnalystPriority(item);
                  const escalationReason = firstEscalationReason(item.latestEscalationReason);
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link to={`/analyst/cases/${item.id}`} className="text-decoration-none fw-semibold">
                          {item.merchantName}
                        </Link>
                        <div className="text-muted small font-monospace">{item.id.slice(0, 8)}</div>
                      </td>
                      <td>{REASON_CODE_LABELS[item.reasonCode]}</td>
                      <td>
                        <CurrencyDisplay amount={item.amount} currency={item.currency} />
                      </td>
                      <td>{item.latestRecommendation ? RECOMMENDED_OUTCOME_LABELS[item.latestRecommendation] : 'Not yet evaluated'}</td>
                      <td>{item.latestConfidence !== null ? `${Math.round(item.latestConfidence)}%` : '—'}</td>
                      <td>
                        {escalationReason ? (
                          <span className="small" title={item.latestEscalationReason ?? undefined}>
                            {escalationReason}
                          </span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                      <td>{ageInDays(item.createdAt)}d</td>
                      <td>
                        <span className={isDeadlinePassed(item.responseDeadline) ? 'text-danger small' : 'small'}>
                          {formatCountdown(item.responseDeadline)}
                        </span>
                      </td>
                      <td>
                        {priority === 'HIGH' ? (
                          <span className="rx-badge rx-badge--review">High</span>
                        ) : (
                          <span className="rx-badge rx-badge--neutral">Standard</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
