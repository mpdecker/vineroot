import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const socketMocks = vi.hoisted(() => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
    connect: vi.fn(),
    emit: vi.fn(),
  };
  return {
    mockSocket,
    ensureRealtimeSocket: vi.fn(() => mockSocket),
    disconnectSocket: vi.fn(),
    invalidateQueriesFromSocketEvent: vi.fn(),
  };
});

vi.mock('../../lib/socket', () => ({
  ensureRealtimeSocket: socketMocks.ensureRealtimeSocket,
  disconnectSocket: socketMocks.disconnectSocket,
  invalidateQueriesFromSocketEvent: socketMocks.invalidateQueriesFromSocketEvent,
}));

const authState = vi.hoisted(() => ({
  accessToken: 'jwt-token',
  user: {
    id: 'user-1',
    email: 'a@b.c',
    displayName: 'Tester',
    isAgent: false,
    timezone: 'UTC',
  },
}));

vi.mock('../../stores/auth.store', () => ({
  useAuthStore: (sel: (s: typeof authState & { isAuthenticated: boolean }) => unknown) =>
    sel({ ...authState, isAuthenticated: true }),
}));

const wsState = vi.hoisted(() => ({
  currentWorkspace: {
    id: 'ws-1',
    name: 'Workspace',
    slug: 'ws',
    memberCount: 1,
  },
}));

vi.mock('../../stores/workspace.store', () => ({
  useWorkspaceStore: (sel: (s: typeof wsState) => unknown) => sel(wsState),
}));

import { RealtimeSync } from './RealtimeSync';

describe('RealtimeSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketMocks.mockSocket.connected = false;
  });

  afterEach(() => {
    socketMocks.mockSocket.on.mockClear();
    socketMocks.mockSocket.off.mockClear();
  });

  it('creates socket with access token and registers listeners', () => {
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <RealtimeSync />
      </QueryClientProvider>,
    );

    expect(socketMocks.ensureRealtimeSocket).toHaveBeenCalledWith('jwt-token');
    expect(socketMocks.mockSocket.on).toHaveBeenCalledWith('event', expect.any(Function));
    expect(socketMocks.mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(socketMocks.mockSocket.connect).toHaveBeenCalled();
  });

  it('emits join:workspace on connect handler', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <RealtimeSync />
      </QueryClientProvider>,
    );

    const connectHandler = socketMocks.mockSocket.on.mock.calls.find(
      (c) => c[0] === 'connect',
    )?.[1] as () => void;
    expect(connectHandler).toBeDefined();
    connectHandler();
    expect(socketMocks.mockSocket.emit).toHaveBeenCalledWith('join:workspace', {
      workspaceId: 'ws-1',
      userId: 'user-1',
    });
  });

});
