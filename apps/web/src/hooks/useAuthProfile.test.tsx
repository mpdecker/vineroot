import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { useUpdateProfile, useChangePassword } from './useAuthProfile';

const mockUpdateUser = vi.fn();

vi.mock('../lib/api', () => ({
  api: { patch: vi.fn(), post: vi.fn() },
}));

vi.mock('../stores/auth.store', () => ({
  useAuthStore: (sel: (s: { updateUser: typeof mockUpdateUser }) => unknown) =>
    sel({ updateUser: mockUpdateUser }),
}));

const mockedApi = api as unknown as {
  patch: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useAuthProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useUpdateProfile patches /auth/me and updates store', async () => {
    mockedApi.patch.mockResolvedValue({
      data: {
        id: 'u1',
        email: 'a@b.com',
        displayName: 'New',
        timezone: 'UTC',
        isAgent: false,
        workCalendarId: null,
        resourceStandardRatePerHour: null,
        resourceOvertimeRatePerHour: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useUpdateProfile(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({ displayName: 'New' });

    expect(mockedApi.patch).toHaveBeenCalledWith('/auth/me', { displayName: 'New' });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      displayName: 'New',
      timezone: 'UTC',
      avatarUrl: undefined,
      workCalendarId: null,
      resourceStandardRatePerHour: null,
      resourceOvertimeRatePerHour: null,
    });
  });

  it('useChangePassword posts /auth/me/password', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

    const { result } = renderHook(() => useChangePassword(), { wrapper: wrapper(client) });

    await result.current.mutateAsync({
      currentPassword: 'old',
      newPassword: 'newpassword12',
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/me/password', {
      currentPassword: 'old',
      newPassword: 'newpassword12',
    });
  });
});
