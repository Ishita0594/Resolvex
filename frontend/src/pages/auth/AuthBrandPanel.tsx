export function AuthBrandPanel() {
  return (
    <div className="rx-auth-brand">
      <div className="rx-brand-mark position-relative">
        <span className="rx-brand-mark-icon">RX</span>
        ResolveX
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
