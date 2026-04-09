import type { ScheduleLinkType, TaskConstraintType } from '@prisma/client';
import {
  addUtcDays,
  addWorkingDays,
  addWorkingDaysBackward,
  addZonedCalendarDays,
  addCalendarDaysToDateKey,
  dateKeyInTimeZone,
  dateKeyUTC,
  defaultWeeklyPattern,
  durationWorkingDaysBetween,
  endDayInclusive,
  isWorkingDay,
  nextOrSameWorkingDay,
  nextWorkingDayAfter,
  normalizeExceptions,
  normalizeScheduleTimeZone,
  normalizeWeeklyPattern,
  zonedNoonFromDateKey,
  type WeeklyPattern,
  type CalendarException,
} from './schedule-calendar.util';

const MINUTES_PER_DEFAULT_DAY = 480;

export type EngineScheduleMode =
  | 'MANUAL'
  | 'FIXED_UNITS'
  | 'FIXED_WORK'
  | 'FIXED_DURATION';

export interface EngineTaskInput {
  id: string;
  parentTaskId: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  isManuallyScheduled: boolean;
  isMilestone: boolean;
  isSummaryRollup: boolean;
  constraintType: TaskConstraintType;
  constraintDate: Date | null;
  deadlineDate: Date | null;
  durationWorkingMinutes: number | null;
  workMinutes: number | null;
  scheduleMode: EngineScheduleMode;
  /** Sum of TaskAssignee.unitsPercent; defaults to 100 in service when empty. */
  assigneeUnitsSum: number;
  effortDriven: boolean;
  /** For ordering / leveling tie-break */
  sortOrder: number;
}

export interface EngineDepInput {
  dependentId: string;
  blockingId: string;
  linkType: ScheduleLinkType;
  lagDays: number;
  lagIsElapsed: boolean;
}

export interface CalendarInput {
  weeklyPattern: unknown;
  exceptions: unknown;
  /** IANA id (e.g. America/New_York). Invalid values fall back to UTC. */
  timeZone?: string | null;
}

export interface CalPack {
  weekly: WeeklyPattern;
  ex: CalendarException[];
  tz: string;
}

export interface EngineTaskOutput {
  taskId: string;
  earlyStart: Date;
  earlyFinish: Date;
  lateStart: Date;
  lateFinish: Date;
  /** Calendar-day slack (legacy; ms between late and early start). */
  totalSlackDays: number;
  /** Slack in whole working days on this task’s calendar (MSP-style total slack). */
  totalSlackWorkingDays: number;
  deadlineViolated: boolean;
}

export interface ScheduleEngineDiagnostic {
  taskId: string;
  code: string;
  message: string;
}

export function packFromCalendarInput(c: CalendarInput | null | undefined): CalPack {
  const weekly = c
    ? normalizeWeeklyPattern(c.weeklyPattern)
    : defaultWeeklyPattern();
  const ex = c ? normalizeExceptions(c.exceptions) : [];
  const tz = normalizeScheduleTimeZone(c?.timeZone);
  return { weekly, ex, tz };
}

function lastWorkingDayOnOrBefore(d: Date, cal: CalPack): Date {
  let cur = new Date(d.getTime());
  for (let i = 0; i < 10_000; i++) {
    if (isWorkingDay(cur, cal.weekly, cal.ex, cal.tz)) return cur;
    cur =
      cal.tz === 'UTC'
        ? addUtcDays(cur, -1)
        : addZonedCalendarDays(cur, -1, cal.tz);
  }
  return d;
}

function dateKeyOnCal(d: Date, cal: CalPack): string {
  return cal.tz === 'UTC' ? dateKeyUTC(d) : dateKeyInTimeZone(d, cal.tz);
}

function inferDurationDays(t: EngineTaskInput, cal: CalPack): number {
  if (t.isMilestone) return 0;
  if (t.isSummaryRollup) return 0;

  const mode = t.scheduleMode ?? 'MANUAL';

  if (mode === 'FIXED_DURATION') {
    if (t.durationWorkingMinutes != null && t.durationWorkingMinutes > 0) {
      return Math.max(
        1,
        Math.ceil(t.durationWorkingMinutes / MINUTES_PER_DEFAULT_DAY),
      );
    }
    if (t.startDate && t.dueDate) {
      return Math.max(
        1,
        durationWorkingDaysBetween(
          t.startDate,
          t.dueDate,
          cal.weekly,
          cal.ex,
          cal.tz,
        ),
      );
    }
    return 1;
  }

  if (mode === 'FIXED_WORK' || mode === 'FIXED_UNITS') {
    const work = t.workMinutes;
    if (work != null && work > 0) {
      let units = t.assigneeUnitsSum;
      if (!Number.isFinite(units) || units <= 0) units = 100;
      const u = units / 100;
      const denom = MINUTES_PER_DEFAULT_DAY * Math.max(u, 0.01);
      return Math.max(1, Math.ceil(work / denom));
    }
    if (t.durationWorkingMinutes != null && t.durationWorkingMinutes > 0) {
      return Math.max(
        1,
        Math.ceil(t.durationWorkingMinutes / MINUTES_PER_DEFAULT_DAY),
      );
    }
    if (t.startDate && t.dueDate) {
      return Math.max(
        1,
        durationWorkingDaysBetween(
          t.startDate,
          t.dueDate,
          cal.weekly,
          cal.ex,
          cal.tz,
        ),
      );
    }
    return 1;
  }

  if (t.durationWorkingMinutes != null && t.durationWorkingMinutes > 0) {
    return Math.max(
      1,
      Math.ceil(t.durationWorkingMinutes / MINUTES_PER_DEFAULT_DAY),
    );
  }
  if (t.startDate && t.dueDate) {
    return Math.max(
      1,
      durationWorkingDaysBetween(
        t.startDate,
        t.dueDate,
        cal.weekly,
        cal.ex,
        cal.tz,
      ),
    );
  }
  return 1;
}

function constraintEarliestStart(
  t: EngineTaskInput,
  cal: CalPack,
  projectStart: Date,
): Date {
  switch (t.constraintType) {
    case 'SNET':
    case 'MSO':
      return t.constraintDate
        ? nextOrSameWorkingDay(
            t.constraintDate,
            cal.weekly,
            cal.ex,
            cal.tz,
          )
        : nextOrSameWorkingDay(projectStart, cal.weekly, cal.ex, cal.tz);
    default:
      return nextOrSameWorkingDay(projectStart, cal.weekly, cal.ex, cal.tz);
  }
}

function applyMustFinishOnForward(
  t: EngineTaskInput,
  esFloor: Date,
  dur: number,
  cal: CalPack,
): { es: Date; ef: Date } {
  let es = nextOrSameWorkingDay(esFloor, cal.weekly, cal.ex, cal.tz);
  let ef = endDayInclusive(es, dur, cal.weekly, cal.ex, cal.tz);
  if (t.constraintType !== 'MFO' || !t.constraintDate) {
    return { es, ef };
  }
  const rf = nextOrSameWorkingDay(
    t.constraintDate,
    cal.weekly,
    cal.ex,
    cal.tz,
  );
  if (t.isMilestone) {
    return { es: rf, ef: rf };
  }
  if (dur <= 0) {
    return { es: rf, ef: rf };
  }
  const efFromFloor = ef;
  if (efFromFloor.getTime() < rf.getTime()) {
    const esAlign = nextOrSameWorkingDay(
      addWorkingDaysBackward(rf, dur - 1, cal.weekly, cal.ex, cal.tz),
      cal.weekly,
      cal.ex,
      cal.tz,
    );
    if (esAlign.getTime() >= esFloor.getTime()) {
      es = esAlign;
      ef = endDayInclusive(es, dur, cal.weekly, cal.ex, cal.tz);
    }
    return { es, ef };
  }
  if (efFromFloor.getTime() > rf.getTime()) {
    const esPull = nextOrSameWorkingDay(
      addWorkingDaysBackward(rf, dur - 1, cal.weekly, cal.ex, cal.tz),
      cal.weekly,
      cal.ex,
      cal.tz,
    );
    if (esPull.getTime() >= esFloor.getTime()) {
      es = esPull;
      ef = endDayInclusive(es, dur, cal.weekly, cal.ex, cal.tz);
    } else {
      es = esFloor;
      ef = efFromFloor;
    }
    return { es, ef };
  }
  return { es: esFloor, ef: efFromFloor };
}

function predDates(
  predId: string,
  earlyStartById: Map<string, Date>,
  earlyFinishById: Map<string, Date>,
  durDays: Map<string, number>,
  predCal: CalPack,
): { ps: Date; pf: Date } {
  const ps = earlyStartById.get(predId)!;
  const dur = durDays.get(predId) ?? 1;
  const pf = endDayInclusive(
    ps,
    dur,
    predCal.weekly,
    predCal.ex,
    predCal.tz,
  );
  return { ps, pf };
}

function earliestSuccStartFromLink(
  linkType: ScheduleLinkType,
  lagDays: number,
  lagIsElapsed: boolean,
  ps: Date,
  pf: Date,
  succDurDays: number,
  succ: CalPack,
): Date {
  const lag = Math.max(0, Number.isFinite(lagDays) ? lagDays : 0);
  const { weekly, ex, tz } = succ;

  if (!lagIsElapsed) {
    switch (linkType) {
      case 'FS':
        return addWorkingDays(pf, lag, weekly, ex, true, tz);
      case 'SS':
        return addWorkingDays(ps, lag, weekly, ex, false, tz);
      case 'FF': {
        const targetFinish =
          lag <= 0 ? pf : addWorkingDays(pf, lag, weekly, ex, false, tz);
        if (succDurDays <= 0)
          return nextOrSameWorkingDay(targetFinish, weekly, ex, tz);
        return addWorkingDaysBackward(
          targetFinish,
          succDurDays - 1,
          weekly,
          ex,
          tz,
        );
      }
      case 'SF': {
        const anchor = addWorkingDays(ps, lag, weekly, ex, true, tz);
        if (succDurDays <= 0)
          return nextOrSameWorkingDay(anchor, weekly, ex, tz);
        return addWorkingDaysBackward(
          anchor,
          succDurDays - 1,
          weekly,
          ex,
          tz,
        );
      }
      default:
        return addWorkingDays(pf, lag, weekly, ex, true, tz);
    }
  }

  switch (linkType) {
    case 'FS': {
      if (lag === 0) return nextWorkingDayAfter(pf, weekly, ex, tz);
      const afterLag = addZonedCalendarDays(pf, lag, tz);
      return nextOrSameWorkingDay(afterLag, weekly, ex, tz);
    }
    case 'SS': {
      const anchor = lag === 0 ? ps : addZonedCalendarDays(ps, lag, tz);
      return nextOrSameWorkingDay(anchor, weekly, ex, tz);
    }
    case 'FF': {
      const targetFinish =
        lag <= 0 ? pf : addZonedCalendarDays(pf, lag, tz);
      if (succDurDays <= 0)
        return nextOrSameWorkingDay(targetFinish, weekly, ex, tz);
      return addWorkingDaysBackward(
        targetFinish,
        succDurDays - 1,
        weekly,
        ex,
        tz,
      );
    }
    case 'SF': {
      const anchor =
        lag === 0 ? ps : addZonedCalendarDays(ps, lag, tz);
      if (succDurDays <= 0)
        return nextOrSameWorkingDay(anchor, weekly, ex, tz);
      return addWorkingDaysBackward(
        anchor,
        succDurDays - 1,
        weekly,
        ex,
        tz,
      );
    }
    default:
      return nextWorkingDayAfter(pf, weekly, ex, tz);
  }
}

function totalSlackWorking(es: Date, ls: Date, cal: CalPack): number {
  if (ls.getTime() >= es.getTime()) {
    const n = durationWorkingDaysBetween(
      es,
      ls,
      cal.weekly,
      cal.ex,
      cal.tz,
    );
    return Math.max(0, n - 1);
  }
  const n = durationWorkingDaysBetween(
    ls,
    es,
    cal.weekly,
    cal.ex,
    cal.tz,
  );
  return -Math.max(0, n - 1);
}

/** Topological order; throws if cycle. */
export function topologicalSortTaskIds(
  taskIds: string[],
  deps: EngineDepInput[],
): string[] {
  const set = new Set(taskIds);
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const id of taskIds) {
    adj.set(id, []);
    indeg.set(id, 0);
  }
  for (const d of deps) {
    if (!set.has(d.dependentId) || !set.has(d.blockingId)) continue;
    adj.get(d.blockingId)!.push(d.dependentId);
    indeg.set(d.dependentId, (indeg.get(d.dependentId) ?? 0) + 1);
  }
  const q: string[] = [];
  for (const id of taskIds) {
    if ((indeg.get(id) ?? 0) === 0) q.push(id);
  }
  const out: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    out.push(u);
    for (const v of adj.get(u) ?? []) {
      const n = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, n);
      if (n === 0) q.push(v);
    }
  }
  if (out.length !== taskIds.length) {
    throw new Error('Cyclic dependencies in schedule graph');
  }
  return out;
}

function backwardBoundLf(
  d: EngineDepInput,
  succLf: Date,
  succLs: Date,
  succDur: number,
  succCal: CalPack,
  predCal: CalPack,
  predId: string,
  durDays: Map<string, number>,
): Date {
  const predDur = durDays.get(predId) ?? 1;
  const succLsDay = nextOrSameWorkingDay(
    succDur <= 0
      ? succLf
      : addWorkingDaysBackward(
          succLf,
          succDur - 1,
          succCal.weekly,
          succCal.ex,
          succCal.tz,
        ),
    succCal.weekly,
    succCal.ex,
    succCal.tz,
  );

  let boundLf: Date;

  if (!d.lagIsElapsed) {
    switch (d.linkType) {
      case 'FS':
        boundLf = addWorkingDaysBackward(
          succLsDay,
          d.lagDays + 1,
          succCal.weekly,
          succCal.ex,
          succCal.tz,
        );
        break;
      case 'SS': {
        const lsPred = addWorkingDaysBackward(
          succLsDay,
          d.lagDays,
          succCal.weekly,
          succCal.ex,
          succCal.tz,
        );
        boundLf = endDayInclusive(
          nextOrSameWorkingDay(
            lsPred,
            predCal.weekly,
            predCal.ex,
            predCal.tz,
          ),
          predDur,
          predCal.weekly,
          predCal.ex,
          predCal.tz,
        );
        break;
      }
      case 'FF':
        boundLf = addWorkingDaysBackward(
          succLf,
          d.lagDays,
          succCal.weekly,
          succCal.ex,
          succCal.tz,
        );
        break;
      case 'SF':
        boundLf = addWorkingDaysBackward(
          succLf,
          d.lagDays + 1,
          succCal.weekly,
          succCal.ex,
          succCal.tz,
        );
        break;
      default:
        boundLf = addWorkingDaysBackward(
          succLsDay,
          d.lagDays + 1,
          succCal.weekly,
          succCal.ex,
          succCal.tz,
        );
    }
  } else {
    const sk = dateKeyOnCal(succLsDay, succCal);
    switch (d.linkType) {
      case 'FS': {
        const pk = addCalendarDaysToDateKey(sk, -(d.lagDays + 1));
        boundLf = zonedNoonFromDateKey(pk, succCal.tz);
        break;
      }
      case 'SS': {
        const pk = addCalendarDaysToDateKey(sk, -d.lagDays);
        const anchor = zonedNoonFromDateKey(pk, succCal.tz);
        const snapped = lastWorkingDayOnOrBefore(anchor, predCal);
        boundLf = endDayInclusive(
          nextOrSameWorkingDay(
            snapped,
            predCal.weekly,
            predCal.ex,
            predCal.tz,
          ),
          predDur,
          predCal.weekly,
          predCal.ex,
          predCal.tz,
        );
        break;
      }
      case 'FF': {
        const skF = dateKeyOnCal(succLf, succCal);
        const pk = addCalendarDaysToDateKey(skF, -d.lagDays);
        boundLf = zonedNoonFromDateKey(pk, succCal.tz);
        break;
      }
      case 'SF': {
        const skF = dateKeyOnCal(succLf, succCal);
        const pk = addCalendarDaysToDateKey(skF, -(d.lagDays + 1));
        boundLf = zonedNoonFromDateKey(pk, succCal.tz);
        break;
      }
      default:
        boundLf = addWorkingDaysBackward(
          succLsDay,
          d.lagDays + 1,
          succCal.weekly,
          succCal.ex,
          succCal.tz,
        );
    }
  }

  return lastWorkingDayOnOrBefore(boundLf, predCal);
}

/**
 * Predecessor edges that set early start on the forward pass (tight links), after rollups/MFO.
 * Skips manual, summary, and ALAP tasks (ALAP may move early start to match late).
 */
export function computeDrivingPredecessorEdges(params: {
  taskIds: string[];
  predsOf: Map<string, EngineDepInput[]>;
  byId: Map<string, EngineTaskInput>;
  earlyStartById: Map<string, Date>;
  earlyFinishById: Map<string, Date>;
  durDays: Map<string, number>;
  getPack: (id: string) => CalPack;
  projectStart: Date;
}): Array<{ fromTaskId: string; toTaskId: string }> {
  const {
    taskIds,
    predsOf,
    byId,
    earlyStartById,
    earlyFinishById,
    durDays,
    getPack,
    projectStart,
  } = params;
  const out: Array<{ fromTaskId: string; toTaskId: string }> = [];

  for (const id of taskIds) {
    const t = byId.get(id)!;
    if (t.isManuallyScheduled || t.isSummaryRollup) continue;
    if (t.constraintType === 'ALAP') continue;

    const cal = getPack(id);
    const succDur = durDays.get(id) ?? 1;
    let es = constraintEarliestStart(t, cal, projectStart);
    let winners: string[] = [];

    for (const d of predsOf.get(id) ?? []) {
      const pred = d.blockingId;
      if (!earlyStartById.has(pred)) continue;
      const predCal = getPack(pred);
      const { ps, pf } = predDates(
        pred,
        earlyStartById,
        earlyFinishById,
        durDays,
        predCal,
      );
      const succCal = getPack(id);
      const candidate = earliestSuccStartFromLink(
        d.linkType,
        d.lagDays,
        d.lagIsElapsed,
        ps,
        pf,
        succDur,
        succCal,
      );
      const cand = nextOrSameWorkingDay(
        candidate,
        cal.weekly,
        cal.ex,
        cal.tz,
      );
      if (cand > es) {
        es = cand;
        winners = [pred];
      } else if (cand.getTime() === es.getTime()) {
        winners.push(pred);
      }
    }

    es = nextOrSameWorkingDay(es, cal.weekly, cal.ex, cal.tz);
    const { es: esFwd } = applyMustFinishOnForward(t, es, succDur, cal);
    const finalEs = earlyStartById.get(id)!;
    if (dateKeyOnCal(esFwd, cal) !== dateKeyOnCal(finalEs, cal)) {
      continue;
    }
    for (const w of winners) {
      out.push({ fromTaskId: w, toTaskId: id });
    }
  }

  return out;
}

export function runScheduleEngine(params: {
  tasks: EngineTaskInput[];
  deps: EngineDepInput[];
  projectStart: Date;
  projectFinishHint?: Date | null;
  defaultCalendar?: CalendarInput | null;
  taskCalendarById?: ReadonlyMap<string, CalendarInput> | null;
}): {
  tasks: EngineTaskOutput[];
  criticalTaskIds: string[];
  diagnostics: ScheduleEngineDiagnostic[];
  drivingEdges: Array<{ fromTaskId: string; toTaskId: string }>;
} {
  const defaultPack = packFromCalendarInput(
    params.defaultCalendar ?? undefined,
  );

  const getPack = (taskId: string): CalPack => {
    const c = params.taskCalendarById?.get(taskId);
    if (c) return packFromCalendarInput(c);
    return defaultPack;
  };

  const taskIds = params.tasks.map((t) => t.id);
  const byId = new Map(params.tasks.map((t) => [t.id, t]));
  const durDays = new Map<string, number>();
  for (const t of params.tasks) {
    durDays.set(t.id, inferDurationDays(t, getPack(t.id)));
  }

  const predsOf = new Map<string, EngineDepInput[]>();
  for (const id of taskIds) predsOf.set(id, []);
  for (const d of params.deps) {
    if (!predsOf.has(d.dependentId)) continue;
    predsOf.get(d.dependentId)!.push(d);
  }

  const order = topologicalSortTaskIds(taskIds, params.deps);
  const earlyStartById = new Map<string, Date>();
  const earlyFinishById = new Map<string, Date>();

  const projStart = nextOrSameWorkingDay(
    params.projectStart,
    defaultPack.weekly,
    defaultPack.ex,
    defaultPack.tz,
  );

  for (const id of order) {
    const t = byId.get(id)!;
    const cal = getPack(id);

    if (t.isManuallyScheduled) {
      const es = t.startDate
        ? nextOrSameWorkingDay(t.startDate, cal.weekly, cal.ex, cal.tz)
        : projStart;
      const dur = durDays.get(id) ?? 1;
      const ef = endDayInclusive(es, dur, cal.weekly, cal.ex, cal.tz);
      earlyStartById.set(id, es);
      earlyFinishById.set(id, ef);
      continue;
    }

    if (t.isSummaryRollup) {
      earlyStartById.set(id, projStart);
      earlyFinishById.set(id, projStart);
      continue;
    }

    const succDur = durDays.get(id) ?? 1;
    let es = constraintEarliestStart(t, cal, projStart);
    for (const d of predsOf.get(id) ?? []) {
      const pred = d.blockingId;
      if (!earlyStartById.has(pred)) continue;
      const predCal = getPack(pred);
      const { ps, pf } = predDates(
        pred,
        earlyStartById,
        earlyFinishById,
        durDays,
        predCal,
      );
      const succCal = getPack(id);
      const candidate = earliestSuccStartFromLink(
        d.linkType,
        d.lagDays,
        d.lagIsElapsed,
        ps,
        pf,
        succDur,
        succCal,
      );
      const cand = nextOrSameWorkingDay(
        candidate,
        cal.weekly,
        cal.ex,
        cal.tz,
      );
      if (cand > es) es = cand;
    }
    es = nextOrSameWorkingDay(es, cal.weekly, cal.ex, cal.tz);
    const dur = durDays.get(id) ?? 1;
    const { es: esFwd, ef: efFwd } = applyMustFinishOnForward(
      t,
      es,
      dur,
      cal,
    );
    earlyStartById.set(id, esFwd);
    earlyFinishById.set(id, efFwd);
  }

  applySummaryRollups(
    taskIds,
    byId,
    earlyStartById,
    earlyFinishById,
    durDays,
    getPack,
  );

  let projectFinish = params.projectFinishHint
    ? nextOrSameWorkingDay(
        params.projectFinishHint,
        defaultPack.weekly,
        defaultPack.ex,
        defaultPack.tz,
      )
    : projStart;
  for (const id of taskIds) {
    const ef = earlyFinishById.get(id)!;
    if (ef > projectFinish) projectFinish = ef;
  }

  const succsOf = new Map<string, EngineDepInput[]>();
  for (const id of taskIds) succsOf.set(id, []);
  for (const d of params.deps) {
    if (!succsOf.has(d.blockingId)) continue;
    succsOf.get(d.blockingId)!.push(d);
  }

  const lateFinishById = new Map<string, Date>();
  const lateStartById = new Map<string, Date>();

  for (const id of taskIds) {
    lateFinishById.set(id, projectFinish);
  }

  const rev = [...order].reverse();
  for (const id of rev) {
    const t = byId.get(id)!;
    const cal = getPack(id);
    const dur = durDays.get(id) ?? 1;

    if (t.isManuallyScheduled) {
      const es = earlyStartById.get(id)!;
      const ef = earlyFinishById.get(id)!;
      lateStartById.set(id, es);
      lateFinishById.set(id, ef);
      continue;
    }

    let lf = lateFinishById.get(id)!;
    const outs = succsOf.get(id) ?? [];
    if (outs.length === 0) {
      lf = projectFinish;
    } else {
      lf = projectFinish;
      const predCal = getPack(id);
      for (const d of outs) {
        const succ = d.dependentId;
        const succLf = lateFinishById.get(succ);
        if (!succLf) continue;
        const succDur = durDays.get(succ) ?? 1;
        const succCal = getPack(succ);
        const succLs =
          succDur <= 0
            ? succLf
            : addWorkingDaysBackward(
                succLf,
                succDur - 1,
                succCal.weekly,
                succCal.ex,
                succCal.tz,
              );
        const boundLf = backwardBoundLf(
          d,
          succLf,
          succLs,
          succDur,
          succCal,
          predCal,
          id,
          durDays,
        );
        if (boundLf < lf) lf = boundLf;
      }
    }

    if (t.constraintType === 'MFO' && t.constraintDate) {
      const rf = nextOrSameWorkingDay(
        t.constraintDate,
        cal.weekly,
        cal.ex,
        cal.tz,
      );
      lf = new Date(Math.min(lf.getTime(), rf.getTime()));
    }

    let ls =
      dur <= 0
        ? lf
        : addWorkingDaysBackward(lf, dur - 1, cal.weekly, cal.ex, cal.tz);
    ls = nextOrSameWorkingDay(ls, cal.weekly, cal.ex, cal.tz);

    if (t.constraintType === 'SNLT' && t.constraintDate) {
      const cap = nextOrSameWorkingDay(
        t.constraintDate,
        cal.weekly,
        cal.ex,
        cal.tz,
      );
      ls = new Date(Math.min(ls.getTime(), cap.getTime()));
      ls = nextOrSameWorkingDay(ls, cal.weekly, cal.ex, cal.tz);
    }

    if (t.constraintType === 'MSO' && t.constraintDate) {
      ls = nextOrSameWorkingDay(
        t.constraintDate,
        cal.weekly,
        cal.ex,
        cal.tz,
      );
      lf =
        dur <= 0
          ? ls
          : endDayInclusive(ls, dur, cal.weekly, cal.ex, cal.tz);
    }

    lateFinishById.set(id, lf);
    lateStartById.set(id, ls);
  }

  for (const id of taskIds) {
    const t = byId.get(id)!;
    if (t.isManuallyScheduled || t.constraintType !== 'ALAP') continue;
    const cal = getPack(id);
    const ls = lateStartById.get(id)!;
    const lf = lateFinishById.get(id)!;
    const es = earlyStartById.get(id)!;
    if (ls.getTime() >= es.getTime()) {
      earlyStartById.set(id, ls);
      earlyFinishById.set(id, lf);
    }
  }

  applySummaryRollupsLate(
    taskIds,
    byId,
    lateStartById,
    lateFinishById,
    durDays,
    getPack,
  );

  const drivingEdges = computeDrivingPredecessorEdges({
    taskIds,
    predsOf,
    byId,
    earlyStartById,
    earlyFinishById,
    durDays,
    getPack,
    projectStart: projStart,
  });

  const diagnostics: ScheduleEngineDiagnostic[] = [];
  const outputs: EngineTaskOutput[] = [];
  const critical: string[] = [];

  for (const id of taskIds) {
    const t = byId.get(id)!;
    const cal = getPack(id);
    const es = earlyStartById.get(id)!;
    const ef = earlyFinishById.get(id)!;
    const ls = lateStartById.get(id)!;
    const lf = lateFinishById.get(id)!;
    const slackMs = ls.getTime() - es.getTime();
    const slackDays = Math.round(slackMs / 86_400_000);
    const slackW = totalSlackWorking(es, ls, cal);

    let deadlineViolated = false;
    if (t.deadlineDate && !t.isManuallyScheduled) {
      const fk = dateKeyOnCal(ef, cal);
      const dk = dateKeyOnCal(t.deadlineDate, cal);
      if (fk > dk) {
        deadlineViolated = true;
        diagnostics.push({
          taskId: id,
          code: 'DEADLINE_VIOLATION',
          message: 'Scheduled finish is after the task deadline',
        });
      }
    }

    if (!t.isManuallyScheduled && es.getTime() > lf.getTime()) {
      diagnostics.push({
        taskId: id,
        code: 'CONSTRAINT_INFEASIBLE',
        message:
          'Early schedule exceeds late finish (constraints or dependencies conflict)',
      });
    }

    if (
      t.constraintType === 'MFO' &&
      t.constraintDate &&
      !t.isManuallyScheduled
    ) {
      const rf = nextOrSameWorkingDay(
        t.constraintDate,
        cal.weekly,
        cal.ex,
        cal.tz,
      );
      if (ef.getTime() > rf.getTime()) {
        diagnostics.push({
          taskId: id,
          code: 'MFO_NOT_MET',
          message: 'Scheduled finish is after must-finish-on date',
        });
      }
    }

    outputs.push({
      taskId: id,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: ls,
      lateFinish: lf,
      totalSlackDays: slackDays,
      totalSlackWorkingDays: slackW,
      deadlineViolated,
    });

    if (slackW <= 0 && !t.isManuallyScheduled) critical.push(id);
  }

  const criticalSet = new Set(critical);
  for (const t of params.tasks) {
    if (!t.isSummaryRollup) continue;
    const children = params.tasks.filter((c) => c.parentTaskId === t.id);
    if (children.some((c) => criticalSet.has(c.id))) {
      criticalSet.add(t.id);
    }
  }

  return {
    tasks: outputs,
    criticalTaskIds: [...criticalSet],
    diagnostics,
    drivingEdges,
  };
}

function applySummaryRollups(
  taskIds: string[],
  byId: Map<string, EngineTaskInput>,
  earlyStartById: Map<string, Date>,
  earlyFinishById: Map<string, Date>,
  durDays: Map<string, number>,
  _getPack: (id: string) => CalPack,
): void {
  for (let pass = 0; pass < taskIds.length + 2; pass++) {
    let changed = false;
    for (const id of taskIds) {
      const t = byId.get(id)!;
      if (!t.isSummaryRollup) continue;
      const childIds = taskIds.filter((c) => byId.get(c)?.parentTaskId === id);
      if (childIds.length === 0) continue;
      const ess = childIds.map((c) => earlyStartById.get(c)?.getTime() ?? NaN);
      const efs = childIds.map((c) => earlyFinishById.get(c)?.getTime() ?? NaN);
      if (
        ess.some((x) => !Number.isFinite(x)) ||
        efs.some((x) => !Number.isFinite(x))
      )
        continue;
      const minEs = new Date(Math.min(...ess));
      const maxEf = new Date(Math.max(...efs));
      const curEs = earlyStartById.get(id)!;
      const curEf = earlyFinishById.get(id)!;
      if (
        curEs.getTime() !== minEs.getTime() ||
        curEf.getTime() !== maxEf.getTime()
      ) {
        earlyStartById.set(id, minEs);
        earlyFinishById.set(id, maxEf);
        durDays.set(id, 0);
        changed = true;
      }
    }
    if (!changed) break;
  }
}

function applySummaryRollupsLate(
  taskIds: string[],
  byId: Map<string, EngineTaskInput>,
  lateStartById: Map<string, Date>,
  lateFinishById: Map<string, Date>,
  _durDays: Map<string, number>,
  _getPack: (id: string) => CalPack,
): void {
  for (let pass = 0; pass < taskIds.length + 2; pass++) {
    let changed = false;
    for (const id of taskIds) {
      const t = byId.get(id)!;
      if (!t.isSummaryRollup) continue;
      const childIds = taskIds.filter((c) => byId.get(c)?.parentTaskId === id);
      if (childIds.length === 0) continue;
      const lss = childIds.map((c) => lateStartById.get(c)?.getTime() ?? NaN);
      const lfs = childIds.map((c) => lateFinishById.get(c)?.getTime() ?? NaN);
      if (
        lss.some((x) => !Number.isFinite(x)) ||
        lfs.some((x) => !Number.isFinite(x))
      )
        continue;
      const minLs = new Date(Math.min(...lss));
      const maxLf = new Date(Math.max(...lfs));
      const curLs = lateStartById.get(id)!;
      const curLf = lateFinishById.get(id)!;
      if (
        curLs.getTime() !== minLs.getTime() ||
        curLf.getTime() !== maxLf.getTime()
      ) {
        lateStartById.set(id, minLs);
        lateFinishById.set(id, maxLf);
        changed = true;
      }
    }
    if (!changed) break;
  }
}

export function engineOutputToTaskDates(
  out: EngineTaskOutput,
): { startDate: Date; dueDate: Date } {
  return {
    startDate: out.earlyStart,
    dueDate: out.earlyFinish,
  };
}
