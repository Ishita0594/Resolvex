import { useEffect } from 'react';
import { useRealtime } from './RealtimeContext';
import type { CaseEventName, CaseEventPayload } from '../types/domain';

/** Subscribes `handler` to one case-event type for as long as the component is mounted and the socket is connected. */
export function useCaseEvent(
  eventName: CaseEventName,
  handler: (payload: CaseEventPayload, eventName: CaseEventName) => void,
): void {
  const { socket } = useRealtime();

  useEffect(() => {
    if (!socket) {
      return;
    }
    const listener = (payload: CaseEventPayload) => handler(payload, eventName);
    socket.on(eventName, listener);
    return () => {
      socket.off(eventName, listener);
    };
  }, [socket, eventName, handler]);
}
