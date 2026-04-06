import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Portfolio } from '../types';

export function usePortfolios(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['portfolios', workspaceId],
    queryFn: async () => {
      const res = await api.get<Portfolio[]>(
        `/workspaces/${workspaceId}/portfolios`,
      );
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

/**
 * Loads a portfolio. Prefer passing workspaceId when known (nested route); it matches
 * list/create flows and avoids relying on top-level GET /portfolios/:id alone.
 */
export function usePortfolio(
  portfolioId: string | undefined,
  workspaceId?: string | null,
) {
  return useQuery({
    queryKey: ['portfolios', 'one', portfolioId, workspaceId ?? 'global'],
    queryFn: async () => {
      if (!portfolioId) return null;
      if (workspaceId) {
        const res = await api.get<Portfolio>(
          `/workspaces/${workspaceId}/portfolios/${portfolioId}`,
        );
        return res.data;
      }
      const res = await api.get<Portfolio>(`/portfolios/${portfolioId}`);
      return res.data;
    },
    enabled: !!portfolioId,
  });
}

export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      name: string;
      description?: string;
      color?: string;
    }) => {
      const { workspaceId, ...body } = data;
      const res = await api.post<Portfolio>(
        `/workspaces/${workspaceId}/portfolios`,
        body,
      );
      return res.data;
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios', p.workspaceId] });
    },
  });
}

export function useAddPortfolioProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      portfolioId: string;
      projectId: string;
    }) => {
      const res = await api.post<Portfolio>(
        `/workspaces/${data.workspaceId}/portfolios/${data.portfolioId}/items`,
        { projectId: data.projectId },
      );
      return res.data;
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios', p.workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ['portfolios', 'one', p.id],
      });
    },
  });
}

export function useRemovePortfolioProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      portfolioId: string;
      projectId: string;
    }) => {
      await api.delete(
        `/workspaces/${data.workspaceId}/portfolios/${data.portfolioId}/items/${data.projectId}`,
      );
      return data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios', d.workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ['portfolios', 'one', d.portfolioId],
      });
    },
  });
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { workspaceId: string; portfolioId: string }) => {
      await api.delete(
        `/workspaces/${data.workspaceId}/portfolios/${data.portfolioId}`,
      );
      return data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios', d.workspaceId] });
      queryClient.removeQueries({
        queryKey: ['portfolios', 'one', d.portfolioId],
      });
    },
  });
}
