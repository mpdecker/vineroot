import type { Section, Task } from '../types';

function compareRootTasksForBacklog(a: Task, b: Task): number {
  const aBl = a.sprintId == null;
  const bBl = b.sprintId == null;
  if (aBl && bBl) {
    const ar = a.backlogRank;
    const br = b.backlogRank;
    if (ar != null && br != null && ar !== br) return ar - br;
    if (ar != null && br == null) return -1;
    if (ar == null && br != null) return 1;
  }
  return a.sortOrder - b.sortOrder;
}

function sortSubtasksByOrder(tasks: Task[] | undefined): Task[] {
  if (!tasks?.length) return [];
  return [...tasks]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({ ...t, subtasks: sortSubtasksByOrder(t.subtasks) }));
}

/** Backlog tab: order root tasks with no sprint by `backlogRank` (lower first), then `sortOrder`. */
export function sortSectionsByBacklogRank(sections: Section[]): Section[] {
  return sections.map((s) => ({
    ...s,
    tasks: [...(s.tasks ?? [])]
      .sort(compareRootTasksForBacklog)
      .map((t) => ({ ...t, subtasks: sortSubtasksByOrder(t.subtasks) })),
  }));
}
