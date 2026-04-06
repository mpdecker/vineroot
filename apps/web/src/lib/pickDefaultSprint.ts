import type { Sprint } from '../types';

/** Prefer ACTIVE, then earliest-start PLANNED, then most recently ended (for closed). */
export function pickDefaultSprintId(sprints: Sprint[]): string | null {
  if (sprints.length === 0) return null;
  const active = [...sprints]
    .filter((s) => s.state === 'ACTIVE')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate));
  if (active[0]) return active[0].id;
  const planned = [...sprints]
    .filter((s) => s.state === 'PLANNED')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (planned[0]) return planned[0].id;
  const closed = [...sprints].sort((a, b) => b.endDate.localeCompare(a.endDate));
  return closed[0]?.id ?? null;
}
