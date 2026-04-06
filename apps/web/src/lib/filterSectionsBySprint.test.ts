import { describe, it, expect } from 'vitest';
import { filterSectionsBySprint } from './filterSectionsBySprint';
import type { Section, Task } from '../types';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    createdById: 'u1',
    title: 'T',
    description: '',
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder: 0,
    actorTier: 'HUMAN',
    domain: 'GENERAL',
    complexity: 'LOW',
    reviewGate: 'NONE',
    retryCount: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const baseSection = (tasks: Task[]): Section => ({
  id: 's1',
  projectId: 'p1',
  name: 'Col',
  sortOrder: 0,
  tasks,
});

describe('filterSectionsBySprint', () => {
  const sections: Section[] = [
    baseSection([
      task({ id: 'a', sprintId: null }),
      task({ id: 'b', sprintId: 'sp-1' }),
      task({ id: 'c', sprintId: 'sp-2' }),
    ]),
  ];

  it('returns sections unchanged when filter is all', () => {
    const out = filterSectionsBySprint(sections, 'all');
    expect(out).toEqual(sections);
    expect(out[0].tasks).toHaveLength(3);
  });

  it('keeps only tasks without sprintId when filter is backlog', () => {
    const out = filterSectionsBySprint(sections, 'backlog');
    expect(out).toHaveLength(1);
    expect(out[0].tasks?.map((t) => t.id)).toEqual(['a']);
  });

  it('keeps only tasks in the selected sprint', () => {
    const out = filterSectionsBySprint(sections, 'sp-1');
    expect(out[0].tasks?.map((t) => t.id)).toEqual(['b']);
  });

  it('preserves section metadata and yields empty task lists when nothing matches', () => {
    const out = filterSectionsBySprint(sections, 'sp-unknown');
    expect(out[0].id).toBe('s1');
    expect(out[0].name).toBe('Col');
    expect(out[0].tasks).toEqual([]);
  });

  it('maps every section independently', () => {
    const multi: Section[] = [
      baseSection([task({ id: 'x', sprintId: 'sp-1' })]),
      baseSection([task({ id: 'y', sprintId: null })]),
    ];
    const out = filterSectionsBySprint(multi, 'backlog');
    expect(out[0].tasks).toEqual([]);
    expect(out[1].tasks?.map((t) => t.id)).toEqual(['y']);
  });
});
