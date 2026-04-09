import { utcNoon, defaultWeeklyPattern } from './schedule-calendar.util';
import {
  topologicalSortTaskIds,
  runScheduleEngine,
  engineOutputToTaskDates,
  type EngineDepInput,
  type EngineTaskInput,
} from './schedule-engine.util';

const weekly = defaultWeeklyPattern();

function baseTask(id: string, overrides: Partial<EngineTaskInput> = {}): EngineTaskInput {
  return {
    id,
    parentTaskId: null,
    startDate: utcNoon(2026, 0, 5),
    dueDate: utcNoon(2026, 0, 5),
    isManuallyScheduled: false,
    isMilestone: false,
    isSummaryRollup: false,
    constraintType: 'ASAP',
    constraintDate: null,
    deadlineDate: null,
    durationWorkingMinutes: 480,
    workMinutes: null,
    scheduleMode: 'MANUAL',
    assigneeUnitsSum: 100,
    effortDriven: false,
    sortOrder: 0,
    ...overrides,
  };
}

function edge(
  dependentId: string,
  blockingId: string,
  o: Partial<EngineDepInput> = {},
): EngineDepInput {
  return {
    dependentId,
    blockingId,
    linkType: 'FS',
    lagDays: 0,
    lagIsElapsed: false,
    ...o,
  };
}

describe('topologicalSortTaskIds', () => {
  it('orders a simple chain A → B → C', () => {
    const ids = ['a', 'b', 'c'];
    const deps: EngineDepInput[] = [
      edge('b', 'a'),
      edge('c', 'b'),
    ];
    const order = topologicalSortTaskIds(ids, deps);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('ignores edges whose endpoints are not in taskIds', () => {
    const order = topologicalSortTaskIds(['x'], [
      edge('y', 'z'),
    ]);
    expect(order).toEqual(['x']);
  });

  it('throws on cyclic dependencies', () => {
    expect(() =>
      topologicalSortTaskIds(['a', 'b'], [
        edge('b', 'a'),
        edge('a', 'b'),
      ]),
    ).toThrow('Cyclic dependencies');
  });
});

describe('runScheduleEngine', () => {
  const projectStart = utcNoon(2026, 0, 5);

  it('schedules FS chain: successor starts after predecessor finishes', () => {
    const tasks = [
      baseTask('a', { durationWorkingMinutes: 480 }),
      baseTask('b', { durationWorkingMinutes: 480 }),
    ];
    const deps: EngineDepInput[] = [edge('b', 'a')];
    const { tasks: out, criticalTaskIds } = runScheduleEngine({
      tasks,
      deps,
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });

    const a = out.find((r) => r.taskId === 'a')!;
    const b = out.find((r) => r.taskId === 'b')!;
    expect(b.earlyStart.getTime()).toBeGreaterThan(a.earlyFinish.getTime());
    expect(criticalTaskIds).toContain('a');
    expect(criticalTaskIds).toContain('b');
  });

  it('keeps manually scheduled early start and does not mark manual tasks critical', () => {
    const manualStart = utcNoon(2026, 0, 12);
    const manualDue = utcNoon(2026, 0, 12);
    const tasks = [
      baseTask('a', {
        isManuallyScheduled: true,
        startDate: manualStart,
        dueDate: manualDue,
        durationWorkingMinutes: 480,
      }),
      baseTask('b', { durationWorkingMinutes: 480 }),
    ];
    const deps: EngineDepInput[] = [edge('b', 'a')];
    const { tasks: out, criticalTaskIds } = runScheduleEngine({
      tasks,
      deps,
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });

    const a = out.find((r) => r.taskId === 'a')!;
    expect(a.earlyStart.getTime()).toBe(manualStart.getTime());
    expect(criticalTaskIds).not.toContain('a');
    expect(out.find((r) => r.taskId === 'b')!.totalSlackDays).toBe(0);
  });

  it('treats milestone as zero duration', () => {
    const tasks = [baseTask('m', { isMilestone: true, durationWorkingMinutes: null })];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const m = out[0];
    expect(m.earlyStart.getTime()).toBe(m.earlyFinish.getTime());
  });

  it('applies SS link: successor early start aligns with predecessor start + lag', () => {
    const tasks = [
      baseTask('a', { durationWorkingMinutes: 960 }),
      baseTask('b', { durationWorkingMinutes: 480 }),
    ];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [edge('b', 'a', { linkType: 'SS' })],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const a = out.find((r) => r.taskId === 'a')!;
    const b = out.find((r) => r.taskId === 'b')!;
    expect(b.earlyStart.getTime()).toBe(a.earlyStart.getTime());
  });

  it('throws when graph is cyclic', () => {
    expect(() =>
      runScheduleEngine({
        tasks: [baseTask('a'), baseTask('b')],
        deps: [edge('b', 'a'), edge('a', 'b')],
        projectStart,
      }),
    ).toThrow('Cyclic dependencies');
  });

  it('MFO delays one-day task so finish lands on constraint day', () => {
    const tasks = [
      baseTask('x', {
        constraintType: 'MFO',
        constraintDate: utcNoon(2026, 0, 7),
        durationWorkingMinutes: 480,
      }),
    ];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const x = out[0];
    expect(x.earlyFinish.getTime()).toBe(utcNoon(2026, 0, 7).getTime());
    expect(x.earlyStart.getTime()).toBe(utcNoon(2026, 0, 7).getTime());
  });

  it('ALAP consumes slack: parallel short task aligns early dates with late dates', () => {
    const tasks = [
      baseTask('a', { durationWorkingMinutes: 5 * 480, sortOrder: 0 }),
      baseTask('b', {
        durationWorkingMinutes: 480,
        sortOrder: 1,
        constraintType: 'ALAP',
      }),
    ];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const b = out.find((r) => r.taskId === 'b')!;
    expect(b.earlyStart.getTime()).toBe(b.lateStart.getTime());
    expect(b.earlyFinish.getTime()).toBe(b.lateFinish.getTime());
    expect(b.totalSlackDays).toBe(0);
  });

  it('MSO pins schedule to start on constraint date (one-day task)', () => {
    const msoDay = utcNoon(2026, 0, 8);
    const tasks = [
      baseTask('m', {
        constraintType: 'MSO',
        constraintDate: msoDay,
        durationWorkingMinutes: 480,
      }),
    ];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const m = out[0];
    expect(m.earlyStart.getTime()).toBe(msoDay.getTime());
    expect(m.earlyFinish.getTime()).toBe(msoDay.getTime());
  });

  it('SNET defers early start to on or after constraint date', () => {
    const snetDay = utcNoon(2026, 0, 9);
    const tasks = [
      baseTask('s', {
        constraintType: 'SNET',
        constraintDate: snetDay,
        durationWorkingMinutes: 480,
        startDate: null,
        dueDate: null,
      }),
    ];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const s = out[0];
    expect(s.earlyStart.getTime()).toBeGreaterThanOrEqual(snetDay.getTime());
    expect(s.earlyFinish.getTime()).toBeGreaterThanOrEqual(s.earlyStart.getTime());
  });

  it('SF link: successor start aligns with predecessor finish', () => {
    const tasks = [
      baseTask('a', { durationWorkingMinutes: 2 * 480 }),
      baseTask('b', { durationWorkingMinutes: 480 }),
    ];
    const deps: EngineDepInput[] = [edge('b', 'a', { linkType: 'SF' })];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps,
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const a = out.find((r) => r.taskId === 'a')!;
    const b = out.find((r) => r.taskId === 'b')!;
    expect(b.earlyStart.getTime()).toBe(a.earlyFinish.getTime());
  });

  it('FF link: dependent finish aligns with predecessor finish + lag', () => {
    const tasks = [
      baseTask('a', { durationWorkingMinutes: 2 * 480 }),
      baseTask('b', { durationWorkingMinutes: 480 }),
    ];
    const deps: EngineDepInput[] = [edge('b', 'a', { linkType: 'FF' })];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps,
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const a = out.find((r) => r.taskId === 'a')!;
    const b = out.find((r) => r.taskId === 'b')!;
    expect(b.earlyFinish.getTime()).toBe(a.earlyFinish.getTime());
  });

  it('runScheduleEngine accepts calendar.timeZone for working-day resolution', () => {
    const tasks = [
      baseTask('z', {
        durationWorkingMinutes: 480,
        startDate: null,
        dueDate: null,
      }),
    ];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart: new Date('2026-01-05T04:00:00.000Z'),
      defaultCalendar: {
        weeklyPattern: weekly,
        exceptions: [],
        timeZone: 'America/New_York',
      },
    });
    const z = out[0];
    expect(z.taskId).toBe('z');
    expect(z.earlyStart.getTime()).toBeLessThanOrEqual(z.earlyFinish.getTime());
  });

  it('SNLT caps late start so slack reflects start-no-later-than', () => {
    const wedCap = utcNoon(2026, 0, 7);
    const tasks = [
      baseTask('a', { durationWorkingMinutes: 5 * 480 }),
      baseTask('b', {
        durationWorkingMinutes: 480,
        constraintType: 'SNLT',
        constraintDate: wedCap,
      }),
    ];
    const deps: EngineDepInput[] = [edge('b', 'a')];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps,
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const b = out.find((r) => r.taskId === 'b')!;
    expect(b.lateStart.getTime()).toBeLessThanOrEqual(wedCap.getTime());
  });

  it('gives shorter parallel branch positive slack when merge task waits on longer predecessor', () => {
    const tasks = [
      baseTask('a', { durationWorkingMinutes: 5 * 480 }),
      baseTask('b', { durationWorkingMinutes: 480 }),
      baseTask('c', { durationWorkingMinutes: 480 }),
    ];
    const deps: EngineDepInput[] = [edge('c', 'a'), edge('c', 'b')];
    const { tasks: out, criticalTaskIds } = runScheduleEngine({
      tasks,
      deps,
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const b = out.find((r) => r.taskId === 'b')!;
    expect(b.totalSlackDays).toBeGreaterThan(0);
    expect(criticalTaskIds).toContain('a');
    expect(criticalTaskIds).toContain('c');
    expect(criticalTaskIds).not.toContain('b');
  });

  it('FIXED_WORK derives duration from workMinutes and assignee units', () => {
    const tasks = [
      baseTask('w', {
        scheduleMode: 'FIXED_WORK',
        workMinutes: 960,
        durationWorkingMinutes: null,
        startDate: null,
        dueDate: null,
        assigneeUnitsSum: 100,
      }),
    ];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const w = out[0];
    const span = Math.round(
      (w.earlyFinish.getTime() - w.earlyStart.getTime()) / 86_400_000,
    );
    expect(span).toBeGreaterThanOrEqual(0);
    expect(w.totalSlackWorkingDays).toBe(0);
  });

  it('emits DEADLINE_VIOLATION when finish is after deadline', () => {
    const tasks = [
      baseTask('d', {
        deadlineDate: utcNoon(2026, 0, 5),
        durationWorkingMinutes: 5 * 480,
        startDate: null,
        dueDate: null,
      }),
    ];
    const { diagnostics, tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    expect(out[0].deadlineViolated).toBe(true);
    expect(diagnostics.some((x) => x.code === 'DEADLINE_VIOLATION')).toBe(true);
  });

  it('rolls up summary task dates from children', () => {
    const tasks = [
      baseTask('p', { isSummaryRollup: true, durationWorkingMinutes: null }),
      baseTask('c1', {
        parentTaskId: 'p',
        durationWorkingMinutes: 480,
        startDate: null,
        dueDate: null,
        sortOrder: 0,
      }),
      baseTask('c2', {
        parentTaskId: 'p',
        durationWorkingMinutes: 480,
        startDate: null,
        dueDate: null,
        sortOrder: 1,
      }),
    ];
    const { tasks: out } = runScheduleEngine({
      tasks,
      deps: [],
      projectStart,
      defaultCalendar: { weeklyPattern: weekly, exceptions: [] },
    });
    const p = out.find((r) => r.taskId === 'p')!;
    const c1 = out.find((r) => r.taskId === 'c1')!;
    const c2 = out.find((r) => r.taskId === 'c2')!;
    expect(p.earlyStart.getTime()).toBe(
      Math.min(c1.earlyStart.getTime(), c2.earlyStart.getTime()),
    );
    expect(p.earlyFinish.getTime()).toBe(
      Math.max(c1.earlyFinish.getTime(), c2.earlyFinish.getTime()),
    );
  });
});

describe('engineOutputToTaskDates', () => {
  it('maps early start/finish to task dates', () => {
    const es = utcNoon(2026, 1, 2);
    const ef = utcNoon(2026, 1, 4);
    const d = engineOutputToTaskDates({
      taskId: 't',
      earlyStart: es,
      earlyFinish: ef,
      lateStart: es,
      lateFinish: ef,
      totalSlackDays: 0,
      totalSlackWorkingDays: 0,
      deadlineViolated: false,
    });
    expect(d.startDate).toBe(es);
    expect(d.dueDate).toBe(ef);
  });
});
