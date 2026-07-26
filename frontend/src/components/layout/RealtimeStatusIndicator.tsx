import { useRealtime, type RealtimeConnectionStatus } from '../../realtime/RealtimeContext';

const STATUS_LABEL: Record<RealtimeConnectionStatus, string> = {
  open: 'Live updates connected',
  connecting: 'Reconnecting to live updates…',
  closed: 'Live updates offline',
};

export function RealtimeStatusIndicator() {
  const { status } = useRealtime();

  return (
    <span className="rx-realtime-status" role="status" aria-label={STATUS_LABEL[status]} title={STATUS_LABEL[status]}>
      <span className={`rx-realtime-dot rx-realtime-dot--${status}`} aria-hidden="true" />
    </span>
  );
}
