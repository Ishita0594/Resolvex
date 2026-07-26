import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { DASHBOARD_PATH_BY_ROLE } from '../../auth/roles';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { AuthBrandPanel } from './AuthBrandPanel';
import { submitErrorMessage } from '../../utils/apiError';
import { isValidEmail } from '../../utils/validation';
import type { UserRole } from '../../types/domain';

const DEMO_ACCOUNTS: { role: UserRole; label: string; email: string }[] = [
  { role: 'CARD_MEMBER', label: 'Card Member', email: 'member@resolvex.demo' },
  { role: 'MERCHANT', label: 'Merchant', email: 'merchant@resolvex.demo' },
  { role: 'ANALYST', label: 'Analyst', email: 'analyst@resolvex.demo' },
];
const DEMO_PASSWORD = 'ResolveXDemo123!';

export function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated && user) {
    const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? DASHBOARD_PATH_BY_ROLE[user.role];
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedInUser = await login({ email: email.trim(), password });
      const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? DASHBOARD_PATH_BY_ROLE[loggedInUser.role];
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(submitErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemoAccount(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="rx-auth-shell">
      <AuthBrandPanel />

      <div className="rx-auth-form">
        <div className="rx-auth-form-inner">
          <h1 className="h3 fw-bold mb-1">Welcome back</h1>
          <p className="text-muted mb-4">Sign in to review, submit, or resolve a dispute.</p>

          {error ? <ErrorAlert message={error} /> : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="login-email" className="form-label fw-semibold">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                className="form-control form-control-lg"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@resolvex.demo"
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="login-password" className="form-label fw-semibold">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                className="form-control form-control-lg"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-100" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  Signing in&hellip;
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-center text-muted mt-4 mb-0">
            New to ResolveX? <Link to="/register">Create an account</Link>
          </p>

          <div className="mt-4 pt-4 border-top">
            <p className="small fw-semibold text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>
              Quick demo access
            </p>
            <div className="d-flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => fillDemoAccount(account.email)}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
