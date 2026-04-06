import { describe, it, expect } from 'vitest';
import { countBoardRoots, wipBreachesAfterReorder } from './wipBoard';
import type { Project, Section, Task } from '../types';

function rootTask(id: string, overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id,
    createdById: 'u1',
    title: id,
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder: 0,
    actorTier: 'HUMAN',
    domain: 'GENERAL',
    complexity: 'LOW',
    reviewGate: 'NONE',
    retryCount: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    parentTaskId: undefined,
    ...overrides,
  };
}

describe('wipBoard', () => {
  it('countBoardRoots ignores subtasks', () => {
    const section: Section = {
      id: 's1',
      projectId: 'p1',
      name: 'Col',
      sortOrder: 0,
      tasks: [rootTask('r1'), rootTask('c1', { parentTaskId: 'r1' })],
    };
    expect(countBoardRoots(section)).toBe(1);
  });

  it('wipBreachesAfterReorder detects column over cap', () => {
    const project: Project = {
      id: 'p1',
      workspaceIds: ['w1'],
      name: 'P',
      color: 'BLUE',
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'board',
      sections: [
        {
          id: 's1',
          projectId: 'p1',
          name: 'A',
          sortOrder: 0,
          wipLimit: 1,
          tasks: [rootTask('t1', { sectionId: 's1' })],
        },
        {
          id: 's2',
          projectId: 'p1',
          name: 'B',
          sortOrder: 1,
          wipLimit: 2,
          tasks: [rootTask('t2', { sectionId: 's2' })],
        },
      ],
    };

    const breaches = wipBreachesAfterReorder(project, [
      { taskId: 't2', sortOrder: 0, sectionId: 's1' },
    ]);

    expect(breaches).toHaveLength(1);
    expect(breaches[0]).toMatchObject({
      sectionId: 's1',
      count: 2,
      limit: 1,
    });
  });
});
