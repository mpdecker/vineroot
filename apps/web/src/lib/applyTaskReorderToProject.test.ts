import { describe, it, expect } from 'vitest';
import { applyTaskReorderToProject, flattenProjectTasks } from './applyTaskReorderToProject';
import type { Project, Task } from '../types';

function mkTask(id: string, sectionId: string, sortOrder: number, title: string): Task {
  return {
    id,
    sectionId,
    createdById: 'u1',
    title,
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder,
    actorTier: 'UNASSIGNED',
    domain: 'GENERAL',
    complexity: 'LOW',
    reviewGate: 'NONE',
    retryCount: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('applyTaskReorderToProject', () => {
  it('moves a task between sections and updates sortOrder', () => {
    const project: Project = {
      id: 'p1',
      workspaceIds: ['w1'],
      name: 'P',
      color: 'BLUE',
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'list',
      sections: [
        {
          id: 's1',
          projectId: 'p1',
          name: 'A',
          sortOrder: 0,
          tasks: [mkTask('t1', 's1', 0, 'One'), mkTask('t2', 's1', 1, 'Two')],
        },
        {
          id: 's2',
          projectId: 'p1',
          name: 'B',
          sortOrder: 1,
          tasks: [mkTask('t3', 's2', 0, 'Three')],
        },
      ],
    };

    const items = [
      { taskId: 't2', sortOrder: 0, sectionId: 's1' },
      { taskId: 't3', sortOrder: 0, sectionId: 's2' },
      { taskId: 't1', sortOrder: 1, sectionId: 's2' },
    ];

    const next = applyTaskReorderToProject(project, items);

    const s1 = next.sections?.find((s) => s.id === 's1');
    const s2 = next.sections?.find((s) => s.id === 's2');
    expect(s1?.tasks?.map((t) => t.id)).toEqual(['t2']);
    expect(s2?.tasks?.map((t) => t.id)).toEqual(['t3', 't1']);
    expect(s2?.tasks?.[1]?.sectionId).toBe('s2');
    expect(s2?.tasks?.[1]?.sortOrder).toBe(1);

    const flat = flattenProjectTasks(next);
    expect(flat.map((t) => t.id).sort()).toEqual(['t1', 't2', 't3']);
  });

  it('preserves nested subtasks and cascades section when a root moves columns', () => {
    const child = {
      ...mkTask('c1', 's1', 0, 'Child'),
      parentTaskId: 't1',
      subtasks: [] as Task[],
    };
    const root = {
      ...mkTask('t1', 's1', 0, 'Root'),
      subtasks: [child],
    };
    const project: Project = {
      id: 'p1',
      workspaceIds: ['w1'],
      name: 'P',
      color: 'BLUE',
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'list',
      sections: [
        {
          id: 's1',
          projectId: 'p1',
          name: 'A',
          sortOrder: 0,
          tasks: [root],
        },
        {
          id: 's2',
          projectId: 'p1',
          name: 'B',
          sortOrder: 1,
          tasks: [],
        },
      ],
    };

    const next = applyTaskReorderToProject(project, [
      { taskId: 't1', sortOrder: 0, sectionId: 's2' },
    ]);

    const s2 = next.sections?.find((s) => s.id === 's2');
    expect(s2?.tasks?.[0].id).toBe('t1');
    expect(s2?.tasks?.[0].sectionId).toBe('s2');
    expect(s2?.tasks?.[0].subtasks?.[0].id).toBe('c1');
    expect(s2?.tasks?.[0].subtasks?.[0].sectionId).toBe('s2');
  });

  it('reorders subtasks under a root without changing sectionId', () => {
    const c0 = { ...mkTask('c0', 's1', 0, 'First'), parentTaskId: 'root' as const, subtasks: [] as Task[] };
    const c1 = { ...mkTask('c1', 's1', 1, 'Second'), parentTaskId: 'root' as const, subtasks: [] as Task[] };
    const root = { ...mkTask('root', 's1', 0, 'Root'), subtasks: [c0, c1] };
    const project: Project = {
      id: 'p1',
      workspaceIds: ['w1'],
      name: 'P',
      color: 'BLUE',
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'list',
      sections: [
        {
          id: 's1',
          projectId: 'p1',
          name: 'A',
          sortOrder: 0,
          tasks: [root],
        },
      ],
    };

    const next = applyTaskReorderToProject(project, [
      { taskId: 'c1', sortOrder: 0 },
      { taskId: 'c0', sortOrder: 1 },
    ]);

    const subs = next.sections?.[0].tasks?.[0].subtasks;
    expect(subs?.map((t) => t.id)).toEqual(['c1', 'c0']);
    expect(subs?.every((t) => t.sectionId === 's1')).toBe(true);
  });

  it('cascades section to deep descendants when root moves columns', () => {
    const gc = {
      ...mkTask('gc', 's1', 0, 'Grandchild'),
      parentTaskId: 'c1' as const,
      subtasks: [] as Task[],
    };
    const c1 = {
      ...mkTask('c1', 's1', 0, 'Child'),
      parentTaskId: 'root' as const,
      subtasks: [gc],
    };
    const root = { ...mkTask('root', 's1', 0, 'Root'), subtasks: [c1] };
    const project: Project = {
      id: 'p1',
      workspaceIds: ['w1'],
      name: 'P',
      color: 'BLUE',
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'list',
      sections: [
        {
          id: 's1',
          projectId: 'p1',
          name: 'A',
          sortOrder: 0,
          tasks: [root],
        },
        {
          id: 's2',
          projectId: 'p1',
          name: 'B',
          sortOrder: 1,
          tasks: [],
        },
      ],
    };

    const next = applyTaskReorderToProject(project, [
      { taskId: 'root', sortOrder: 0, sectionId: 's2' },
    ]);

    const moved = next.sections?.find((s) => s.id === 's2')?.tasks?.[0];
    expect(moved?.sectionId).toBe('s2');
    expect(moved?.subtasks?.[0].sectionId).toBe('s2');
    expect(moved?.subtasks?.[0].subtasks?.[0].sectionId).toBe('s2');
  });

  it('reparents a subtask under another root and cascades section to its descendants', () => {
    const leaf = {
      ...mkTask('leaf', 's1', 0, 'Leaf'),
      parentTaskId: 'movable' as const,
      subtasks: [] as Task[],
    };
    const movable = {
      ...mkTask('movable', 's1', 0, 'Mov'),
      parentTaskId: 'p1' as const,
      subtasks: [leaf],
    };
    const p1 = { ...mkTask('p1', 's1', 0, 'P1'), subtasks: [movable] };
    const p2 = { ...mkTask('p2', 's1', 1, 'P2'), subtasks: [] as Task[] };
    const project: Project = {
      id: 'p1',
      workspaceIds: ['w1'],
      name: 'P',
      color: 'BLUE',
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'list',
      sections: [
        {
          id: 's1',
          projectId: 'p1',
          name: 'A',
          sortOrder: 0,
          tasks: [p1, p2],
        },
      ],
    };

    const next = applyTaskReorderToProject(project, [
      { taskId: 'p1', sortOrder: 0 },
      { taskId: 'movable', sortOrder: 0, parentTaskId: 'p2', sectionId: 's1' },
      { taskId: 'p2', sortOrder: 1 },
    ]);

    const p2Node = next.sections?.[0].tasks?.find((t) => t.id === 'p2');
    const moved = p2Node?.subtasks?.find((t) => t.id === 'movable');
    expect(moved?.parentTaskId).toBe('p2');
    expect(moved?.subtasks?.[0].sectionId).toBe('s1');
  });
});
