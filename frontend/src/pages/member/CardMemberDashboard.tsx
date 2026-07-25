import { useAuth } from '../../auth/AuthContext';

export function CardMemberDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="h3 fw-bold mb-1">Welcome back, {user?.name.split(' ')[0]}</h1>
      <p className="text-muted mb-4">Your transactions and disputes will appear here.</p>

      <div className="rx-card p-5 text-center">
        <i className="bi bi-credit-card-2-front text-primary" style={{ fontSize: '2rem' }} aria-hidden="true" />
        <h2 className="h5 mt-3 mb-1">Transactions are coming next</h2>
        <p className="text-muted mb-0">
          Phase 2 will list your recent transactions here and let you raise a dispute in a few clicks.
        </p>
      </div>
    </div>
  );
}
