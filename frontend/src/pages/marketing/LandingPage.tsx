import { Link } from 'react-router-dom';
import { APP_NAME, DEMO_MODE_LABEL } from '../../config/env';

const STAKEHOLDER_BENEFITS = [
  {
    icon: 'bi-person-badge',
    title: 'Card members',
    description: 'File a dispute in minutes with a guided form, then track its status end-to-end without picking up the phone.',
  },
  {
    icon: 'bi-shop',
    title: 'Merchants',
    description:
      'Respond against a clear, per-category requirement checklist and see exactly what evidence is missing before a deadline passes.',
  },
  {
    icon: 'bi-clipboard-check',
    title: 'Analysts & issuers',
    description:
      'Automation clears the clear-cut cases. Analysts spend their time only on genuinely contested ones, with a full audit trail behind every decision.',
  },
];

const WORKFLOW_STEPS = [
  { icon: 'bi-file-earmark-text', title: 'Dispute filed', description: 'Card member selects a transaction and states the issue.' },
  { icon: 'bi-cloud-arrow-up', title: 'Evidence collected', description: 'Both sides upload documents against policy requirements.' },
  { icon: 'bi-cpu', title: 'AI extraction', description: 'Structured facts are pulled from each document — dates, amounts, references.' },
  { icon: 'bi-diagram-3', title: 'Policy evaluation', description: 'A deterministic rule set scores the evidence against the dispute category.' },
  { icon: 'bi-check2-circle', title: 'Decision or human review', description: 'Clear cases resolve automatically; contested ones go to an analyst.' },
];

export function LandingPage() {
  return (
    <div>
      <nav className="rx-landing-nav">
        <div className="d-flex align-items-center gap-2">
          <span className="rx-brand-mark-icon" style={{ width: 30, height: 30, fontSize: '0.9rem' }}>
            RX
          </span>
          <span className="fw-bold">{APP_NAME}</span>
          {DEMO_MODE_LABEL ? <span className="rx-demo-badge">{DEMO_MODE_LABEL}</span> : null}
        </div>
        <Link to="/login" className="btn btn-gold btn-sm">
          Sign in
        </Link>
      </nav>

      <header className="rx-landing-hero">
        <div style={{ maxWidth: 720 }}>
          <h1 className="display-6 fw-bold mb-3">Explainable dispute resolution, from claim to decision.</h1>
          <p className="fs-5 mb-4" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {APP_NAME} routes card-member disputes through a deterministic, evidence-backed policy engine so every
            outcome &mdash; automated or human &mdash; comes with a reason a person can read and trust.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <Link to="/login" className="btn btn-gold btn-lg">
              Sign in to the demo
              <i className="bi bi-arrow-right ms-2" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="rx-landing-section">
        <div className="rx-landing-callout d-flex align-items-start gap-3 mx-auto" style={{ maxWidth: 900 }}>
          <i className="bi bi-info-circle-fill text-primary mt-1" aria-hidden="true" />
          <div>
            <p className="fw-semibold mb-1">{APP_NAME} is not a fraud-detection system.</p>
            <p className="text-muted small mb-0">
              It does not score transactions for fraud risk or flag suspicious card activity. It processes disputes
              that have already been raised, applying explainable policy rules to evidence both sides submit &mdash;
              nothing here makes a fraud determination.
            </p>
          </div>
        </div>
      </section>

      <section className="rx-landing-section pt-0">
        <h2 className="h4 fw-bold text-center mb-4">Built for every side of a dispute</h2>
        <div className="row g-4 mx-auto" style={{ maxWidth: 1000 }}>
          {STAKEHOLDER_BENEFITS.map((benefit) => (
            <div className="col-md-4" key={benefit.title}>
              <div className="rx-card p-4 h-100">
                <span className="rx-stat-icon mb-3" style={{ background: 'var(--rx-blue-100)', color: 'var(--rx-blue-600)' }}>
                  <i className={`bi ${benefit.icon}`} aria-hidden="true" />
                </span>
                <h3 className="h6 fw-bold mb-2">{benefit.title}</h3>
                <p className="text-muted small mb-0">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rx-landing-section pt-0">
        <h2 className="h4 fw-bold text-center mb-1">How a case moves through {APP_NAME}</h2>
        <p className="text-muted text-center mb-4">A preview of the workflow, not a diagram of every internal step.</p>
        <div className="rx-workflow mx-auto" style={{ maxWidth: 1100 }}>
          {WORKFLOW_STEPS.map((step, index) => (
            <div className="rx-workflow-step" key={step.title}>
              <span className="rx-workflow-step-number">{index + 1}</span>
              <div className="mb-2">
                <i className={`bi ${step.icon} text-primary`} style={{ fontSize: '1.3rem' }} aria-hidden="true" />
              </div>
              <p className="fw-semibold small mb-1">{step.title}</p>
              <p className="text-muted small mb-0">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="rx-landing-footer text-center small">
        <p className="mb-1">
          {APP_NAME} is a hackathon prototype for demonstration purposes only. It processes synthetic demo data and is
          not a certified fraud-detection or compliance product.
        </p>
        <Link to="/login" className="fw-semibold text-decoration-none">
          Sign in to explore the demo
        </Link>
      </footer>
    </div>
  );
}
