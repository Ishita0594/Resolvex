import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { listMerchantDisputes } from '../../api/merchant';
import { MerchantCaseTable } from '../../components/merchant/MerchantCaseTable';
import { ErrorState, type ErrorStateVariant } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { resolveApiError } from '../../utils/apiError';
import { formatDate } from '../../utils/format';
import { isApproachingDeadline, isAwaitingMerchantResponse, isOpenCase } from '../../utils/merchantCase';
import type { DisputeCase } from '../../types/domain';

const ASSIGNED_CASES_PREVIEW_LIMIT = 8;
const RECENTLY_SUBMITTED_LIMIT = 5;

const STAT_TILE_COLORS: Record<string, { bg: string; fg: string }> = {
  submitted: { bg: 'var(--rx-blue-100)', fg: 'var(--rx-status-submitted)' },
  processing: { bg: '#fdf2df', fg: 'var(--rx-status-processing)' },
  review: { bg: '#fdead9', fg: 'var(--rx-status-review)' },
  resolved: { bg: '#e2f6ec', fg: 'var(--rx-status-resolved)' },
};

function StatTile({ icon, tone, value, label }: { icon: string; tone: keyof typeof STAT_TILE_COLORS; value: number; label: string }) {
  const colors = STAT_TILE_COLORS[tone];
  return (
    <div className="col-sm-6 col-lg-3">
      <div className="rx-card p-3 h-100">
        <div className="d-flex align-items-center gap-3">
          <span
            className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
            style={{ width: 40, height: 40, borderRadius: '50%', background: colors.bg, color: colors.fg }}
          >
            <i className={`bi ${icon}`} style={{ fontSize: '1.1rem' }} aria-hidden="true" />
          </span>
          <div>
            <div className="h4 fw-bold mb-0">{value}</div>
            <div className="text-muted small">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h2 className="h6 text-uppercase text-muted mb-0" style={{ letterSpacing: '0.06em' }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export function MerchantDashboard() {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<DisputeCase[] | null>(null);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const summary = useMemo(() => {
    if (!disputes) return null;
    const now = new Date();
    const openCount = disputes.filter(isOpenCase).length;
    const awaitingResponseCount = disputes.filter(isAwaitingMerchantResponse).length;
    const approachingDeadlineCount = disputes.filter((dispute) => isApproachingDeadline(dispute, now)).length;
    const recentlySubmitted = disputes
      .filter((dispute) => dispute.merchantResponseStatus === 'SUBMITTED' && dispute.merchantResponseDate)
      .sort(
        (a, b) => new Date(b.merchantResponseDate as string).getTime() - new Date(a.merchantResponseDate as string).getTime(),
      )
      .slice(0, RECENTLY_SUBMITTED_LIMIT);
    const assigned = [...disputes]
      .sort((a, b) => new Date(a.responseDeadline).getTime() - new Date(b.responseDeadline).getTime())
      .slice(0, ASSIGNED_CASES_PREVIEW_LIMIT);

    return { openCount, awaitingResponseCount, approachingDeadlineCount, recentlySubmitted, assigned };
  }, [disputes]);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="h3 fw-bold mb-1">Welcome back, {user?.name.split(' ')[0]}</h1>
          <p className="text-muted mb-0">Disputes assigned to your account, at a glance.</p>
        </div>
        <Link to="/merchant/disputes" className="btn btn-outline-primary">
          <i className="bi bi-clipboard-data me-2" aria-hidden="true" />
          All Cases
        </Link>
      </div>

      {isLoading ? <LoadingSkeleton variant="table" rows={5} label="Loading your dashboard" /> : null}

      {!isLoading && error ? <ErrorState message={error.message} variant={error.variant} onRetry={loadDisputes} /> : null}

      {!isLoading && !error && disputes && summary ? (
        <>
          <div className="row g-3 mb-4">
            <StatTile icon="bi-folder2-open" tone="submitted" value={summary.openCount} label="Total open disputes" />
            <StatTile icon="bi-hourglass-split" tone="processing" value={summary.awaitingResponseCount} label="Cases awaiting response" />
            <StatTile icon="bi-alarm" tone="review" value={summary.approachingDeadlineCount} label="Approaching deadlines" />
            <StatTile icon="bi-send-check" tone="resolved" value={summary.recentlySubmitted.length} label="Recently submitted responses" />
          </div>

          <DashboardSection title="Assigned cases" action={<Link to="/merchant/disputes" className="small fw-semibold text-decoration-none">View all</Link>}>
            {disputes.length === 0 ? (
              <EmptyState
                icon="bi-shop"
                title="No disputes assigned yet"
                description="Cases routed to your merchant account will appear here."
              />
            ) : (
              <MerchantCaseTable disputes={summary.assigned} />
            )}
          </DashboardSection>

          <DashboardSection title="Recently submitted responses">
            {summary.recentlySubmitted.length === 0 ? (
              <EmptyState
                icon="bi-send-check"
                title="No responses submitted yet"
                description="Responses you submit to card-member claims will show up here."
              />
            ) : (
              <div className="rx-card p-0">
                <ul className="list-group list-group-flush">
                  {summary.recentlySubmitted.map((dispute) => (
                    <li key={dispute.id} className="list-group-item d-flex align-items-center justify-content-between gap-2 flex-wrap">
                      <div>
                        <div className="fw-semibold">{dispute.transaction.merchantName}</div>
                        <div className="text-muted small">
                          Submitted {formatDate(dispute.merchantResponseDate as string)}
                        </div>
                      </div>
                      <Link to={`/merchant/disputes/${dispute.id}`} className="btn btn-sm btn-outline-primary">
                        View case
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </DashboardSection>
        </>
      ) : null}
    </div>
  );
}
