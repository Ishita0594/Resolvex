import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { AuthProvider } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import * as authApi from '../../api/auth';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockRejectedValue(new Error('no session'));
  });

  it('shows a validation message when submitted empty', async () => {
    renderLoginPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter your email and password/i)).toBeInTheDocument();
  });

  it('logs in and stores the access token on success', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValueOnce({
      accessToken: 'test-token',
      tokenType: 'Bearer',
      user: { id: '1', name: 'ResolveX Member', email: 'member@resolvex.demo', role: 'CARD_MEMBER' },
    });

    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email address/i), 'member@resolvex.demo');
    await user.type(screen.getByLabelText(/^password$/i), 'ResolveXDemo123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem('resolvex.accessToken')).toBe('test-token');
    });
  });

  it('surfaces the server error message on failed login', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValueOnce(
      new ApiError({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
        timestamp: new Date().toISOString(),
        path: '/api/auth/login',
      }),
    );

    renderLoginPage();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/email address/i), 'member@resolvex.demo');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
});
