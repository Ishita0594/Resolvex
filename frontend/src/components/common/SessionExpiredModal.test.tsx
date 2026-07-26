import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SessionExpiredModal } from './SessionExpiredModal';
import { AuthProvider } from '../../auth/AuthContext';
import { SESSION_EXPIRED_EVENT } from '../../api/client';
import * as authApi from '../../api/auth';

function renderModal() {
  return render(
    <MemoryRouter initialEntries={['/member/dashboard']}>
      <AuthProvider>
        <SessionExpiredModal />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('SessionExpiredModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockRejectedValue(new Error('no session'));
  });

  it('renders nothing until a session-expired event fires', async () => {
    renderModal();
    expect(screen.queryByText(/your session has expired/i)).not.toBeInTheDocument();
  });

  it('shows the dialog, moves focus into it, and clears the token on sign-in', async () => {
    renderModal();

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    });
    window.localStorage.setItem('resolvex.accessToken', 'stale-token');

    expect(await screen.findByText(/your session has expired/i)).toBeInTheDocument();
    const signInButton = screen.getByRole('button', { name: /sign in again/i });
    expect(signInButton).toHaveFocus();

    const user = userEvent.setup();
    await user.click(signInButton);

    expect(screen.queryByText(/your session has expired/i)).not.toBeInTheDocument();
  });
});
