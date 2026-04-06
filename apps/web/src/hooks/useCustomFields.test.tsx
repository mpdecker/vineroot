import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useWorkspaceCustomFields } from './useCustomFields';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn() },
}));

const mockedApi = api as unknown as { get: ReturnType<typeof vi.fn> };

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useWorkspaceCustomFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches definitions for workspace', async () => {
    const defs = [
      {
        id: 'f1',
        workspaceId: 'ws-1',
        name: 'Estimate',
        type: 'NUMBER',
        isRequired: false,
        createdAt: new Date().toISOString(),
      },
    ];
    mockedApi.get.mockResolvedValue({ data: defs });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useWorkspaceCustomFields('ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/custom-fields');
    expect(result.current.data).toEqual(defs);
  });

  it('does not fetch when workspaceId is undefined', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useWorkspaceCustomFields(undefined), {
      wrapper: wrapper(client),
    });

    expect(mockedApi.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
