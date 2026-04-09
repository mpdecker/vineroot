import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import type { UpdateProfileRequest } from '@vineroot/shared-types';
import type { User } from '../types';

export function useUpdateProfile() {
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: async (body: UpdateProfileRequest) => {
      const res = await api.patch<User>('/auth/me', body);
      return res.data;
    },
    onSuccess: (user) => {
      updateUser({
        displayName: user.displayName,
        timezone: user.timezone,
        avatarUrl: user.avatarUrl,
        workCalendarId: user.workCalendarId,
        resourceStandardRatePerHour: user.resourceStandardRatePerHour,
        resourceOvertimeRatePerHour: user.resourceOvertimeRatePerHour,
      });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      await api.post('/auth/me/password', body);
    },
  });
}
