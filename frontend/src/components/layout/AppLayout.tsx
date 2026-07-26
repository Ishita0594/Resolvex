import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABELS } from '../../auth/roles';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import type { UserRole } from '../../types/domain';
import { RealtimeStatusIndicator } from './RealtimeStatusIndicator';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV_ITEMS_BY_ROLE: Record<UserRole, NavItem[]> = {
  CARD_MEMBER: [
    { to: '/member/dashboard', label: 'My Transactions', icon: 'bi-credit-card-2-front' },
    { to: '/member/disputes', label: 'My Disputes', icon: 'bi-clipboard-data' },
  ],
  MERCHANT: [
    { to: '/merchant/dashboard', label: 'Dashboard', icon: 'bi-shop' },
    { to: '/merchant/disputes', label: 'Assigned Cases', icon: 'bi-clipboard-data' },
  ],
  ANALYST: [
    { to: '/analyst/dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    { to: '/analyst/queue', label: 'Review Queue', icon: 'bi-clipboard-check' },
  ],
};

export function AppLayout() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="rx-app-shell">
      <header className="rx-topbar">
        <div className="d-flex align-items-center gap-2">
          <span className="rx-brand-mark-icon" style={{ width: 28, height: 28, fontSize: '0.85rem' }}>
            RX
          </span>
          <span className="fw-bold">ResolveX</span>
        </div>
        <div className="d-flex align-items-center gap-3">
          <RealtimeStatusIndicator />
          <NotificationDropdown />
          <span className="rx-role-badge">
            <i className="bi bi-person-badge" aria-hidden="true" />
            {ROLE_LABELS[user.role]}
          </span>
          <div className="text-end d-none d-sm-block">
            <div className="fw-semibold small">{user.name}</div>
            <div className="small text-white-50">{user.email}</div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={logout}>
            <i className="bi bi-box-arrow-right me-1" aria-hidden="true" />
            Log out
          </button>
        </div>
      </header>

      <div className="d-flex flex-grow-1">
        <nav className="rx-sidebar d-none d-md-block" style={{ width: 240 }}>
          {NAV_ITEMS_BY_ROLE[user.role].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `rx-nav-link mb-1${isActive ? ' active' : ''}`}
            >
              <i className={`bi ${item.icon}`} aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="rx-main flex-grow-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
