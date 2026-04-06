import type { Project, Section } from '../types';
import { applyTaskReorderToProject } from './applyTaskReorderToProject';
import type { ReorderTaskItem } from './projectTaskDnD';

/** Root-level tasks in a section (board / list column roots). */
export function countBoardRoots(section: Section): number {
  return (section.tasks ?? []).filter((t) => !t.parentTaskId).length;
}

export type WipBreach = {
  sectionId: string;
  name: string;
  count: number;
  limit: number;
};

/** Columns that would exceed `wipLimit` after applying reorder items. */
export function wipBreachesAfterReorder(
  project: Project,
  items: ReorderTaskItem[],
): WipBreach[] {
  const next = applyTaskReorderToProject(project, items);
  const out: WipBreach[] = [];
  for (const s of next.sections ?? []) {
    if (s.wipLimit == null) continue;
    const n = countBoardRoots(s);
    if (n > s.wipLimit) {
      out.push({
        sectionId: s.id,
        name: s.name,
        count: n,
        limit: s.wipLimit,
      });
    }
  }
  return out;
}
