import { differenceInDays, parseISO } from 'date-fns';
import type { Task } from '../types';

function isMilestoneLike(task: Task): boolean {
  if (task.isMilestone) return true;
  if (task.startDate && task.dueDate) {
    const a = task.startDate.slice(0, 10);
    const b = task.dueDate.slice(0, 10);
    if (a === b) return true;
  }
  return false;
}

/** Duration in whole days for critical-path math (min 1 when scheduled). */
export function taskCriticalDurationDays(task: Task): number {
  if (!task.dueDate) return 0;
  if (isMilestoneLike(task)) return 1;
  const taskStart = task.startDate ? parseISO(task.startDate) : parseISO(task.dueDate);
  const taskEnd = parseISO(task.dueDate);
  return Math.max(1, differenceInDays(taskEnd, taskStart) + 1);
}

/**
 * Longest path in the dependency DAG (blockingTask → dependent).
 * Returns task ids on one critical path; empty if graph has a cycle or no tasks.
 */
export function computeCriticalPathTaskIds(tasks: Task[]): Set<string> {
  if (tasks.length === 0) return new Set();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ids = new Set(tasks.map((t) => t.id));
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const t of tasks) {
    adj.set(t.id, []);
    indeg.set(t.id, 0);
  }
  for (const t of tasks) {
    for (const dep of t.waitingOn ?? []) {
      const b = dep.blockingTask?.id;
      if (!b || !ids.has(b)) continue;
      adj.get(b)!.push(t.id);
      indeg.set(t.id, (indeg.get(t.id) ?? 0) + 1);
    }
  }

  const NEG = -1e12;
  const dist = new Map<string, number>();
  const pred = new Map<string, string | null>();
  for (const t of tasks) {
    pred.set(t.id, null);
    dist.set(t.id, NEG);
  }
  const q: string[] = [];
  for (const t of tasks) {
    if (indeg.get(t.id)! === 0) {
      const d = taskCriticalDurationDays(t);
      dist.set(t.id, d);
      q.push(t.id);
    }
  }

  const ind = new Map(indeg);
  let processed = 0;
  while (q.length) {
    const u = q.shift()!;
    processed += 1;
    const du = dist.get(u)!;
    for (const v of adj.get(u) ?? []) {
      const tv = byId.get(v)!;
      const cand = du + taskCriticalDurationDays(tv);
      if (cand > dist.get(v)!) {
        dist.set(v, cand);
        pred.set(v, u);
      }
      ind.set(v, (ind.get(v) ?? 0) - 1);
      if (ind.get(v) === 0) q.push(v);
    }
  }

  if (processed !== tasks.length) {
    return new Set();
  }

  let bestEnd = tasks[0]!.id;
  let best = dist.get(bestEnd)!;
  for (const t of tasks) {
    const d = dist.get(t.id)!;
    if (d > best) {
      best = d;
      bestEnd = t.id;
    }
  }
  if (best <= 0) return new Set();

  const path = new Set<string>();
  let cur: string | null = bestEnd;
  while (cur) {
    path.add(cur);
    cur = pred.get(cur) ?? null;
  }
  return path;
}
