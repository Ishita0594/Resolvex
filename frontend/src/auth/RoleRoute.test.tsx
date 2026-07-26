import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RoleRoute } from './RoleRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthProvider } from './AuthContext';
import * as authApi from '../api/auth';

const CARD_MEMBER_USER = { id: 'member-1', name: 'Alex Card', email: 'member@resolvex.demo', role: 'CARD_MEMBER' as const };
const ANALYST_USER = { id: 'analyst-1', name: 'Rae Analyst', email: 'analyst@resolvex.demo', role: 'ANALYST' as const };

/**
 * Mirrors App.tsx's real route nesting: RoleRoute always sits inside ProtectedRoute, which holds
 * rendering until the session/profile check settles, so RoleRoute never has to decide with a
 * still-loading `user`.
 */
function renderAnalystRoute() {
  return render(
    <MemoryRouter initialEntries={['/analyst/queue']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/unauthorized" element={<div>Unauthorized page</div>} />
          <Route path="/forbidden" element={<div>Forbidden page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allow={['ANALYST']} />}>
              <Route path="/analyst/queue" element={<div>Analyst queue page</div>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RoleRoute', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('sends an unauthenticated visitor to the unauthorized (sign-in required) page rather than exposing the analyst route', async () => {
    renderAnalystRoute();

    expect(await screen.findByText('Unauthorized page')).toBeInTheDocument();
    expect(screen.queryByText('Analyst queue page')).not.toBeInTheDocument();
  });

  it('redirects a card member away from an analyst-only route to the forbidden page', async () => {
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(CARD_MEMBER_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');

    renderAnalystRoute();

    expect(await screen.findByText('Forbidden page')).toBeInTheDocument();
    expect(screen.queryByText('Analyst queue page')).not.toBeInTheDocument();
  });

  it('lets an analyst reach an analyst-only route', async () => {
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(ANALYST_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');

    renderAnalystRoute();

    expect(await screen.findByText('Analyst queue page')).toBeInTheDocument();
    expect(screen.queryByText('Unauthorized page')).not.toBeInTheDocument();
  });
});
