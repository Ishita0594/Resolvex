import { io, type Socket } from 'socket.io-client';
import { WS_BASE_URL } from '../config/env';

export function createCaseEventsSocket(token: string): Socket {
  return io(`${WS_BASE_URL}/case-events`, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
}
