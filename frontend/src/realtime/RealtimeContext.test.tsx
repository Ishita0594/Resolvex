import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { RealtimeProvider, useRealtime } from './RealtimeContext';
import { AuthProvider } from '../auth/AuthContext';
import * as authApi from '../api/auth';
import { createMockSocket } from '../test/mockSocket';

const socketState = vi.hoisted(() => ({ sockets: [] as ReturnType<typeof createMockSocket>[] }));

vi.mock('socket.io-client', () => ({
  io: () => {
    const socket = createMockSocket();
    socketState.sockets.push(socket);
    return socket;
  },
}));

const USER = { id: 'analyst-1', name: 'Rae Analyst', email: 'analyst@resolvex.demo', role: 'ANALYST' as const };

function StatusProbe() {
  const { status } = useRealtime();
  return <span data-testid="status">{status}</span>;
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <RealtimeProvider>
        <StatusProbe />
      </RealtimeProvider>
    </AuthProvider>,
  );
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    socketState.sockets.length = 0;
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
  });

  it('connects once authenticated and moves to open once the socket connects', async () => {
    renderWithAuth();

    expect(await screen.findByTestId('status')).toHaveTextContent('connecting');

    const socket = socketState.sockets[socketState.sockets.length - 1];
    act(() => socket?.trigger('connect'));

    expect(await screen.findByTestId('status')).toHaveTextContent('open');
  });

  it('moves back to connecting on a reconnect attempt and to open once reconnected', async () => {
    renderWithAuth();
    await screen.findByTestId('status');
    const socket = socketState.sockets[socketState.sockets.length - 1];
    act(() => socket?.trigger('connect'));
    expect(await screen.findByTestId('status')).toHaveTextContent('open');

    act(() => socket?.trigger('disconnect'));
    expect(await screen.findByTestId('status')).toHaveTextContent('closed');

    act(() => socket?.trigger('reconnect_attempt'));
    expect(await screen.findByTestId('status')).toHaveTextContent('connecting');

    act(() => socket?.trigger('reconnect'));
    expect(await screen.findByTestId('status')).toHaveTextContent('open');
  });

  it('stays closed and never opens a socket when unauthenticated', async () => {
    window.localStorage.clear();

    render(
      <AuthProvider>
        <RealtimeProvider>
          <StatusProbe />
        </RealtimeProvider>
      </AuthProvider>,
    );

    expect(await screen.findByTestId('status')).toHaveTextContent('closed');
    expect(socketState.sockets).toHaveLength(0);
  });
});
