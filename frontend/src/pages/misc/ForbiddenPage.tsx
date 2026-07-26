import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { DASHBOARD_PATH_BY_ROLE } from '../../auth/roles';

export function ForbiddenPage() {
  const { user } = useAuth();
  const homePath = user ? DASHBOARD_PATH_BY_ROLE[user.role] : '/login';

  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center gap-3" style={{ minHeight: '70vh' }}>
      <i className="bi bi-shield-lock text-primary" style={{ fontSize: '2.5rem' }} aria-hidden="true" />
      <h1 className="h4 mb-0">You don't have access to this page</h1>
      <p className="text-muted mb-2">Your account role doesn't include this section of ResolveX.</p>
      <Link to={homePath} className="btn btn-primary">
        Go to my dashboard
      </Link>
    </div>
  );
}
