import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export function SessionExpiredModal() {
  const { sessionExpired, dismissSessionExpired } = useAuth();
  const navigate = useNavigate();

  if (!sessionExpired) {
    return null;
  }

  function handleSignInAgain() {
    dismissSessionExpired();
    navigate('/login', { replace: true });
  }

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" style={{ background: 'rgba(10, 31, 68, 0.55)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-body text-center p-4">
            <i className="bi bi-clock-history text-primary" style={{ fontSize: '2rem' }} aria-hidden="true" />
            <h2 className="h5 mt-3 mb-1">Your session has expired</h2>
            <p className="text-muted mb-4">Please sign in again to continue where you left off.</p>
            <button type="button" className="btn btn-primary w-100" onClick={handleSignInAgain}>
              Sign in again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
