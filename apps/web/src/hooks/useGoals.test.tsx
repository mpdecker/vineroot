import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import {
  useGoals,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useCreateGoalMetric,
} from './useGoals';
import { GoalStatus, GoalMetricType, type GoalDto } from '@vineroot/shared-types';

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

const sampleGoal: GoalDto = {
  id: 'g1',
  workspaceId: 'ws-1',
  name: 'Q1',
  status: GoalStatus.NO_STATUS,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('useGoals hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useGoals fetches workspace goals', async () => {
    mockedApi.get.mockResolvedValue({ data: [sampleGoal] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useGoals('ws-1'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApi.get).toHaveBeenCalledWith('/workspaces/ws-1/goals');
    expect(result.current.data).toEqual([sampleGoal]);
  });

  it('useGoals disabled without workspaceId', () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useGoals(undefined), {
      wrapper: wrapper(client),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('useCreateGoal posts and invalidates', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleGoal });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreateGoal('ws-1'), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({ name: 'New' });

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws-1/goals', { name: 'New' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['goals', 'ws-1'] });
  });

  it('useUpdateGoal patches goal', async () => {
    mockedApi.patch.mockResolvedValue({ data: sampleGoal });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useUpdateGoal('ws-1'), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({
      goalId: 'g1',
      body: { name: 'Renamed' },
    });

    expect(mockedApi.patch).toHaveBeenCalledWith('/workspaces/ws-1/goals/g1', {
      name: 'Renamed',
    });
  });

  it('useDeleteGoal deletes', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDeleteGoal('ws-1'), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync('g1');

    expect(mockedApi.delete).toHaveBeenCalledWith('/workspaces/ws-1/goals/g1');
  });

  it('useCreateGoalMetric posts metrics sub-resource', async () => {
    mockedApi.post.mockResolvedValue({ data: sampleGoal });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useCreateGoalMetric('ws-1'), {
      wrapper: wrapper(client),
    });

    await result.current.mutateAsync({
      goalId: 'g1',
      body: { name: 'M', type: GoalMetricType.PERCENT, target: 100 },
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/workspaces/ws-1/goals/g1/metrics', {
      name: 'M',
      type: GoalMetricType.PERCENT,
      target: 100,
    });
  });
});
