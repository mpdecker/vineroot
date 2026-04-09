import { describe, it, expect } from 'vitest';
import { mergeProgramWorkloads } from './mergeProgramWorkloads';
import type { ProjectWorkloadDto } from '@vineroot/shared-types';

function workload(
  projectId: string,
  rows: ProjectWorkloadDto['rows'],
): ProjectWorkloadDto {
  return {
    projectId,
    from: '2026-01-05',
    to: '2026-03-30',
    weekStarts: ['2026-01-05', '2026-01-12'],
    rows,
  };
}

describe('mergeProgramWorkloads', () => {
  it('returns null for empty list', () => {
    expect(mergeProgramWorkloads([])).toBeNull();
  });

  it('sums cells per user across projects', () => {
    const a = workload('p1', [
      {
        userId: 'u1',
        displayName: 'Alex',
        weeks: [
          { taskCount: 1, storyPoints: 2, allocationPercent: 50 },
          { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
        ],
        unscheduled: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
        outOfRange: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
      },
    ]);
    const b = workload('p2', [
      {
        userId: 'u1',
        displayName: 'Alex',
        weeks: [
          { taskCount: 2, storyPoints: 1, allocationPercent: 80 },
          { taskCount: 1, storyPoints: 0, allocationPercent: 100 },
        ],
        unscheduled: { taskCount: 1, storyPoints: 0, allocationPercent: 100 },
        outOfRange: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
      },
    ]);
    const m = mergeProgramWorkloads([a, b]);
    expect(m).not.toBeNull();
    expect(m!.rows).toHaveLength(1);
    expect(m!.rows[0].weeks[0].taskCount).toBe(3);
    expect(m!.rows[0].weeks[0].allocationPercent).toBe(130);
    expect(m!.rows[0].unscheduled.taskCount).toBe(1);
  });

  it('returns null when week keys diverge', () => {
    const a = workload('p1', []);
    const b = { ...a, projectId: 'p2', weekStarts: ['2026-01-06', '2026-01-13'] };
    expect(mergeProgramWorkloads([a, b])).toBeNull();
  });

  it('returns null when week column count differs', () => {
    const a = workload('p1', []);
    const b = {
      ...a,
      projectId: 'p2',
      weekStarts: ['2026-01-05', '2026-01-12', '2026-01-19'],
    };
    expect(mergeProgramWorkloads([a, b])).toBeNull();
  });

  it('sorts merged rows by displayName for stable program rollup UI', () => {
    const a = workload('p1', [
      {
        userId: 'u2',
        displayName: 'Zed',
        weeks: [
          { taskCount: 1, storyPoints: 0, allocationPercent: 10 },
          { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
        ],
        unscheduled: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
        outOfRange: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
      },
    ]);
    const b = workload('p2', [
      {
        userId: 'u1',
        displayName: 'Ann',
        weeks: [
          { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
          { taskCount: 1, storyPoints: 2, allocationPercent: 20 },
        ],
        unscheduled: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
        outOfRange: { taskCount: 0, storyPoints: 0, allocationPercent: 0 },
      },
    ]);
    const m = mergeProgramWorkloads([a, b]);
    expect(m!.rows.map((r) => r.displayName)).toEqual(['Ann', 'Zed']);
    expect(m!.from).toBe('2026-01-05');
    expect(m!.to).toBe('2026-03-30');
  });
});
