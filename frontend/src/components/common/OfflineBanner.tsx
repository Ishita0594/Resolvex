import { APP_NAME } from '../../config/env';
import { useApiAvailability } from '../../hooks/useApiAvailability';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const isApiAvailable = useApiAvailability();

  if (isOnline && isApiAvailable) {
    return null;
  }

  const message = !isOnline
    ? "You're offline. Changes won't save until your connection is back."
    : `Unable to reach the ${APP_NAME} server. We'll keep retrying — check your connection.`;

  return (
    <div className="rx-offline-banner" role="status">
      <i className="bi bi-wifi-off me-2" aria-hidden="true" />
      {message}
    </div>
  );
}
