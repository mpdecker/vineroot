import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core';
import type { Project, Section, Task } from '../types';
import { computeReorderItemsFromDragEnd } from '../lib/projectTaskDnD';
import { buildTaskMapFromSections } from '../lib/projectTaskTree';
import { wipBreachesAfterReorder } from '../lib/wipBoard';
import { useReorderTasks } from './useTasks';

function formatReorderError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string | string[] } } };
  const m = ax.response?.data?.message;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join(', ');
  if (err instanceof Error) return err.message;
  return 'Could not save order';
}

/**
 * Shared drag state + handlers for project board and list (same reorder rules).
 * Import `preferTaskHitOverColumnCollision` from `boardListDnDCollision` and pass it to `DndContext` as `collisionDetection`.
 */
export function useProjectTaskDragHandlers(projectId: string, sortedSections: Section[]) {
  const queryClient = useQueryClient();
  const { mutate: reorderTasks } = useReorderTasks(projectId);

  const taskMap = useMemo(
    () => buildTaskMapFromSections(sortedSections),
    [sortedSections],
  );

  const [draggingTask, setDraggingTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setDraggingTask(taskMap.get(String(event.active.id)) ?? null);
    },
    [taskMap],
  );

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setDraggingTask(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingTask(null);
      const items = computeReorderItemsFromDragEnd(event, sortedSections);
      if (!items?.length) return;

      const cached = queryClient.getQueryData<Project>(['projects', projectId]);
      const policy = cached?.kanbanWipEnforcement ?? 'OFF';
      const previewProject: Project = cached
        ? { ...cached, sections: sortedSections }
        : ({
            id: projectId,
            workspaceIds: [],
            name: '',
            color: 'BLUE',
            status: 'ACTIVE',
            isPrivate: false,
            isArchived: false,
            defaultView: 'list',
            sections: sortedSections,
          } as Project);

      if (policy === 'WARN') {
        const breaches = wipBreachesAfterReorder(previewProject, items);
        if (breaches.length > 0) {
          const msg = breaches.map((b) => `${b.name} (${b.count}/${b.limit})`).join('; ');
          if (
            !window.confirm(
              `WIP limits would be exceeded: ${msg}. Move anyway? (Turn on Strict in project settings to block this at the server.)`,
            )
          ) {
            return;
          }
        }
      }

      reorderTasks(items, {
        onError: (err) => {
          window.alert(formatReorderError(err));
        },
      });
    },
    [sortedSections, reorderTasks, projectId, queryClient],
  );

  return {
    taskMap,
    draggingTask,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
