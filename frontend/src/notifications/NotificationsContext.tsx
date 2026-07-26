import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/common/ToastProvider';
import { useCaseEvent } from '../realtime/useCaseEvent';
import type { CaseEventPayload, CaseEventName, Notification } from '../types/domain';
import { toastCopyForCaseEvent } from '../utils/realtimeMessages';

const POLL_INTERVAL_MS = 30000;

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  reload: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    if (!isAuthenticated) {
      return;
    }
    listNotifications()
      .then(setNotifications)
      .catch(() => {
        // Silent: the bell just won't refresh this cycle; the next poll or realtime event retries.
      })
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    load();
    const interval = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, load]);

  const handleCaseEvent = useCallback(
    (payload: CaseEventPayload, eventName: CaseEventName) => {
      if (!user) {
        return;
      }
      showToast(toastCopyForCaseEvent(eventName, payload, user.role));
      load();
    },
    [user, showToast, load],
  );

  useCaseEvent('case.status.updated', handleCaseEvent);
  useCaseEvent('evidence.processing.completed', handleCaseEvent);
  useCaseEvent('merchant.response.received', handleCaseEvent);
  useCaseEvent('analyst.review.required', handleCaseEvent);
  useCaseEvent('decision.generated', handleCaseEvent);
  useCaseEvent('information.requested', handleCaseEvent);

  const markRead = useCallback(async (notificationId: string) => {
    const updated = await markNotificationRead(notificationId);
    setNotifications((current) => current.map((item) => (item.id === notificationId ? updated : item)));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, isLoading, markRead, markAllRead, reload: load }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
