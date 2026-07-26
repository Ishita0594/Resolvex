import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useNotifications } from '../../notifications/NotificationsContext';
import type { Notification } from '../../types/domain';
import { formatDateTime } from '../../utils/format';
import { caseDetailPathForRole } from '../../utils/navigation';

export function NotificationDropdown() {
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!user) {
    return null;
  }

  async function handleSelect(notification: Notification) {
    setIsOpen(false);
    if (!notification.isRead) {
      await markRead(notification.id).catch(() => {
        // Navigation should proceed even if the read-receipt call fails.
      });
    }
    if (notification.caseId && user) {
      navigate(caseDetailPathForRole(user.role, notification.caseId));
    }
  }

  return (
    <div className="rx-notification-menu" ref={containerRef}>
      <button
        type="button"
        className="btn btn-sm btn-outline-light position-relative"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        onClick={() => setIsOpen((open) => !open)}
      >
        <i className="bi bi-bell" aria-hidden="true" />
        {unreadCount > 0 ? <span className="rx-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <div className="rx-notification-panel" role="menu">
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
            <span className="fw-semibold small">Notifications</span>
            {unreadCount > 0 ? (
              <button type="button" className="btn btn-link btn-sm p-0" onClick={() => markAllRead()}>
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="rx-notification-list">
            {isLoading ? (
              <p className="text-muted small px-3 py-3 mb-0">Loading&hellip;</p>
            ) : notifications.length === 0 ? (
              <p className="text-muted small px-3 py-3 mb-0">You&apos;re all caught up.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  role="menuitem"
                  className={`rx-notification-item${notification.isRead ? '' : ' rx-notification-item--unread'}`}
                  onClick={() => handleSelect(notification)}
                >
                  <p className="mb-0 fw-semibold small">{notification.title}</p>
                  <p className="mb-1 small text-muted">{notification.message}</p>
                  <p className="mb-0 small text-muted">{formatDateTime(notification.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
