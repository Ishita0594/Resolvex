import type { ReactNode } from 'react';

export function EmptyState({
  icon = 'bi-inbox',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rx-card text-center py-5 px-4">
      <i className={`bi ${icon} text-primary`} style={{ fontSize: '2rem' }} aria-hidden="true" />
      <h3 className="h5 mt-3 mb-1">{title}</h3>
      {description ? <p className="text-muted mb-3">{description}</p> : null}
      {action}
    </div>
  );
}
