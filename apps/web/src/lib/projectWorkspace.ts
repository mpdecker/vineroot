import type { Project } from '../types';

/**
 * Ensures a project fetched from GET /workspaces/:id/projects carries that workspace
 * in workspaceIds. Some clients or serializers may omit workspaceIds even though the
 * project is linked; UI filters (sidebar, portfolio picker) rely on this field.
 */
export function ensureWorkspaceOnProject(
  project: Project,
  workspaceId: string,
): Project {
  const existing = project.workspaceIds;
  if (existing?.includes(workspaceId)) return project;
  return {
    ...project,
    workspaceIds: [...(existing ?? []), workspaceId],
  };
}

/**
 * Merges workspace-scoped project lists into one array, deduping by id and unioning
 * workspaceIds when the same project appears in multiple workspace responses.
 */
export function mergeProjectsAcrossWorkspaces(lists: Project[][]): Project[] {
  const byId = new Map<string, Project>();
  for (const list of lists) {
    for (const p of list) {
      const prev = byId.get(p.id);
      if (!prev) {
        byId.set(p.id, p);
        continue;
      }
      const ids = new Set<string>([
        ...(prev.workspaceIds ?? []),
        ...(p.workspaceIds ?? []),
      ]);
      byId.set(p.id, {
        ...prev,
        ...p,
        workspaceIds: [...ids],
        taskCount: p.taskCount !== undefined ? p.taskCount : prev.taskCount,
        completedTaskCount:
          p.completedTaskCount !== undefined
            ? p.completedTaskCount
            : prev.completedTaskCount,
      });
    }
  }
  return Array.from(byId.values());
}
