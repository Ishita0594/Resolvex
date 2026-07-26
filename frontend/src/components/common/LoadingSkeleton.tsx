export function LoadingSkeleton({
  variant = 'table',
  rows = 5,
  label = 'Loading',
}: {
  variant?: 'table' | 'card';
  rows?: number;
  label?: string;
}) {
  if (variant === 'card') {
    return (
      <div className="rx-card p-4" role="status" aria-label={label}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rx-skeleton-line mb-3" style={{ width: index === 0 ? '40%' : '80%' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="rx-card p-0" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rx-skeleton-row" />
      ))}
    </div>
  );
}
