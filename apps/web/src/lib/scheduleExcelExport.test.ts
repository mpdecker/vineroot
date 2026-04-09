import { describe, it, expect } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as XLSX from 'xlsx';
import type { TaskBaselineRowDto } from '@vineroot/shared-types';
import type { Section, Task } from '../types';
import {
  buildScheduleExcelWorkbook,
  collectDependencyRows,
  downloadScheduleExcelWorkbook,
  flattenTasksForExport,
} from './scheduleExcelExport';

const baseTask = (over: Partial<Task>): Task => ({
  id: 't1',
  title: 'Root',
  status: 'BACKLOG',
  priority: 'NONE',
  sortOrder: 0,
  actorTier: 'HUMAN',
  domain: 'GENERAL',
  complexity: 'LOW',
  reviewGate: 'NONE',
  retryCount: 0,
  isArchived: false,
  createdById: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

function tasksSheetHeaderRow(wb: XLSX.WorkBook): string[] {
  const sh = wb.Sheets['Tasks'];
  expect(sh).toBeDefined();
  const rows = XLSX.utils.sheet_to_json<string[]>(sh!, { header: 1, raw: false }) as string[][];
  expect(rows.length).toBeGreaterThan(0);
  return rows[0]!.map((c) => String(c));
}

function tasksSheetDataRows(wb: XLSX.WorkBook): Record<string, string>[] {
  const sh = wb.Sheets['Tasks'];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sh!, {
    raw: false,
    defval: '',
  });
}

describe('flattenTasksForExport', () => {
  it('returns empty array for empty sections', () => {
    expect(flattenTasksForExport([], true)).toEqual([]);
    expect(
      flattenTasksForExport(
        [{ id: 's', projectId: 'p', name: 'E', sortOrder: 0, tasks: [] }],
        true,
      ),
    ).toEqual([]);
  });

  it('walks WBS depth and carries section id/name', () => {
    const sections: Section[] = [
      {
        id: 'sec-a',
        projectId: 'p1',
        name: 'Alpha',
        sortOrder: 0,
        tasks: [
          baseTask({
            id: 'root',
            title: 'Root',
            subtasks: [baseTask({ id: 'child', title: 'Child' })],
          }),
        ],
      },
    ];
    const flat = flattenTasksForExport(sections, true);
    expect(flat.map((r) => [r.task.id, r.depth, r.sectionId, r.sectionName])).toEqual([
      ['root', 0, 'sec-a', 'Alpha'],
      ['child', 1, 'sec-a', 'Alpha'],
    ]);
  });

  it('with wbs false, omits nested subtasks from the flat list', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'S',
        sortOrder: 0,
        tasks: [
          baseTask({
            id: 'parent',
            subtasks: [baseTask({ id: 'nested', title: 'Nested' })],
          }),
        ],
      },
    ];
    const flat = flattenTasksForExport(sections, false);
    expect(flat.map((r) => r.task.id)).toEqual(['parent']);
  });

  it('preserves section order and task order within sections', () => {
    const sections: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'First',
        sortOrder: 0,
        tasks: [baseTask({ id: 'a' }), baseTask({ id: 'b' })],
      },
      {
        id: 's2',
        projectId: 'p1',
        name: 'Second',
        sortOrder: 1,
        tasks: [baseTask({ id: 'c' })],
      },
    ];
    expect(flattenTasksForExport(sections, true).map((r) => r.task.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('collectDependencyRows', () => {
  it('lists waitingOn edges with predecessor in the flat set', () => {
    const pred = baseTask({ id: 'pred', title: 'Pred' });
    const succ = baseTask({
      id: 'succ',
      title: 'Succ',
      waitingOn: [
        {
          id: 'dep1',
          dependentId: 'succ',
          blockingId: 'pred',
          type: 'FS',
          linkType: 'FINISH_TO_START',
          lagDays: 2,
          lagIsElapsed: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          blockingTask: { id: 'pred', title: 'Pred', status: 'BACKLOG' },
        },
      ],
    });
    const flat = [
      { task: pred, sectionId: 's', sectionName: 'S', depth: 0 },
      { task: succ, sectionId: 's', sectionName: 'S', depth: 0 },
    ];
    const edges = collectDependencyRows(flat);
    expect(edges).toHaveLength(1);
    expect(edges[0].dep.blockingId).toBe('pred');
    expect(edges[0].successor.id).toBe('succ');
  });

  it('uses blockingId when blockingTask summary is absent', () => {
    const pred = baseTask({ id: 'p1', title: 'P' });
    const succ = baseTask({
      id: 's1',
      waitingOn: [
        {
          id: 'd1',
          dependentId: 's1',
          blockingId: 'p1',
          type: 'SS',
          lagDays: -1,
          lagIsElapsed: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const flat = [
      { task: pred, sectionId: 's', sectionName: 'S', depth: 0 },
      { task: succ, sectionId: 's', sectionName: 'S', depth: 0 },
    ];
    const edges = collectDependencyRows(flat);
    expect(edges).toHaveLength(1);
    expect(edges[0].dep.lagDays).toBe(-1);
    expect(edges[0].dep.lagIsElapsed).toBe(true);
  });

  it('skips edges whose predecessor is not in the flat task set', () => {
    const succ = baseTask({
      id: 'succ',
      waitingOn: [
        {
          id: 'd1',
          dependentId: 'succ',
          blockingId: 'missing-pred',
          type: 'FS',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const flat = [{ task: succ, sectionId: 's', sectionName: 'S', depth: 0 }];
    expect(collectDependencyRows(flat)).toHaveLength(0);
  });

  it('skips dependencies without a resolved predecessor id', () => {
    const succ = baseTask({
      id: 'succ',
      waitingOn: [
        {
          id: 'd1',
          dependentId: 'succ',
          blockingId: '',
          type: 'FS',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const flat = [{ task: succ, sectionId: 's', sectionName: 'S', depth: 0 }];
    expect(collectDependencyRows(flat)).toHaveLength(0);
  });

  it('dedupes by dependency id', () => {
    const dep = {
      id: 'same-dep',
      dependentId: 'succ',
      blockingId: 'pred',
      type: 'FS',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const pred = baseTask({ id: 'pred' });
    const succ = baseTask({
      id: 'succ',
      waitingOn: [dep, { ...dep }],
    });
    const flat = [
      { task: pred, sectionId: 's', sectionName: 'S', depth: 0 },
      { task: succ, sectionId: 's', sectionName: 'S', depth: 0 },
    ];
    expect(collectDependencyRows(flat)).toHaveLength(1);
  });
});

describe('buildScheduleExcelWorkbook', () => {
  it('includes expected sheets in order', () => {
    const task = baseTask({ id: 'x', title: 'Task' });
    const sections: Section[] = [
      { id: 's1', projectId: 'p1', name: 'Sec', sortOrder: 0, tasks: [task] },
    ];
    const wb = buildScheduleExcelWorkbook({
      sections,
      projectId: 'p1',
      projectName: 'Demo',
      baselineRows: [],
      wbs: true,
    });
    expect(wb.SheetNames).toEqual(['About', 'Tasks', 'Dependencies', 'Baselines']);
  });

  it('Tasks sheet exposes extended schedule columns', () => {
    const wb = buildScheduleExcelWorkbook({
      sections: [
        {
          id: 'sid',
          projectId: 'p1',
          name: 'Sec',
          sortOrder: 0,
          tasks: [],
        },
      ],
      projectId: 'p1',
      baselineRows: [],
      wbs: true,
    });
    const header = tasksSheetHeaderRow(wb);
    expect(header).toEqual(
      expect.arrayContaining([
        'sectionId',
        'section',
        'priority',
        'workCalendarId',
        'workContour',
        'assignees',
        'genericResources',
        'scheduleSegmentsJson',
      ]),
    );
  });

  it('maps task fields, assignees, generics, and schedule segments JSON', () => {
    const task = baseTask({
      id: 'task-1',
      title: 'Do work',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      startDate: '2026-02-01T08:00:00.000Z',
      dueDate: '2026-02-10T17:00:00.000Z',
      durationWorkingMinutes: 2400,
      workMinutes: 1200,
      percentComplete: 40,
      isMilestone: false,
      constraintType: 'START_NO_EARLIER_THAN',
      constraintDate: '2026-02-01T00:00:00.000Z',
      deadlineDate: '2026-03-01T00:00:00.000Z',
      scheduleMode: 'FIXED_WORK',
      workCalendarId: 'cal-99',
      effortDriven: true,
      isSummaryRollup: false,
      workContour: 'FRONT_LOADED',
      levelingPriority: 100,
      levelingDelayWorkingDays: 2,
      overtimeWorkMinutes: 30,
      isBudgetTask: false,
      fixedCost: 99.5,
      actualCost: 10,
      isManuallyScheduled: true,
      wbsOutlineNumber: '1.2',
      assignees: [
        {
          id: 'as1',
          userId: 'u1',
          user: {
            id: 'u1',
            email: 'a@b.c',
            displayName: 'Alex Agent',
            isAgent: false,
            timezone: 'UTC',
          },
          assignedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      genericResourceAssignments: [
        {
          id: 'ga1',
          taskId: 'task-1',
          genericResourceId: 'gr1',
          unitsPercent: 50,
          assignedAt: '2026-01-01T00:00:00.000Z',
          genericResource: {
            id: 'gr1',
            name: 'Excavator',
            maxUnitsPercent: 200,
          },
        },
      ],
      scheduleSegments: [
        { start: '2026-02-01T00:00:00.000Z', end: '2026-02-03T00:00:00.000Z', workMinutes: 400 },
      ],
    });
    const wb = buildScheduleExcelWorkbook({
      sections: [{ id: 'sec-x', projectId: 'p1', name: 'Lane', sortOrder: 0, tasks: [task] }],
      projectId: 'proj-9',
      projectName: 'Nine',
      baselineRows: [],
      wbs: true,
    });
    const rows = tasksSheetDataRows(wb);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.sectionId).toBe('sec-x');
    expect(r.section).toBe('Lane');
    expect(r.taskId).toBe('task-1');
    expect(r.title).toBe('Do work');
    expect(r.priority).toBe('HIGH');
    expect(r.workCalendarId).toBe('cal-99');
    expect(r.effortDriven).toBe('Y');
    expect(r.workContour).toBe('FRONT_LOADED');
    expect(r.assignees).toBe('Alex Agent');
    expect(r.genericResources).toBe('Excavator');
    expect(r.scheduleSegmentsJson).toContain('2026-02-01');
    expect(r.scheduleSegmentsJson).toContain('workMinutes');

    const about = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['About']!, {
      header: 1,
      raw: false,
    }) as string[][];
    expect(about[1]?.[1]).toBe('proj-9');
    expect(about[2]?.[1]).toBe('Nine');
  });

  it('writes dependency rows with link type and lag flags', () => {
    const pred = baseTask({ id: 'p', title: 'Pred' });
    const succ = baseTask({
      id: 's',
      title: 'Succ',
      waitingOn: [
        {
          id: 'dep-x',
          dependentId: 's',
          blockingId: 'p',
          type: 'FS',
          linkType: 'FINISH_TO_START',
          lagDays: 3,
          lagIsElapsed: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          blockingTask: { id: 'p', title: 'Pred', status: 'BACKLOG' },
        },
      ],
    });
    const wb = buildScheduleExcelWorkbook({
      sections: [{ id: 's1', projectId: 'p1', name: 'S', sortOrder: 0, tasks: [pred, succ] }],
      projectId: 'p1',
      baselineRows: [],
      wbs: true,
    });
    const depRows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets['Dependencies']!, {
      raw: false,
    });
    expect(depRows).toHaveLength(1);
    expect(depRows[0].predecessorTaskId).toBe('p');
    expect(depRows[0].successorTaskId).toBe('s');
    expect(depRows[0].linkType).toBe('FINISH_TO_START');
    expect(depRows[0].lagDays).toBe('3');
    expect(depRows[0].lagIsElapsed).toBe('Y');
  });

  it('sorts baselines by taskId then baselineIndex', () => {
    const baselineRows: TaskBaselineRowDto[] = [
      {
        taskId: 'b',
        baselineIndex: 1,
        baselineStart: null,
        baselineFinish: null,
        baselineWorkMinutes: null,
        baselineCost: null,
        savedAt: null,
      },
      {
        taskId: 'a',
        baselineIndex: 2,
        baselineStart: null,
        baselineFinish: null,
        baselineWorkMinutes: null,
        baselineCost: null,
        savedAt: null,
      },
      {
        taskId: 'a',
        baselineIndex: 0,
        baselineStart: null,
        baselineFinish: null,
        baselineWorkMinutes: null,
        baselineCost: null,
        savedAt: null,
      },
    ];
    const wb = buildScheduleExcelWorkbook({
      sections: [{ id: 's1', projectId: 'p1', name: 'S', sortOrder: 0, tasks: [] }],
      projectId: 'p1',
      baselineRows,
      wbs: true,
    });
    const baseRows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets['Baselines']!, {
      raw: false,
    });
    expect(baseRows.map((x) => `${x.taskId}:${x.baselineIndex}`)).toEqual([
      'a:0',
      'a:2',
      'b:1',
    ]);
  });

  it('round-trips through xlsx buffer read', () => {
    const wb = buildScheduleExcelWorkbook({
      sections: [{ id: 's1', projectId: 'p1', name: 'S', sortOrder: 0, tasks: [baseTask({ id: 'z' })] }],
      projectId: 'p1',
      baselineRows: [],
      wbs: true,
    });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const read = XLSX.read(buf, { type: 'buffer' });
    expect(read.SheetNames).toEqual(wb.SheetNames);
  });
});

describe('downloadScheduleExcelWorkbook', () => {
  it('writes a valid .xlsx file via SheetJS (Node fs)', () => {
    const wb = buildScheduleExcelWorkbook({
      sections: [],
      projectId: 'p1',
      baselineRows: [],
      wbs: true,
    });
    const path = join(tmpdir(), `vineroot-schedule-export-${Date.now()}.xlsx`);
    try {
      downloadScheduleExcelWorkbook(wb, path);
      expect(existsSync(path)).toBe(true);
      const read = XLSX.readFile(path);
      expect(read.SheetNames).toEqual(['About', 'Tasks', 'Dependencies', 'Baselines']);
    } finally {
      try {
        unlinkSync(path);
      } catch {
        /* ignore */
      }
    }
  });
});
