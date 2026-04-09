import { TaskWorkContour } from '@vineroot/shared-types';
import {
  allocateIntegerByWeights,
  computeTaskTimephasedCells,
  dayWeightsForContour,
} from './schedule-timephased.util';
import type { WorkingBasisPack } from './schedule-timephased.util';

const noWorking: WorkingBasisPack | null = null;

describe('schedule-timephased.util', () => {
  it('dayWeightsForContour FRONT_LOADED decreases toward end', () => {
    const w = dayWeightsForContour(4, TaskWorkContour.FRONT_LOADED);
    expect(w).toEqual([4, 3, 2, 1]);
  });

  it('dayWeightsForContour TURTLE is high at ends', () => {
    const w = dayWeightsForContour(5, TaskWorkContour.TURTLE);
    expect(w[0]).toBeGreaterThan(w[2]);
    expect(w[4]).toBeGreaterThan(w[2]);
  });

  it('dayWeightsForContour DOUBLE_PEAK has two high regions', () => {
    const w = dayWeightsForContour(9, TaskWorkContour.DOUBLE_PEAK);
    expect(w[2]).toBeGreaterThan(w[4]);
    expect(w[6]).toBeGreaterThan(w[4]);
  });

  it('allocateIntegerByWeights preserves total', () => {
    expect(allocateIntegerByWeights(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(allocateIntegerByWeights(100, [3, 2, 1]).reduce((a, b) => a + b, 0)).toBe(
      100,
    );
  });

  it('computeTaskTimephasedCells FLAT matches uniform split for 3 days (calendar)', () => {
    const d0 = new Date(Date.UTC(2026, 2, 2, 12, 0, 0));
    const d2 = new Date(Date.UTC(2026, 2, 4, 12, 0, 0));
    const cells = computeTaskTimephasedCells({
      taskId: 't1',
      taskTitle: 'T',
      startDate: d0,
      dueDate: d2,
      workTotal: 300,
      costTotal: null,
      scheduleSegments: null,
      workContour: TaskWorkContour.FLAT,
      granularity: 'day',
      basis: 'calendar',
      workingPack: noWorking,
    });
    expect(cells).toHaveLength(3);
    expect(cells.reduce((s, c) => s + c.workMinutes, 0)).toBe(300);
    expect(cells[0].workMinutes).toBe(100);
    expect(cells[2].workMinutes).toBe(100);
  });

  it('computeTaskTimephasedCells FRONT_LOADED puts more work on first day', () => {
    const d0 = new Date(Date.UTC(2026, 2, 2, 12, 0, 0));
    const d2 = new Date(Date.UTC(2026, 2, 4, 12, 0, 0));
    const cells = computeTaskTimephasedCells({
      taskId: 't1',
      taskTitle: 'T',
      startDate: d0,
      dueDate: d2,
      workTotal: 300,
      costTotal: null,
      scheduleSegments: null,
      workContour: TaskWorkContour.FRONT_LOADED,
      granularity: 'day',
      basis: 'calendar',
      workingPack: noWorking,
    });
    expect(cells.reduce((s, c) => s + c.workMinutes, 0)).toBe(300);
    expect(cells[0].workMinutes).toBeGreaterThan(cells[2].workMinutes);
  });

  it('computeTaskTimephasedCells uses scheduleSegments over contour', () => {
    const start = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
    const end = new Date(Date.UTC(2026, 0, 10, 12, 0, 0));
    const cells = computeTaskTimephasedCells({
      taskId: 't1',
      taskTitle: 'Split',
      startDate: start,
      dueDate: end,
      workTotal: 200,
      costTotal: null,
      scheduleSegments: [
        {
          start: '2026-01-01T00:00:00.000Z',
          end: '2026-01-03T23:59:59.999Z',
        },
        {
          start: '2026-01-08T00:00:00.000Z',
          end: '2026-01-10T23:59:59.999Z',
        },
      ],
      workContour: TaskWorkContour.FRONT_LOADED,
      granularity: 'day',
      basis: 'calendar',
      workingPack: noWorking,
    });
    const sum = cells.reduce((s, c) => s + c.workMinutes, 0);
    expect(sum).toBe(200);
    const jan8 = cells.find((c) => c.periodStart.startsWith('2026-01-08'));
    const jan2 = cells.find((c) => c.periodStart.startsWith('2026-01-02'));
    expect(jan8).toBeDefined();
    expect(jan2).toBeDefined();
    expect(cells.some((c) => c.periodStart.startsWith('2026-01-05'))).toBe(false);
  });

  it('working basis skips zero-capacity days for FLAT contour', () => {
    const pack: WorkingBasisPack = {
      weekly: {
        mon: 480,
        tue: 480,
        wed: 480,
        thu: 480,
        fri: 480,
        sat: 0,
        sun: 0,
      },
      exceptions: [],
      timeZone: 'UTC',
    };
    const mon = new Date(Date.UTC(2026, 0, 5, 12, 0, 0));
    const sun = new Date(Date.UTC(2026, 0, 11, 12, 0, 0));
    const cells = computeTaskTimephasedCells({
      taskId: 't1',
      taskTitle: 'W',
      startDate: mon,
      dueDate: sun,
      workTotal: 1000,
      costTotal: null,
      scheduleSegments: null,
      workContour: TaskWorkContour.FLAT,
      granularity: 'day',
      basis: 'working',
      workingPack: pack,
    });
    expect(cells.reduce((s, c) => s + c.workMinutes, 0)).toBe(1000);
    expect(cells.some((c) => c.periodStart.startsWith('2026-01-10'))).toBe(false);
    expect(cells.some((c) => c.periodStart.startsWith('2026-01-11'))).toBe(false);
    expect(cells.filter((c) => c.periodStart.startsWith('2026-01-05')).length).toBe(1);
  });
});
