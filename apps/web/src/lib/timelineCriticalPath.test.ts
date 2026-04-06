import { describe, expect, it } from 'vitest';
import {
  taskCriticalDurationDays,
  computeCriticalPathTaskIds,
} from './timelineCriticalPath';
import type { Task } from '../types';

function task(partial: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: 'T',
    status: 'READY' as Task['status'],
    priority: 'MEDIUM' as Task['priority'],
    ...partial,
  } as Task;
}

describe('timelineCriticalPath', () => {
  it('taskCriticalDurationDays is 0 without dueDate', () => {
    expect(taskCriticalDurationDays(task({ id: 'a' }))).toBe(0);
  });

  it('taskCriticalDurationDays uses at least 1 day for milestones', () => {
    expect(
      taskCriticalDurationDays(
        task({
          id: 'a',
          dueDate: '2025-01-05T00:00:00.000Z',
          startDate: '2025-01-05T00:00:00.000Z',
        }),
      ),
    ).toBe(1);
  });

  it('computeCriticalPathTaskIds returns empty for cycle', () => {
    const a = task({ id: 'a', dueDate: '2025-01-10T00:00:00.000Z', waitingOn: [] });
    const b = task({
      id: 'b',
      dueDate: '2025-01-11T00:00:00.000Z',
      waitingOn: [{ blockingTask: { id: 'a' } } as any],
    });
    (a as any).waitingOn = [{ blockingTask: { id: 'b' } }];
    expect(computeCriticalPathTaskIds([a, b]).size).toBe(0);
  });

  it('computeCriticalPathTaskIds follows longest chain', () => {
    const t1 = task({ id: '1', dueDate: '2025-01-05T00:00:00.000Z', waitingOn: [] });
    const t2 = task({
      id: '2',
      dueDate: '2025-01-10T00:00:00.000Z',
      waitingOn: [{ blockingTask: { id: '1', title: '', status: 'DONE' } } as any],
    });
    const path = computeCriticalPathTaskIds([t1, t2]);
    expect(path.has('1')).toBe(true);
    expect(path.has('2')).toBe(true);
  });
});
