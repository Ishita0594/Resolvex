export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-danger d-flex align-items-start justify-content-between gap-3" role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn-sm btn-outline-danger flex-shrink-0" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
