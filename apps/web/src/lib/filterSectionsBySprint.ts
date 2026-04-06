import type { Section } from '../types';

/** `all` | `backlog` (no sprint) | concrete sprint id */
export type SprintFilterValue = 'all' | 'backlog' | string;

export function filterSectionsBySprint(
  sections: Section[],
  filter: SprintFilterValue,
): Section[] {
  if (filter === 'all') return sections;
  return sections.map((s) => ({
    ...s,
    tasks: (s.tasks ?? []).filter((t) => {
      if (filter === 'backlog') return !t.sprintId;
      return t.sprintId === filter;
    }),
  }));
}
