import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  useToggleAutomation,
} from './useAutomations';
import type { AutomationDto } from '@vineroot/shared-types';
import { AutomationTriggerType, AutomationActionType } from '@vineroot/shared-types';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const auto: AutomationDto = {
  id: 'a1',
  workspaceId: 'ws-1',
  name: 'Rule',
  isActive: true,
  triggerType: AutomationTriggerType.TASK_CREATED,
  triggerConfig: {},
  actions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('useAutomations hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useAutomations lists workspace automations', async () => {
    mockedApi.get.mockResolvedValue({ data: [auto] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useAutomations('ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/automations');
  });

  it('useCreateAutomation posts body', async () => {
    mockedApi.post.mockResolvedValue({ data: auto });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useCreateAutomation('ws-1'), {
      wrapper: wrapper(client),
    });

    const body = {
      name: 'R',
      triggerType: AutomationTriggerType.TASK_COMPLETED,
      triggerConfig: {},
      actions: [
        {
          actionType: AutomationActionType.CHANGE_STATUS,
          actionConfig: { targetStatus: 'DONE' },
        },
      ],
    };
    await result.current.mutateAsync(body);

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws-1/automations', body);
  });

  it('useUpdateAutomation patches', async () => {
    mockedApi.patch.mockResolvedValue({ data: auto });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useUpdateAutomation('ws-1'), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({ id: 'a1', body: { name: 'X' } });

    expect(mockedApi.patch).toHaveBeenCalledWith('/workspaces/ws-1/automations/a1', {
      name: 'X',
    });
  });

  it('useDeleteAutomation deletes', async () => {
    mockedApi.delete.mockResolvedValue({});
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDeleteAutomation('ws-1'), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync('a1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/workspaces/ws-1/automations/a1');
  });

  it('useToggleAutomation posts toggle', async () => {
    mockedApi.post.mockResolvedValue({ data: { ...auto, isActive: false } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useToggleAutomation('ws-1'), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync('a1');
    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws-1/automations/a1/toggle');
  });
});
