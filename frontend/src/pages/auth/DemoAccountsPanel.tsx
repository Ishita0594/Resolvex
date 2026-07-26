import { ROLE_LABELS } from '../../auth/roles';
import type { UserRole } from '../../types/domain';

interface DemoAccount {
  role: UserRole;
  email: string;
  description: string;
  icon: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'CARD_MEMBER', email: 'member@resolvex.demo', description: 'File disputes and track their resolution', icon: 'bi-person-badge' },
  { role: 'MERCHANT', email: 'merchant@resolvex.demo', description: 'Respond to disputes with evidence', icon: 'bi-shop' },
  { role: 'ANALYST', email: 'analyst@resolvex.demo', description: 'Review escalated cases and record a decision', icon: 'bi-clipboard-check' },
];

/**
 * Lists the seeded prototype accounts for judges/demo viewers. Deliberately does not
 * print the shared demo password on screen — it's a placeholder value baked into this
 * non-production build, not a pattern real users should associate with ResolveX.
 */
export function DemoAccountsPanel({ onSelect }: { onSelect: (email: string) => void }) {
  return (
    <div className="mt-4 pt-4 border-top">
      <p className="small fw-semibold text-uppercase text-muted mb-1" style={{ letterSpacing: '0.06em' }}>
        Prototype demo accounts
      </p>
      <p className="text-muted small mb-3">
        Every account below shares one preset demo password for this build. Choose a role to autofill sign-in.
      </p>
      <div className="d-flex flex-column gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.role}
            type="button"
            className="btn btn-outline-secondary d-flex align-items-center gap-3 text-start py-2"
            onClick={() => onSelect(account.email)}
          >
            <span className="rx-stat-icon" style={{ background: 'var(--rx-blue-100)', color: 'var(--rx-blue-600)' }}>
              <i className={`bi ${account.icon}`} aria-hidden="true" />
            </span>
            <span className="flex-grow-1">
              <span className="d-block fw-semibold">{ROLE_LABELS[account.role]}</span>
              <span className="d-block small text-muted">{account.description}</span>
            </span>
            <i className="bi bi-arrow-right-short fs-4 text-muted" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
