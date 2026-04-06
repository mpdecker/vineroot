import { describe, it, expect } from 'vitest';
import type { DragEndEvent } from '@dnd-kit/core';
import type { Section, Task } from '../types';
import {
  buildColumnsMap,
  columnsToReorderItems,
  computeReorderItemsFromDragEnd,
  findSectionForTask,
  reorderItemsForPromoteToRoot,
  reorderItemsReparentUnderNewParent,
  subtasksDropId,
} from './projectTaskDnD';

function mkTask(id: string, o: Partial<Task> = {}): Task {
  return {
    id,
    createdById: 'u1',
    title: id,
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder: 0,
    sectionId: 's1',
    actorTier: 'HUMAN',
    domain: 'GENERAL',
    complexity: 'LOW',
    reviewGate: 'NONE',
    retryCount: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...o,
  };
}

function dragEnd(activeId: string, overId: string): DragEndEvent {
  return {
    active: { id: activeId },
    over: { id: overId },
  } as DragEndEvent;
}

describe('projectTaskDnD', () => {
  it('buildColumnsMap lists only root tasks per section', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [
          mkTask('r1', { sortOrder: 1 }),
          mkTask('r0', { sortOrder: 0, subtasks: [mkTask('c1', { parentTaskId: 'r0' })] }),
        ],
      },
    ];
    expect(buildColumnsMap(sections).s1).toEqual(['r0', 'r1']);
  });

  it('computeReorderItemsFromDragEnd reorders root tasks within a section', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [mkTask('a', { sortOrder: 0 }), mkTask('b', { sortOrder: 1 })],
      },
    ];
    const items = computeReorderItemsFromDragEnd(dragEnd('a', 'b'), sections);
    expect(items?.map((i) => i.taskId)).toEqual(['b', 'a']);
    expect(items?.every((i) => i.sectionId === 's1')).toBe(true);
  });

  it('computeReorderItemsFromDragEnd reorders root when over target is a subtask id (nested hit)', () => {
    const child = mkTask('child', { parentTaskId: 'b', sortOrder: 0 });
    const b = mkTask('b', { sortOrder: 1, subtasks: [child] });
    const a = mkTask('a', { sortOrder: 0 });
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [a, b],
      },
    ];
    const items = computeReorderItemsFromDragEnd(dragEnd('a', 'child'), sections);
    const order = [...(items ?? [])]
      .filter((i) => i.sectionId === 's1')
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map((i) => i.taskId);
    expect(order).toEqual(['b', 'a']);
  });

  it('computeReorderItemsFromDragEnd reorders subtasks under the same parent', () => {
    const childA = mkTask('ca', { parentTaskId: 'root', sortOrder: 0 });
    const childB = mkTask('cb', { parentTaskId: 'root', sortOrder: 1 });
    const root = mkTask('root', { sortOrder: 0, subtasks: [childA, childB] });
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [root],
      },
    ];

    const items = computeReorderItemsFromDragEnd(dragEnd('ca', 'cb'), sections);
    expect(items).toEqual([
      { taskId: 'cb', sortOrder: 0 },
      { taskId: 'ca', sortOrder: 1 },
    ]);
  });

  it('computeReorderItemsFromDragEnd moves subtask to end when dropped on subtasks droppable', () => {
    const c0 = mkTask('c0', { parentTaskId: 'p', sortOrder: 0 });
    const c1 = mkTask('c1', { parentTaskId: 'p', sortOrder: 1 });
    const c2 = mkTask('c2', { parentTaskId: 'p', sortOrder: 2 });
    const parent = mkTask('p', { sortOrder: 0, subtasks: [c0, c1, c2] });
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [parent],
      },
    ];

    const items = computeReorderItemsFromDragEnd(dragEnd('c0', subtasksDropId('p')), sections);
    expect(items?.map((i) => i.taskId)).toEqual(['c1', 'c2', 'c0']);
  });

  it('findSectionForTask resolves root column membership', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [mkTask('r1', { sortOrder: 0 })],
      },
      {
        id: 's2',
        projectId: 'p1',
        name: 'B',
        sortOrder: 1,
        tasks: [mkTask('r2', { sortOrder: 0 })],
      },
    ];
    const cols = buildColumnsMap(sections);
    expect(findSectionForTask('r1', cols)).toBe('s1');
    expect(findSectionForTask('r2', cols)).toBe('s2');
    expect(findSectionForTask('ghost', cols)).toBeNull();
  });

  it('columnsToReorderItems flattens column map with sortOrder indices', () => {
    const items = columnsToReorderItems({ s1: ['a', 'b'], s2: ['c'] });
    expect(items).toEqual([
      { taskId: 'a', sortOrder: 0, sectionId: 's1' },
      { taskId: 'b', sortOrder: 1, sectionId: 's1' },
      { taskId: 'c', sortOrder: 0, sectionId: 's2' },
    ]);
  });

  it('computeReorderItemsFromDragEnd moves root to another section before target', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [mkTask('a', { sortOrder: 0 }), mkTask('b', { sortOrder: 1 })],
      },
      {
        id: 's2',
        projectId: 'p1',
        name: 'B',
        sortOrder: 1,
        tasks: [mkTask('c', { sortOrder: 0 })],
      },
    ];
    const items = computeReorderItemsFromDragEnd(dragEnd('a', 'c'), sections);
    expect(items).toEqual([
      { taskId: 'b', sortOrder: 0, sectionId: 's1' },
      { taskId: 'a', sortOrder: 0, sectionId: 's2' },
      { taskId: 'c', sortOrder: 1, sectionId: 's2' },
    ]);
  });

  it('computeReorderItemsFromDragEnd returns null when subtask dropped on its descendant', () => {
    const leaf = mkTask('leaf', { parentTaskId: 'mid', sortOrder: 0 });
    const mid = mkTask('mid', { parentTaskId: 'root', sortOrder: 0, subtasks: [leaf] });
    const root = mkTask('root', { sortOrder: 0, subtasks: [mid] });
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [root],
      },
    ];
    expect(computeReorderItemsFromDragEnd(dragEnd('mid', 'leaf'), sections)).toBeNull();
  });

  it('computeReorderItemsFromDragEnd returns null for root drag with no over target', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [mkTask('only', { sortOrder: 0 })],
      },
    ];
    expect(
      computeReorderItemsFromDragEnd({ active: { id: 'only' }, over: null } as DragEndEvent, sections),
    ).toBeNull();
  });

  it('computeReorderItemsFromDragEnd promotes subtask when dropped on column', () => {
    const child = mkTask('c', { parentTaskId: 'r', sortOrder: 0 });
    const root = mkTask('r', { sortOrder: 0, subtasks: [child] });
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [root],
      },
    ];
    const items = computeReorderItemsFromDragEnd(dragEnd('c', 'column:s1'), sections);
    expect(items?.some((i) => i.taskId === 'c' && i.parentTaskId === null && i.sectionId === 's1')).toBe(
      true,
    );
  });

  it('computeReorderItemsFromDragEnd reparents subtask to another parent subtasks zone', () => {
    const c = mkTask('c', { parentTaskId: 'p1', sortOrder: 0 });
    const p1 = mkTask('p1', { sortOrder: 0, subtasks: [c] });
    const p2 = mkTask('p2', { sortOrder: 1, subtasks: [] as Task[] });
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [p1, p2],
      },
    ];
    const items = computeReorderItemsFromDragEnd(dragEnd('c', subtasksDropId('p2')), sections);
    expect(items?.find((i) => i.taskId === 'c')).toMatchObject({
      parentTaskId: 'p2',
      sectionId: 's1',
    });
  });

  it('reorderItemsReparentUnderNewParent returns null when nesting would exceed max depth', () => {
    const leaf = mkTask('leaf', { parentTaskId: 'movable', sortOrder: 0 });
    const movable = mkTask('movable', { parentTaskId: 'mp', sortOrder: 0, subtasks: [leaf] });
    const mp = mkTask('mp', { parentTaskId: 'r', sortOrder: 0 });
    const target = mkTask('target', { parentTaskId: 'y', sortOrder: 0 });
    const y = mkTask('y', { parentTaskId: 'x', sortOrder: 0, subtasks: [target] });
    const x = mkTask('x', { parentTaskId: 'r', sortOrder: 1, subtasks: [y] });
    const r = mkTask('r', { sortOrder: 0, subtasks: [mp, x] });
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [r],
      },
    ];
    expect(reorderItemsReparentUnderNewParent('movable', 'target', sections)).toBeNull();
  });

  it('reorderItemsForPromoteToRoot returns null for root tasks', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [mkTask('r', { sortOrder: 0 })],
      },
    ];
    expect(reorderItemsForPromoteToRoot('r', 's1', sections)).toBeNull();
  });
});
