import { io, type Socket } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

/** The gateway is mounted on the bare Nest HTTP server, not under the /api prefix used for REST calls. */
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export function createCaseEventsSocket(token: string): Socket {
  return io(`${SOCKET_BASE_URL}/case-events`, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
}
