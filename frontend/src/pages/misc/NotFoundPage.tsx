import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center gap-3" style={{ minHeight: '70vh' }}>
      <div className="display-4 fw-bold text-primary">404</div>
      <h1 className="h4 mb-0">Page not found</h1>
      <p className="text-muted mb-2">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="btn btn-primary">
        Back to ResolveX
      </Link>
    </div>
  );
}
