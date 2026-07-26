import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';
import { AuthProvider } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import * as authApi from '../../api/auth';

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), 'Alex Card');
  await user.type(screen.getByLabelText(/email address/i), 'alex@resolvex.demo');
  await user.type(screen.getByLabelText(/^password$/i), 'ResolveXDemo123!');
  await user.type(screen.getByLabelText(/confirm password/i), 'ResolveXDemo123!');
}

describe('RegisterPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockRejectedValue(new Error('no session'));
  });

  it('registers and stores the access token on success', async () => {
    vi.spyOn(authApi, 'register').mockResolvedValueOnce({
      accessToken: 'test-token',
      tokenType: 'Bearer',
      user: { id: '1', name: 'Alex Card', email: 'alex@resolvex.demo', role: 'CARD_MEMBER' },
    });

    renderRegisterPage();
    const user = userEvent.setup();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(window.localStorage.getItem('resolvex.accessToken')).toBe('test-token');
    });
  });

  it('rejects a malformed email before calling the API', async () => {
    const registerSpy = vi.spyOn(authApi, 'register');

    renderRegisterPage();
    const user = userEvent.setup();
    await fillValidForm(user);
    await user.clear(screen.getByLabelText(/email address/i));
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('blocks submission when the passwords do not match', async () => {
    const registerSpy = vi.spyOn(authApi, 'register');

    renderRegisterPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/full name/i), 'Alex Card');
    await user.type(screen.getByLabelText(/email address/i), 'alex@resolvex.demo');
    await user.type(screen.getByLabelText(/^password$/i), 'ResolveXDemo123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SomethingElse123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    expect(registerSpy).not.toHaveBeenCalled();
  });

  it('surfaces the server error message when registration fails', async () => {
    vi.spyOn(authApi, 'register').mockRejectedValueOnce(
      new ApiError({
        statusCode: 409,
        error: 'Conflict',
        message: 'An account with this email already exists.',
        timestamp: new Date().toISOString(),
        path: '/api/auth/register',
      }),
    );

    renderRegisterPage();
    const user = userEvent.setup();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/an account with this email already exists/i)).toBeInTheDocument();
  });
});
