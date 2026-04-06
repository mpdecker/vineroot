import { describe, it, expect } from 'vitest';
import { sortSectionsByBacklogRank } from './sortBacklogRoots';
import type { Section, Task } from '../types';

function task(
  id: string,
  sortOrder: number,
  opts: Partial<Task> = {},
): Task {
  return {
    id,
    createdById: 'u1',
    title: id,
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder,
    actorTier: 'UNASSIGNED',
    domain: 'GENERAL',
    complexity: 'LOW',
    reviewGate: 'NONE',
    retryCount: 0,
    isArchived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...opts,
  };
}

describe('sortSectionsByBacklogRank', () => {
  it('orders backlog roots by backlogRank then sortOrder', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [
          task('t1', 0, { backlogRank: 20, sprintId: null }),
          task('t2', 0, { backlogRank: 5, sprintId: null }),
          task('t3', 0, { backlogRank: null, sprintId: null }),
        ],
      },
    ];
    const out = sortSectionsByBacklogRank(sections);
    expect(out[0].tasks?.map((t) => t.id)).toEqual(['t2', 't1', 't3']);
  });

  it('does not reorder sprint-assigned roots by backlogRank vs backlog', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [
          task('t1', 1, { backlogRank: 1, sprintId: 'sp1' }),
          task('t2', 0, { backlogRank: 99, sprintId: null }),
        ],
      },
    ];
    const out = sortSectionsByBacklogRank(sections);
    expect(out[0].tasks?.map((t) => t.id)).toEqual(['t2', 't1']);
  });
});
