import { Link, useLocation, type Location } from 'react-router-dom';

export function UnauthorizedPage() {
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from;

  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center gap-3" style={{ minHeight: '70vh' }}>
      <i className="bi bi-person-lock text-primary" style={{ fontSize: '2.5rem' }} aria-hidden="true" />
      <h1 className="h4 mb-0">Sign in to continue</h1>
      <p className="text-muted mb-2">You need to be signed in to view this page.</p>
      <Link to="/login" state={from ? { from } : undefined} className="btn btn-primary">
        Go to sign in
      </Link>
    </div>
  );
}
