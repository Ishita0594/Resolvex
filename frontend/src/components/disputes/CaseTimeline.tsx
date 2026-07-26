import type { TimelineEvent } from '../../types/domain';
import { formatDateTime } from '../../utils/format';

function eventIcon(eventType: string): string {
  if (eventType.includes('SUBMIT')) return 'bi-send-check';
  if (eventType.includes('MERCHANT')) return 'bi-shop';
  if (eventType.includes('EVIDENCE')) return 'bi-file-earmark-text';
  if (eventType.includes('EVALUAT') || eventType.includes('DECISION')) return 'bi-clipboard-check';
  if (eventType.includes('RESOLV') || eventType.includes('CLOSE')) return 'bi-check-circle';
  return 'bi-dot';
}

export function CaseTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-muted mb-0">No timeline events yet.</p>;
  }

  const chronological = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <ol className="rx-timeline">
      {chronological.map((event) => (
        <li key={event.id} className="rx-timeline-item">
          <span className="rx-timeline-icon">
            <i className={`bi ${eventIcon(event.eventType)}`} aria-hidden="true" />
          </span>
          <div>
            <p className="mb-0 fw-semibold">{event.description}</p>
            <p className="mb-0 small text-muted">{formatDateTime(event.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
