import { useAuth } from '../../auth/AuthContext';

export function AnalystDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="h3 fw-bold mb-1">Welcome back, {user?.name.split(' ')[0]}</h1>
      <p className="text-muted mb-4">Cases requiring human review will appear here.</p>

      <div className="rx-card p-5 text-center">
        <i className="bi bi-clipboard-check text-primary" style={{ fontSize: '2rem' }} aria-hidden="true" />
        <h2 className="h5 mt-3 mb-1">Your review queue is coming next</h2>
        <p className="text-muted mb-0">
          Phase 7 will surface low-confidence and conflicting cases here with full evidence context.
        </p>
      </div>
    </div>
  );
}
