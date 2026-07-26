import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { AuthProvider } from '../../auth/AuthContext';
import { ProtectedRoute } from '../../auth/ProtectedRoute';
import { RealtimeProvider } from '../../realtime/RealtimeContext';
import { NotificationsProvider } from '../../notifications/NotificationsContext';
import { ToastProvider } from '../common/ToastProvider';
import * as authApi from '../../api/auth';
import * as notificationsApi from '../../api/notifications';
import { createMockSocket } from '../../test/mockSocket';

vi.mock('socket.io-client', () => ({
  io: () => createMockSocket(),
}));

const MEMBER_USER = { id: 'member-1', name: 'Ada Card Member', email: 'member@resolvex.demo', role: 'CARD_MEMBER' as const };

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/member/dashboard']}>
      <AuthProvider>
        <ToastProvider>
          <RealtimeProvider>
            <NotificationsProvider>
              <Routes>
                <Route path="/login" element={<div>Login page</div>} />
                <Route path="/unauthorized" element={<div>Unauthorized page</div>} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/member/dashboard" element={<div>Dashboard content</div>} />
                  </Route>
                </Route>
              </Routes>
            </NotificationsProvider>
          </RealtimeProvider>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(MEMBER_USER);
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue([]);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
  });

  it('logs out safely: clears the stored token and drops the protected route', async () => {
    renderLayout();
    const user = userEvent.setup();

    expect(await screen.findByText('Dashboard content')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /log out/i }));

    expect(await screen.findByText('Unauthorized page')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('resolvex.accessToken')).toBeNull();
  });

  it('toggles the mobile navigation menu open and closed', async () => {
    renderLayout();
    const user = userEvent.setup();
    await screen.findByText('Dashboard content');

    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: /close navigation menu/i })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: /close navigation menu/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
