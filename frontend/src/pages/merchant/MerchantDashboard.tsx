import { useAuth } from '../../auth/AuthContext';

export function MerchantDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="h3 fw-bold mb-1">Welcome back, {user?.name.split(' ')[0]}</h1>
      <p className="text-muted mb-4">Disputes assigned to your account will appear here.</p>

      <div className="rx-card p-5 text-center">
        <i className="bi bi-shop text-primary" style={{ fontSize: '2rem' }} aria-hidden="true" />
        <h2 className="h5 mt-3 mb-1">Your dispute queue is coming next</h2>
        <p className="text-muted mb-0">
          Phase 3 will list assigned cases with response deadlines and evidence checklists.
        </p>
      </div>
    </div>
  );
}
