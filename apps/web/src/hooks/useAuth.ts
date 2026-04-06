import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';
import { AuthResponse, User } from '../types';

export function useLogin() {
  const { login } = useAuthStore();
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await api.post<AuthResponse>('/auth/login', data);
      return res.data;
    },
    onSuccess: (data) => {
      login(data.user, data.accessToken, data.refreshToken);
    },
  });
}

export function useRegister() {
  const { login } = useAuthStore();
  return useMutation({
    mutationFn: async (data: { email: string; password: string; displayName: string; workspaceName?: string }) => {
      const res = await api.post<AuthResponse>('/auth/register', data);
      return res.data;
    },
    onSuccess: (data) => {
      login(data.user, data.accessToken, data.refreshToken);
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['user:me'],
    queryFn: async () => {
      const res = await api.get<User>('/auth/me');
      return res.data;
    },
  });
}
