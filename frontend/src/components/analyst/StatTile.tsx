interface StatTileProps {
  icon: string;
  label: string;
  value: string;
  caption?: string;
  tone?: 'neutral' | 'review' | 'resolved' | 'submitted' | 'processing' | 'failed';
}

export function StatTile({ icon, label, value, caption, tone = 'neutral' }: StatTileProps) {
  return (
    <div className="rx-card p-4 h-100">
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className={`rx-badge rx-badge--${tone}`} style={{ padding: '0.4rem 0.5rem' }}>
          <i className={`bi ${icon}`} aria-hidden="true" />
        </span>
        <p className="text-muted small mb-0 text-uppercase" style={{ letterSpacing: '0.06em' }}>
          {label}
        </p>
      </div>
      <p className="h3 fw-bold mb-0">{value}</p>
      {caption ? <p className="text-muted small mb-0 mt-1">{caption}</p> : null}
    </div>
  );
}
