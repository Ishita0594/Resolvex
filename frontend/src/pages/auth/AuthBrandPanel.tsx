import { APP_NAME, DEMO_MODE_LABEL } from '../../config/env';

export function AuthBrandPanel() {
  return (
    <div className="rx-auth-brand">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="rx-brand-mark position-relative">
          <span className="rx-brand-mark-icon">RX</span>
          {APP_NAME}
        </div>
        {DEMO_MODE_LABEL ? <span className="rx-demo-badge position-relative">{DEMO_MODE_LABEL}</span> : null}
      </div>

      <div className="rx-auth-quote">
        &ldquo;From dispute to decision in minutes &mdash; not weeks &mdash; with evidence-backed,
        explainable outcomes for every card member and merchant.&rdquo;
      </div>

      <div className="rx-auth-stats">
        <div>
          <div className="rx-auth-stat-value">3</div>
          <div className="rx-auth-stat-label">Dispute Categories</div>
        </div>
        <div>
          <div className="rx-auth-stat-value">100%</div>
          <div className="rx-auth-stat-label">Explainable Decisions</div>
        </div>
        <div>
          <div className="rx-auth-stat-value">Minutes</div>
          <div className="rx-auth-stat-label">Not Weeks</div>
        </div>
      </div>
    </div>
  );
}
