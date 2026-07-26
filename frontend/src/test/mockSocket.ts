type Listener = (payload?: unknown) => void;

export interface MockSocket {
  on: (event: string, handler: Listener) => void;
  off: (event: string, handler: Listener) => void;
  emit: (event: string, payload?: unknown) => void;
  disconnect: () => void;
  io: {
    on: (event: string, handler: Listener) => void;
    off: (event: string, handler: Listener) => void;
  };
  /** Test-only: fires every handler registered for `event` on both the socket and its manager (`socket.io`). */
  trigger: (event: string, payload?: unknown) => void;
}

/** A minimal fake matching the slice of the socket.io-client API RealtimeContext/useCaseEvent actually use. */
export function createMockSocket(): MockSocket {
  const listeners = new Map<string, Set<Listener>>();
  const managerListeners = new Map<string, Set<Listener>>();

  function add(map: Map<string, Set<Listener>>, event: string, handler: Listener) {
    if (!map.has(event)) {
      map.set(event, new Set());
    }
    map.get(event)!.add(handler);
  }

  return {
    on(event, handler) {
      add(listeners, event, handler);
    },
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },
    emit() {},
    disconnect() {},
    io: {
      on(event, handler) {
        add(managerListeners, event, handler);
      },
      off(event, handler) {
        managerListeners.get(event)?.delete(handler);
      },
    },
    trigger(event, payload) {
      listeners.get(event)?.forEach((handler) => handler(payload));
      managerListeners.get(event)?.forEach((handler) => handler(payload));
    },
  };
}
