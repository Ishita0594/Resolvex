export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center gap-3" style={{ minHeight: '60vh' }}>
      <div className="spinner-border text-primary" role="status" style={{ width: '2.5rem', height: '2.5rem' }}>
        <span className="visually-hidden">{label}</span>
      </div>
      <p className="text-muted mb-0 fw-semibold">{label}&hellip;</p>
    </div>
  );
}
