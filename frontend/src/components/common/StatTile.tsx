type StatTileTone = 'neutral' | 'review' | 'resolved' | 'submitted' | 'processing' | 'failed';

const TONE_COLORS: Record<StatTileTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--rx-gray-100)', fg: 'var(--rx-status-neutral)' },
  submitted: { bg: 'var(--rx-blue-100)', fg: 'var(--rx-status-submitted)' },
  processing: { bg: '#fdf2df', fg: 'var(--rx-status-processing)' },
  review: { bg: '#fdead9', fg: 'var(--rx-status-review)' },
  resolved: { bg: '#e2f6ec', fg: 'var(--rx-status-resolved)' },
  failed: { bg: '#fbe4e4', fg: 'var(--rx-status-failed)' },
};

interface StatTileProps {
  icon: string;
  label: string;
  value: string | number;
  caption?: string;
  tone?: StatTileTone;
}

/** A single dashboard metric tile. Self-wraps in a responsive grid column so callers only need a `.row`. */
export function StatTile({ icon, label, value, caption, tone = 'neutral' }: StatTileProps) {
  const colors = TONE_COLORS[tone];

  return (
    <div className="col-sm-6 col-lg-3">
      <div className="rx-card p-3 h-100">
        <div className="d-flex align-items-center gap-3">
          <span className="rx-stat-icon" style={{ background: colors.bg, color: colors.fg }}>
            <i className={`bi ${icon}`} aria-hidden="true" />
          </span>
          <div>
            <div className="h4 fw-bold mb-0">{value}</div>
            <div className="text-muted small">{label}</div>
            {caption ? <div className="text-muted small">{caption}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
