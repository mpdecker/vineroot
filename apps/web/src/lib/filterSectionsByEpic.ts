import type { Section, Task } from '../types';

/** `all` or a task id whose `workItemType` is (typically) `EPIC` */
export type EpicFilterValue = 'all' | string;

function flattenTasks(tasks: Task[] | undefined, out: Task[]) {
  for (const t of tasks ?? []) {
    out.push(t);
    flattenTasks(t.subtasks, out);
  }
}

/** Epic-shaped tasks for header dropdown (deduped, sorted by title). */
export function listEpicTasks(sections: Section[]): Pick<Task, 'id' | 'title'>[] {
  const all: Task[] = [];
  for (const s of sections) {
    flattenTasks(s.tasks, all);
  }
  const seen = new Set<string>();
  const out: Pick<Task, 'id' | 'title'>[] = [];
  for (const t of all) {
    if (t.workItemType !== 'EPIC') continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({ id: t.id, title: t.title });
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

function buildTaskById(sections: Section[]): Map<string, Task> {
  const all: Task[] = [];
  for (const s of sections) {
    flattenTasks(s.tasks, all);
  }
  const m = new Map<string, Task>();
  for (const t of all) {
    m.set(t.id, t);
  }
  return m;
}

function isUnderEpic(task: Task, epicId: string, byId: Map<string, Task>): boolean {
  if (task.id === epicId) return true;
  if (task.epicTaskId === epicId) return true;
  let p = task.parentTaskId;
  let depth = 0;
  while (p && depth < 64) {
    if (p === epicId) return true;
    const parent = byId.get(p);
    if (!parent) return false;
    p = parent.parentTaskId;
    depth++;
  }
  return false;
}

function filterTaskTree(
  tasks: Task[] | undefined,
  epicId: string,
  byId: Map<string, Task>,
): Task[] {
  const out: Task[] = [];
  for (const t of tasks ?? []) {
    const sub = filterTaskTree(t.subtasks, epicId, byId);
    if (isUnderEpic(t, epicId, byId) || sub.length > 0) {
      out.push({ ...t, subtasks: sub });
    }
  }
  return out;
}

export function filterSectionsByEpic(sections: Section[], filter: EpicFilterValue): Section[] {
  if (filter === 'all') return sections;
  const byId = buildTaskById(sections);
  return sections.map((s) => ({
    ...s,
    tasks: filterTaskTree(s.tasks, filter, byId),
  }));
}
