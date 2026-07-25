import type { DisputeCase } from '../../types/domain';
import { formatDate } from '../../utils/format';
import { formatCountdown, isDeadlineExpired } from '../../utils/merchantCase';

const APPROACHING_DEADLINE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

export function DeadlineBadge({ dispute, now = new Date() }: { dispute: DisputeCase; now?: Date }) {
  if (dispute.merchantResponseStatus === 'SUBMITTED') {
    return (
      <span className="rx-badge rx-badge--resolved">
        Responded {formatDate(dispute.merchantResponseDate ?? dispute.updatedAt)}
      </span>
    );
  }

  if (isDeadlineExpired(dispute, now)) {
    return <span className="rx-badge rx-badge--failed">Deadline passed</span>;
  }

  const remainingMs = new Date(dispute.responseDeadline).getTime() - now.getTime();
  const tone = remainingMs <= APPROACHING_DEADLINE_THRESHOLD_MS ? 'processing' : 'submitted';

  return <span className={`rx-badge rx-badge--${tone}`}>{formatCountdown(dispute.responseDeadline, now)}</span>;
}
