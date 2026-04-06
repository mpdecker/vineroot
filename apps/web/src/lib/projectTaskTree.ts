import type { Section, Task } from '../types';

/** Visit every task in a section-root tree (pre-order). */
export function walkTaskTree(
  root: Task,
  visit: (task: Task, depth: number) => void,
  depth = 0,
): void {
  visit(root, depth);
  const kids = [...(root.subtasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const c of kids) {
    walkTaskTree(c, visit, depth + 1);
  }
}

/** All tasks in project sections (by section roots), deduped by id. */
export function buildTaskMapFromSections(sections: Section[]): Map<string, Task> {
  const m = new Map<string, Task>();
  for (const s of sections) {
    for (const t of s.tasks ?? []) {
      walkTaskTree(t, (task) => m.set(task.id, task));
    }
  }
  return m;
}

export function flattenTasksFromSections(sections: Section[]): Task[] {
  const out: Task[] = [];
  for (const s of sections) {
    for (const t of s.tasks ?? []) {
      walkTaskTree(t, (task) => out.push(task));
    }
  }
  return out;
}

export function getTaskFromSections(sections: Section[], taskId: string): Task | undefined {
  return buildTaskMapFromSections(sections).get(taskId);
}

/** Direct child ids under `parentId`, sorted by sortOrder. */
export function getDirectChildIds(sections: Section[], parentId: string): string[] {
  const parent = getTaskFromSections(sections, parentId);
  if (!parent?.subtasks?.length) return [];
  return [...parent.subtasks].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id);
}

function attachSubtree(id: string, flat: Map<string, Task>): Task {
  const node = flat.get(id);
  if (!node) {
    throw new Error(`Missing task ${id} in flat map`);
  }
  const children = [...flat.values()]
    .filter((t) => t.parentTaskId === id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => attachSubtree(c.id, flat));
  return { ...node, subtasks: children };
}

/** Root tasks for a section column, each with nested `subtasks` rebuilt from `flat`. */
export function rebuildRootsForSection(sectionId: string, flat: Map<string, Task>): Task[] {
  const roots = [...flat.values()].filter((t) => !t.parentTaskId && t.sectionId === sectionId);
  roots.sort((a, b) => a.sortOrder - b.sortOrder);
  return roots.map((r) => attachSubtree(r.id, flat));
}

export function rebuildProjectSectionsFromTaskMap(sections: Section[], flat: Map<string, Task>): Section[] {
  return sections.map((sec) => ({
    ...sec,
    tasks: rebuildRootsForSection(sec.id, flat),
  }));
}

/** When a root moves section, keep descendants aligned for grouping/filtering. */
export function cascadeSectionToDescendants(flat: Map<string, Task>, rootId: string, sectionId: string): void {
  const children = [...flat.values()].filter((x) => x.parentTaskId === rootId);
  for (const c of children) {
    c.sectionId = sectionId;
    cascadeSectionToDescendants(flat, c.id, sectionId);
  }
}
