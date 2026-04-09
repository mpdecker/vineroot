import { useEffect, useMemo, useState } from 'react';
import type { ProjectCriticalPathDto, TaskScheduleResultDto } from '@vineroot/shared-types';
import { api } from '../lib/api';

/**
 * Loads server CPM results for list/timeline filters and driving-link UX.
 * When `enabled` is false, no request is made.
 */
export function useProjectScheduleCriticalPath(
  projectId: string | undefined,
  workspaceId: string | undefined,
  enabled: boolean,
) {
  const [data, setData] = useState<ProjectCriticalPathDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !projectId || !workspaceId) {
      setData(null);
      setLoadFailed(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    void api
      .get<ProjectCriticalPathDto>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/critical-path`,
      )
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId, workspaceId]);

  const scheduleByTaskId = useMemo(() => {
    const m = new Map<string, TaskScheduleResultDto>();
    for (const t of data?.tasks ?? []) {
      m.set(t.taskId, t);
    }
    return m;
  }, [data]);

  const criticalIds = useMemo(
    () => new Set(data?.criticalTaskIds ?? []),
    [data?.criticalTaskIds],
  );

  const drivingEdgeKeys = useMemo(() => {
    const s = new Set<string>();
    for (const e of data?.drivingEdges ?? []) {
      s.add(`${e.fromTaskId}\t${e.toTaskId}`);
    }
    return s;
  }, [data?.drivingEdges]);

  return {
    data,
    loading,
    loadFailed,
    scheduleByTaskId,
    criticalIds,
    drivingEdgeKeys,
  };
}
