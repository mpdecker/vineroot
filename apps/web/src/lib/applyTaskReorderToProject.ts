import type { Project, Task } from '../types';
import type { ReorderTaskItem } from './projectTaskDnD';
import {
  buildTaskMapFromSections,
  rebuildProjectSectionsFromTaskMap,
  cascadeSectionToDescendants,
} from './projectTaskTree';

function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project;
}

/**
 * Apply a reorder payload to the cached project (nested subtasks preserved).
 * Updates sortOrder and optional sectionId on affected tasks; cascades section to
 * descendants when a **root** task moves columns.
 */
export function applyTaskReorderToProject(project: Project, items: ReorderTaskItem[]): Project {
  const next = cloneProject(project);
  const flat = buildTaskMapFromSections(next.sections ?? []);

  for (const item of items) {
    const t = flat.get(item.taskId);
    if (!t) continue;
    if (item.parentTaskId !== undefined) {
      t.parentTaskId = item.parentTaskId === null ? undefined : item.parentTaskId;
    }
    t.sortOrder = item.sortOrder;
    if (item.sectionId !== undefined) {
      t.sectionId = item.sectionId;
      cascadeSectionToDescendants(flat, t.id, item.sectionId);
    }
  }

  return {
    ...next,
    sections: rebuildProjectSectionsFromTaskMap(next.sections ?? [], flat),
  };
}

export function flattenProjectTasks(project: Project): Task[] {
  const out: Task[] = [];
  for (const s of project.sections ?? []) {
    for (const t of s.tasks ?? []) {
      const walk = (x: Task) => {
        out.push(x);
        for (const c of [...(x.subtasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)) {
          walk(c);
        }
      };
      walk(t);
    }
  }
  return out;
}
