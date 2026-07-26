import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotificationDropdown } from './NotificationDropdown';
import { AuthProvider } from '../../auth/AuthContext';
import { RealtimeProvider } from '../../realtime/RealtimeContext';
import { ToastProvider } from '../common/ToastProvider';
import { NotificationsProvider } from '../../notifications/NotificationsContext';
import * as authApi from '../../api/auth';
import * as notificationsApi from '../../api/notifications';
import type { Notification } from '../../types/domain';

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    io: { on: vi.fn(), off: vi.fn() },
  }),
}));

const MEMBER_USER = { id: 'member-1', name: 'Alex Card', email: 'member@resolvex.demo', role: 'CARD_MEMBER' as const };

function buildNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    userId: 'member-1',
    caseId: 'case-1',
    title: 'Case update',
    message: 'Your case status was updated.',
    type: 'ANALYST_DECISION',
    isRead: false,
    createdAt: '2026-07-25T00:00:00.000Z',
    ...overrides,
  };
}

function renderDropdown() {
  return render(
    <MemoryRouter initialEntries={['/member/dashboard']}>
      <AuthProvider>
        <ToastProvider>
          <RealtimeProvider>
            <NotificationsProvider>
              <Routes>
                <Route path="/member/dashboard" element={<NotificationDropdown />} />
                <Route path="/member/disputes/:caseId" element={<div>Case details page</div>} />
              </Routes>
            </NotificationsProvider>
          </RealtimeProvider>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('NotificationDropdown', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(MEMBER_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
  });

  it('shows an unread count badge and the notification list once opened', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue([
      buildNotification({ id: 'notif-1', isRead: false }),
      buildNotification({ id: 'notif-2', isRead: true, title: 'Older update' }),
    ]);

    renderDropdown();
    const user = userEvent.setup();

    expect(await screen.findByLabelText('Notifications, 1 unread')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Notifications, 1 unread'));

    expect(screen.getByText('Case update')).toBeInTheDocument();
    expect(screen.getByText('Older update')).toBeInTheDocument();
  });

  it('shows an empty state once there are no notifications', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue([]);

    renderDropdown();
    const user = userEvent.setup();

    const bellButton = await screen.findByLabelText('Notifications');
    await user.click(bellButton);

    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it('marks a notification read and navigates to its case when selected', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue([buildNotification()]);
    const markReadSpy = vi.spyOn(notificationsApi, 'markNotificationRead').mockResolvedValue(buildNotification({ isRead: true }));

    renderDropdown();
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText('Notifications, 1 unread'));
    await user.click(screen.getByRole('menuitem', { name: /case update/i }));

    await waitFor(() => expect(markReadSpy).toHaveBeenCalledWith('notif-1'));
    expect(await screen.findByText('Case details page')).toBeInTheDocument();
  });

  it('marks all notifications read', async () => {
    vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue([
      buildNotification({ id: 'notif-1', isRead: false }),
      buildNotification({ id: 'notif-2', isRead: false }),
    ]);
    const markAllSpy = vi.spyOn(notificationsApi, 'markAllNotificationsRead').mockResolvedValue({ updatedCount: 2 });

    renderDropdown();
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText('Notifications, 2 unread'));
    await user.click(screen.getByRole('button', { name: /mark all read/i }));

    await waitFor(() => expect(markAllSpy).toHaveBeenCalled());
    expect(await screen.findByLabelText('Notifications')).toBeInTheDocument();
  });
});
