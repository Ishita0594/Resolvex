import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import { getStoredToken } from '../auth/tokenStorage';
import { createCaseEventsSocket } from './socket';

export type RealtimeConnectionStatus = 'connecting' | 'open' | 'closed';

interface RealtimeContextValue {
  status: RealtimeConnectionStatus;
  socket: Socket | null;
  /** Defense-in-depth room join; the server already routes every event the user is entitled to via their own user:<id> room. */
  subscribeToCase: (caseId: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [status, setStatus] = useState<RealtimeConnectionStatus>('closed');
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!isAuthenticated || !user || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus('closed');
      return;
    }

    const nextSocket = createCaseEventsSocket(token);
    socketRef.current = nextSocket;
    setSocket(nextSocket);
    setStatus('connecting');

    const handleOpen = () => setStatus('open');
    const handleClosed = () => setStatus('closed');
    const handleReconnectAttempt = () => setStatus('connecting');

    nextSocket.on('connect', handleOpen);
    nextSocket.on('disconnect', handleClosed);
    nextSocket.io.on('reconnect_attempt', handleReconnectAttempt);
    nextSocket.io.on('reconnect', handleOpen);

    return () => {
      nextSocket.off('connect', handleOpen);
      nextSocket.off('disconnect', handleClosed);
      nextSocket.io.off('reconnect_attempt', handleReconnectAttempt);
      nextSocket.io.off('reconnect', handleOpen);
      nextSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus('closed');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const subscribeToCase = useCallback((caseId: string) => {
    socketRef.current?.emit('case.subscribe', { caseId });
  }, []);

  return <RealtimeContext.Provider value={{ status, socket, subscribeToCase }}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
