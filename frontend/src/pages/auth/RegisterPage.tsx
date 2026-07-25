import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { DASHBOARD_PATH_BY_ROLE, ROLE_LABELS } from '../../auth/roles';
import { ApiError } from '../../api/client';
import { AuthBrandPanel } from './AuthBrandPanel';
import type { UserRole } from '../../types/domain';

const ROLE_OPTIONS: UserRole[] = ['CARD_MEMBER', 'MERCHANT', 'ANALYST'];

export function RegisterPage() {
  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CARD_MEMBER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated && user) {
    return <Navigate to={DASHBOARD_PATH_BY_ROLE[user.role]} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password) {
      setError('Fill in every field to create your account.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser = await register({ name: name.trim(), email: email.trim(), password, role });
      navigate(DASHBOARD_PATH_BY_ROLE[newUser.role], { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rx-auth-shell">
      <AuthBrandPanel />

      <div className="rx-auth-form">
        <div className="rx-auth-form-inner">
          <h1 className="h3 fw-bold mb-1">Create your account</h1>
          <p className="text-muted mb-4">Prototype accounts only &mdash; no real cardholder data.</p>

          {error ? (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="register-name" className="form-label fw-semibold">
                Full name
              </label>
              <input
                id="register-name"
                type="text"
                className="form-control form-control-lg"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="register-email" className="form-label fw-semibold">
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                className="form-control form-control-lg"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="register-password" className="form-label fw-semibold">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                className="form-control form-control-lg"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
              <div className="form-text">At least 8 characters.</div>
            </div>

            <div className="mb-4">
              <label htmlFor="register-role" className="form-label fw-semibold">
                I am a&hellip;
              </label>
              <select
                id="register-role"
                className="form-select form-select-lg"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-100" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  Creating account&hellip;
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="text-center text-muted mt-4 mb-0">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
