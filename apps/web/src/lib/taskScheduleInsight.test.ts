import { describe, it, expect } from 'vitest';
import type { TaskScheduleResultDto } from '@vineroot/shared-types';
import { computeTaskScheduleInsight } from './taskScheduleInsight';
import type { Task } from '../types';

const baseTask = {
  id: 'task-1',
  createdById: 'u1',
  title: 'T',
  description: '',
  status: 'BACKLOG' as const,
  priority: 'NONE' as const,
  sortOrder: 0,
  actorTier: 'HUMAN' as const,
  domain: 'GENERAL' as const,
  complexity: 'LOW' as const,
  reviewGate: 'NONE' as const,
  retryCount: 0,
  isArchived: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} satisfies Task;

function row(partial: Partial<TaskScheduleResultDto>): TaskScheduleResultDto {
  return {
    taskId: 'task-1',
    startDate: null,
    dueDate: null,
    earlyStartDay: null,
    earlyFinishDay: null,
    totalSlackDays: null,
    ...partial,
  };
}

describe('computeTaskScheduleInsight', () => {
  it('returns undefined while loading or when API failed', () => {
    expect(
      computeTaskScheduleInsight(baseTask, new Map(), new Set(), {
        loading: true,
        loadFailed: false,
      }),
    ).toBeUndefined();
    expect(
      computeTaskScheduleInsight(baseTask, new Map(), new Set(), {
        loading: false,
        loadFailed: true,
      }),
    ).toBeUndefined();
  });

  it('returns undefined when no CP slack or deadline signal', () => {
    const m = new Map<string, TaskScheduleResultDto>();
    m.set('task-1', row({ totalSlackDays: 0, totalSlackWorkingDays: 0 }));
    expect(
      computeTaskScheduleInsight(baseTask, m, new Set(), {
        loading: false,
        loadFailed: false,
      }),
    ).toBeUndefined();
  });

  it('surfaces critical path without other fields', () => {
    expect(
      computeTaskScheduleInsight(baseTask, new Map(), new Set(['task-1']), {
        loading: false,
        loadFailed: false,
      }),
    ).toEqual({
      onCriticalPath: true,
      slackLabel: null,
      deadlineBreached: false,
    });
  });

  it('prefers working slack label when positive', () => {
    const m = new Map<string, TaskScheduleResultDto>();
    m.set(
      'task-1',
      row({ totalSlackWorkingDays: 3, totalSlackDays: 10 }),
    );
    expect(
      computeTaskScheduleInsight(baseTask, m, new Set(), {
        loading: false,
        loadFailed: false,
      })?.slackLabel,
    ).toBe('3w slack');
  });

  it('uses calendar slack when working slack is missing or zero', () => {
    const m = new Map<string, TaskScheduleResultDto>();
    m.set('task-1', row({ totalSlackWorkingDays: 0, totalSlackDays: 5 }));
    expect(
      computeTaskScheduleInsight(baseTask, m, new Set(), {
        loading: false,
        loadFailed: false,
      })?.slackLabel,
    ).toBe('5d slack');
  });

  it('detects deadline breach from schedule row', () => {
    const m = new Map<string, TaskScheduleResultDto>();
    m.set('task-1', row({ deadlineViolated: true }));
    expect(
      computeTaskScheduleInsight(baseTask, m, new Set(), {
        loading: false,
        loadFailed: false,
      }),
    ).toMatchObject({ deadlineBreached: true });
  });
});
