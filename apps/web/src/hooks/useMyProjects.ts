import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  ensureWorkspaceOnProject,
  mergeProjectsAcrossWorkspaces,
} from '../lib/projectWorkspace';
import { Project } from '../types';
import { useWorkspaces } from './useWorkspaces';

/**
 * Projects across all of the user’s workspaces (deduped, workspaceIds unioned). Uses nested
 * GET /workspaces/:id/projects so it stays in sync with the Projects page
 * and does not depend on GET /projects.
 */
export function useMyProjects() {
  const { data: workspaces, isFetched: workspacesReady, isError: workspacesFailed } =
    useWorkspaces();

  const workspaceIds = (workspaces ?? []).map((w) => w.id).sort();

  return useQuery({
    queryKey: ['projects', 'mine', workspaceIds.join('|')],
    queryFn: async () => {
      const ws = workspaces ?? [];
      if (ws.length === 0) return [];
      const lists = await Promise.all(
        ws.map((w) =>
          api
            .get<Project[]>(`/workspaces/${w.id}/projects`)
            .then((r) =>
              (r.data ?? []).map((p) => ensureWorkspaceOnProject(p, w.id)),
            ),
        ),
      );
      return mergeProjectsAcrossWorkspaces(lists);
    },
    enabled: workspacesReady && !workspacesFailed,
  });
}
