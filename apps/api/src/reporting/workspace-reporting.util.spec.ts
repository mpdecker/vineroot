import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import {
  computeFlowMetrics,
  computeThroughputByWeek,
  normalizeReportingFilters,
  summaryToCsv,
} from './workspace-reporting.util';
import type { WorkspaceReportingSummaryDto } from '@vineroot/shared-types';

describe('workspace-reporting.util', () => {
  it('normalizeReportingFilters applies default ~30d window when empty', () => {
    const n = normalizeReportingFilters({});
    expect(n.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(n.fromDate.getTime()).toBeLessThanOrEqual(n.toDate.getTime());
  });

  it('normalizeReportingFilters rejects from after to', () => {
    expect(() =>
      normalizeReportingFilters({ from: '2026-02-01', to: '2026-01-01' }),
    ).toThrow(BadRequestException);
  });

  it('summaryToCsv includes KPI rows', () => {
    const s: WorkspaceReportingSummaryDto = {
      workspaceId: 'ws',
      period: { from: '2026-01-01', to: '2026-01-31' },
      appliedFilters: {},
      tasksByStatus: { DONE: 2 },
      openTaskCount: 3,
      completedLast30Days: 1,
      createdLast30Days: 4,
      throughputByWeek: [
        { weekStart: '2026-01-05', weekEnd: '2026-01-11', completedCount: 1 },
      ],
      flowMetrics: {
        leadTimeDays: { avg: 2.5, median: 2, sampleSize: 1 },
        cycleTimeDays: { avg: null, median: null, sampleSize: 0 },
      },
      workload: [{ userId: 'u1', displayName: 'A', openTaskCount: 2 }],
    };
    const csv = summaryToCsv(s);
    expect(csv).toContain('openTaskCount,3');
    expect(csv).toContain('DONE,2');
    expect(csv).toContain('workspaceId,ws');
    expect(csv).toContain('leadTimeAvgDays,2.5');
    expect(csv).toContain('throughput,2026-01-05..2026-01-11,1');
  });

  it('computeThroughputByWeek buckets completions by calendar week', () => {
    const from = new Date(2026, 0, 5);
    const to = new Date(2026, 0, 11, 23, 59, 59, 999);
    const rows = computeThroughputByWeek(
      [
        {
          status: TaskStatus.DONE,
          completedAt: new Date(2026, 0, 8),
        },
        {
          status: TaskStatus.DONE,
          completedAt: new Date(2026, 0, 15),
        },
      ],
      from,
      to,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].completedCount).toBe(1);
  });

  it('computeFlowMetrics derives lead and cycle days for DONE in window', () => {
    const from = new Date(2026, 0, 1);
    const to = new Date(2026, 0, 31, 23, 59, 59, 999);
    const fm = computeFlowMetrics(
      [
        {
          status: TaskStatus.DONE,
          createdAt: new Date(2026, 0, 1),
          startDate: new Date(2026, 0, 3),
          completedAt: new Date(2026, 0, 5),
        },
        {
          status: TaskStatus.DONE,
          createdAt: new Date(2026, 0, 1),
          startDate: null,
          completedAt: new Date(2026, 0, 10),
        },
      ],
      from,
      to,
    );
    expect(fm.leadTimeDays.sampleSize).toBe(2);
    expect(fm.cycleTimeDays.sampleSize).toBe(1);
    expect(fm.cycleTimeDays.avg).toBe(2);
  });
});
