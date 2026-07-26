import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAnalystQueue, listRecentlyResolvedCases } from '../../api/analyst';
import { useAuth } from '../../auth/AuthContext';
import { StatTile } from '../../components/common/StatTile';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { useCaseEvent } from '../../realtime/useCaseEvent';
import { useIsMobileViewport } from '../../hooks/useMediaQuery';
import { REASON_CODE_LABELS, RECOMMENDED_OUTCOME_LABELS } from '../../types/domain';
import type { AnalystQueueCase } from '../../types/domain';
import { ageInDays, getAnalystPriority, isApproachingDeadline, isDeadlinePassed } from '../../utils/analystQueue';
import { resolveApiError } from '../../utils/apiError';
import { formatDate } from '../../utils/format';

export function AnalystDashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobileViewport();
  const [queue, setQueue] = useState<AnalystQueueCase[] | null>(null);
  const [resolved, setResolved] = useState<AnalystQueueCase[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    Promise.all([listAnalystQueue(), listRecentlyResolvedCases()])
      .then(([queueData, resolvedData]) => {
        setQueue(queueData);
        setResolved(resolvedData);
      })
      .catch((err) => setError(resolveApiError(err, 'Unable to load the review dashboard right now.')))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useCaseEvent('analyst.review.required', load);
  useCaseEvent('decision.generated', load);
  useCaseEvent('case.status.updated', load);

  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={4} label="Loading dashboard" />;
  }

  if (error || !queue || !resolved) {
    return (
      <ErrorState message={error?.message ?? 'Unable to load the review dashboard.'} variant={error?.variant ?? 'error'} onRetry={load} />
    );
  }

  const highPriorityCount = queue.filter((item) => getAnalystPriority(item) === 'HIGH').length;
  const approachingDeadlineCount = queue.filter(
    (item) => isApproachingDeadline(item.responseDeadline) || isDeadlinePassed(item.responseDeadline),
  ).length;
  const scoredCases = queue.filter((item) => item.latestConfidence !== null);
  const averageConfidence =
    scoredCases.length > 0
      ? Math.round(scoredCases.reduce((sum, item) => sum + (item.latestConfidence ?? 0), 0) / scoredCases.length)
      : null;

  return (
    <div>
      <h1 className="h3 fw-bold mb-1">Welcome back, {user?.name.split(' ')[0]}</h1>
      <p className="text-muted mb-4">Here&apos;s what needs attention across the review queue.</p>

      <div className="row g-3 mb-4">
        <StatTile icon="bi-inbox" label="Awaiting review" value={queue.length} tone="submitted" />
        <StatTile icon="bi-exclamation-triangle" label="High priority" value={highPriorityCount} tone="review" />
        <StatTile
          icon="bi-hourglass-split"
          label="Approaching deadline"
          value={approachingDeadlineCount}
          caption="Within 2 days or past due"
          tone="processing"
        />
        <StatTile icon="bi-bar-chart" label="Average confidence" value={averageConfidence === null ? '—' : `${averageConfidence}%`} />
      </div>

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h5 fw-bold mb-0">Review queue</h2>
        <Link to="/analyst/queue" className="btn btn-sm btn-outline-primary">
          View full queue
        </Link>
      </div>

      {queue.length === 0 ? (
        <div className="mb-4">
          <EmptyState
            icon="bi-clipboard-check"
            title="Nothing needs review right now"
            description="New cases will appear here as soon as the policy engine escalates them."
          />
        </div>
      ) : isMobile ? (
        <div className="rx-card p-3 mb-4">
          {queue.slice(0, 5).map((item) => (
            <div key={item.id} className="rx-table-card">
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
                <Link to={`/analyst/cases/${item.id}`} className="text-decoration-none fw-semibold">
                  {item.merchantName}
                </Link>
                {getAnalystPriority(item) === 'HIGH' ? (
                  <span className="rx-badge rx-badge--review">High</span>
                ) : (
                  <span className="rx-badge rx-badge--neutral">Standard</span>
                )}
              </div>
              <dl className="mb-0">
                <div className="rx-table-card-row">
                  <dt>Category</dt>
                  <dd>{REASON_CODE_LABELS[item.reasonCode]}</dd>
                </div>
                <div className="rx-table-card-row">
                  <dt>Amount</dt>
                  <dd>
                    <CurrencyDisplay amount={item.amount} currency={item.currency} />
                  </dd>
                </div>
                <div className="rx-table-card-row">
                  <dt>Age</dt>
                  <dd>{ageInDays(item.createdAt)}d</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <div className="rx-card p-0 mb-4">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Category</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Priority</th>
                  <th scope="col" className="text-end">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/analyst/cases/${item.id}`} className="text-decoration-none fw-semibold">
                        {item.merchantName}
                      </Link>
                    </td>
                    <td>{REASON_CODE_LABELS[item.reasonCode]}</td>
                    <td>
                      <CurrencyDisplay amount={item.amount} currency={item.currency} />
                    </td>
                    <td>
                      {getAnalystPriority(item) === 'HIGH' ? (
                        <span className="rx-badge rx-badge--review">High</span>
                      ) : (
                        <span className="rx-badge rx-badge--neutral">Standard</span>
                      )}
                    </td>
                    <td className="text-end">{ageInDays(item.createdAt)}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="h5 fw-bold mb-3">Recently resolved</h2>
      {resolved.length === 0 ? (
        <EmptyState icon="bi-check2-circle" title="No cases have been resolved yet." />
      ) : isMobile ? (
        <div className="rx-card p-3">
          {resolved.map((item) => (
            <div key={item.id} className="rx-table-card">
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
                <Link to={`/analyst/cases/${item.id}`} className="text-decoration-none fw-semibold">
                  {item.merchantName}
                </Link>
                <CurrencyDisplay amount={item.amount} currency={item.currency} />
              </div>
              <dl className="mb-0">
                <div className="rx-table-card-row">
                  <dt>Outcome</dt>
                  <dd>{item.latestRecommendation ? RECOMMENDED_OUTCOME_LABELS[item.latestRecommendation] : '—'}</dd>
                </div>
                <div className="rx-table-card-row">
                  <dt>Resolved</dt>
                  <dd>{formatDate(item.createdAt)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <div className="rx-card p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Outcome</th>
                  <th scope="col" className="text-end">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/analyst/cases/${item.id}`} className="text-decoration-none fw-semibold">
                        {item.merchantName}
                      </Link>
                      <div className="text-muted small">{formatDate(item.createdAt)}</div>
                    </td>
                    <td>{item.latestRecommendation ? RECOMMENDED_OUTCOME_LABELS[item.latestRecommendation] : '—'}</td>
                    <td className="text-end">
                      <CurrencyDisplay amount={item.amount} currency={item.currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
