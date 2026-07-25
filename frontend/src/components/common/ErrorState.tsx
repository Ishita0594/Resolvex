export type ErrorStateVariant = 'error' | 'not-found' | 'unauthorized';

const VARIANT_CONTENT: Record<ErrorStateVariant, { icon: string; title: string }> = {
  error: { icon: 'bi-exclamation-triangle', title: 'Something went wrong' },
  'not-found': { icon: 'bi-search', title: 'Not found' },
  unauthorized: { icon: 'bi-shield-lock', title: "You don't have access to this" },
};

export function ErrorState({
  message,
  variant = 'error',
  onRetry,
}: {
  message: string;
  variant?: ErrorStateVariant;
  onRetry?: () => void;
}) {
  const { icon, title } = VARIANT_CONTENT[variant];

  return (
    <div className="rx-card text-center py-5 px-4" role="alert">
      <i className={`bi ${icon} text-danger`} style={{ fontSize: '2rem' }} aria-hidden="true" />
      <h3 className="h5 mt-3 mb-1">{title}</h3>
      <p className="text-muted mb-3">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-outline-primary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
