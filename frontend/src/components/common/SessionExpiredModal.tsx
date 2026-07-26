import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Modal } from './Modal';

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
    <Modal titleId="session-expired-title" title="Your session has expired">
      <div className="text-center">
        <i className="bi bi-clock-history text-primary" style={{ fontSize: '2rem' }} aria-hidden="true" />
        <p className="text-muted mt-3 mb-4">Please sign in again to continue where you left off.</p>
        <button type="button" className="btn btn-primary w-100" onClick={handleSignInAgain}>
          Sign in again
        </button>
      </div>
    </Modal>
  );
}
