import type {
  ProjectScheduleTimephasedCellDto,
  ScheduleTimephasedBasis,
  TaskWorkContour,
} from '@vineroot/shared-types';
import { TaskWorkContour as Contour } from '@vineroot/shared-types';
import {
  enumerateDateKeysInclusiveInTz,
  workingMinutesOnDateKey,
  zonedNoonFromDateKey,
  type CalendarException,
  type WeeklyPattern,
} from './schedule-calendar.util';

/** UTC calendar-day start (midnight UTC). */
export function utcDayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export function addUtcDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function overlapCalendarDaysInclusive(
  tStart: Date,
  tEnd: Date,
  pStart: Date,
  pEnd: Date,
): number {
  const a = Math.max(utcDayStart(tStart).getTime(), utcDayStart(pStart).getTime());
  const b = Math.min(utcDayStart(tEnd).getTime(), utcDayStart(pEnd).getTime());
  if (b < a) return 0;
  return Math.floor((b - a) / 86_400_000) + 1;
}

export function calendarSpanDaysInclusive(start: Date, end: Date): number {
  return Math.max(
    1,
    Math.floor(
      (utcDayStart(end).getTime() - utcDayStart(start).getTime()) / 86_400_000,
    ) + 1,
  );
}

export function enumerateUtcDays(
  rangeStart: Date,
  rangeEnd: Date,
): { periodStart: Date; periodEnd: Date }[] {
  const out: { periodStart: Date; periodEnd: Date }[] = [];
  let cur = utcDayStart(rangeStart).getTime();
  const last = utcDayStart(rangeEnd).getTime();
  while (cur <= last) {
    const periodStart = new Date(cur);
    const periodEnd = new Date(cur + 86_400_000 - 1);
    out.push({ periodStart, periodEnd });
    cur += 86_400_000;
  }
  return out;
}

/** Monday 00:00 UTC of the week containing `d` (ISO week–aligned for timephased grid). */
function mondayUtcContaining(d: Date): Date {
  const day = utcDayStart(d);
  const dow = day.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return addUtcDays(day, offset);
}

export function enumerateUtcWeeks(
  rangeStart: Date,
  rangeEnd: Date,
): { periodStart: Date; periodEnd: Date }[] {
  const out: { periodStart: Date; periodEnd: Date }[] = [];
  let wk = mondayUtcContaining(rangeStart);
  const end = utcDayStart(rangeEnd);
  while (wk.getTime() <= end.getTime()) {
    const periodStart = new Date(wk);
    const periodEnd = addUtcDays(wk, 6);
    periodEnd.setUTCHours(23, 59, 59, 999);
    out.push({ periodStart, periodEnd });
    wk = addUtcDays(wk, 7);
  }
  return out;
}

function dayInPeriodUtc(dayMid: Date, pStart: Date, pEnd: Date): boolean {
  const d = utcDayStart(dayMid).getTime();
  return d >= utcDayStart(pStart).getTime() && d <= utcDayStart(pEnd).getTime();
}

function instantInPeriodInclusive(inst: Date, pStart: Date, pEnd: Date): boolean {
  const t = inst.getTime();
  return t >= pStart.getTime() && t <= pEnd.getTime();
}

export type WorkingBasisPack = {
  weekly: WeeklyPattern;
  exceptions: CalendarException[];
  timeZone: string;
};

/** Per-day weights over `spanDays` (index 0 = first slot along the task span). */
export function dayWeightsForContour(
  spanDays: number,
  contour: TaskWorkContour,
): number[] {
  if (spanDays <= 0) return [];
  if (spanDays === 1) return [1];
  switch (contour) {
    case Contour.FRONT_LOADED:
      return Array.from({ length: spanDays }, (_, i) => spanDays - i);
    case Contour.BACK_LOADED:
      return Array.from({ length: spanDays }, (_, i) => i + 1);
    case Contour.BELL:
      return Array.from({ length: spanDays }, (_, i) =>
        Math.min(i + 1, spanDays - i),
      );
    case Contour.DOUBLE_PEAK: {
      return Array.from({ length: spanDays }, (_, i) => {
        const a = (spanDays - 1) * 0.25;
        const b = (spanDays - 1) * 0.75;
        const w1 = 1 / (1 + Math.abs(i - a));
        const w2 = 1 / (1 + Math.abs(i - b));
        return w1 + w2;
      });
    }
    case Contour.TURTLE: {
      const bell = Array.from({ length: spanDays }, (_, i) =>
        Math.min(i + 1, spanDays - i),
      );
      const mx = Math.max(1, ...bell);
      return bell.map((b) => mx - b + 1);
    }
    case Contour.EARLY_PEAK: {
      const peak = Math.max(0, Math.floor((spanDays - 1) * 0.15));
      return Array.from({ length: spanDays }, (_, i) =>
        1 / (1 + 2 * Math.abs(i - peak)),
      );
    }
    case Contour.LATE_PEAK: {
      const peak = Math.floor((spanDays - 1) * 0.85);
      return Array.from({ length: spanDays }, (_, i) =>
        1 / (1 + 2 * Math.abs(i - peak)),
      );
    }
    case Contour.FLAT:
    default:
      return Array(spanDays).fill(1);
  }
}

/** Largest-remainder integer allocation; sums exactly to `total` when total ≥ 0. */
export function allocateIntegerByWeights(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (total <= 0) return weights.map(() => 0);
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) {
    const eq = Math.floor(total / weights.length);
    const rem = total - eq * weights.length;
    return weights.map((_, i) => eq + (i < rem ? 1 : 0));
  }
  const raw = weights.map((w) => (total * w) / sumW);
  const floors = raw.map((r) => Math.floor(r));
  let allocated = floors.reduce((a, b) => a + b, 0);
  const remainder = total - allocated;
  const frac = raw.map((r, i) => ({ i, f: r - floors[i] }));
  frac.sort((a, b) => b.f - a.f);
  const out = [...floors];
  for (let k = 0; k < remainder && k < frac.length; k++) {
    out[frac[k].i] += 1;
  }
  return out;
}

export type ParsedTimephasedSegment = {
  start: Date;
  end: Date;
  workMinutes?: number | null;
};

export function parseScheduleSegmentsForTimephased(
  raw: unknown,
): ParsedTimephasedSegment[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: ParsedTimephasedSegment[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (typeof o.start !== 'string' || typeof o.end !== 'string') continue;
    const s = new Date(o.start);
    const e = new Date(o.end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;
    const wm = o.workMinutes;
    const workMinutes =
      wm != null && Number.isFinite(Number(wm)) ? Number(wm) : null;
    out.push({ start: s, end: e, workMinutes });
  }
  return out;
}

function mergeCell(
  merged: Map<string, ProjectScheduleTimephasedCellDto>,
  row: ProjectScheduleTimephasedCellDto,
): void {
  const k = `${row.taskId}\0${row.periodStart}`;
  const existing = merged.get(k);
  if (existing) {
    existing.workMinutes += row.workMinutes;
    if (row.cost != null) {
      existing.cost =
        existing.cost == null
          ? row.cost
          : Math.round((existing.cost + row.cost) * 10000) / 10000;
    }
  } else {
    merged.set(k, { ...row });
  }
}

function resolveSegmentWorkWeights(
  segments: ParsedTimephasedSegment[],
): number[] {
  return segments.map((s) => {
    const span = calendarSpanDaysInclusive(s.start, s.end);
    if (
      s.workMinutes != null &&
      Number.isFinite(s.workMinutes) &&
      s.workMinutes >= 0
    ) {
      return Math.max(1, s.workMinutes);
    }
    return Math.max(1, span);
  });
}

function segmentPeriodOverlapWeights(
  segStart: Date,
  segEnd: Date,
  periods: { periodStart: Date; periodEnd: Date }[],
  workingPack: WorkingBasisPack | null,
): number[] {
  if (!workingPack) {
    return periods.map((p) =>
      overlapCalendarDaysInclusive(
        segStart,
        segEnd,
        p.periodStart,
        p.periodEnd,
      ),
    );
  }
  const { weekly, exceptions, timeZone } = workingPack;
  const keys = enumerateDateKeysInclusiveInTz(segStart, segEnd, timeZone);
  return periods.map((p) => {
    let sum = 0;
    for (const k of keys) {
      const noon = zonedNoonFromDateKey(k, timeZone);
      if (!instantInPeriodInclusive(noon, p.periodStart, p.periodEnd)) continue;
      sum += workingMinutesOnDateKey(k, weekly, exceptions, timeZone);
    }
    return sum;
  });
}

function distributeSegmentToPeriods(params: {
  taskId: string;
  taskTitle: string;
  segStart: Date;
  segEnd: Date;
  segmentWork: number;
  segmentCost: number | null;
  granularity: 'week' | 'day';
  merged: Map<string, ProjectScheduleTimephasedCellDto>;
  workingPack: WorkingBasisPack | null;
}): void {
  const {
    taskId,
    taskTitle,
    segStart,
    segEnd,
    segmentWork,
    segmentCost,
    granularity,
    merged,
    workingPack,
  } = params;
  const periods =
    granularity === 'day'
      ? enumerateUtcDays(utcDayStart(segStart), utcDayStart(segEnd))
      : enumerateUtcWeeks(utcDayStart(segStart), utcDayStart(segEnd));

  const overlaps = segmentPeriodOverlapWeights(
    segStart,
    segEnd,
    periods,
    workingPack,
  );
  const workAlloc = allocateIntegerByWeights(segmentWork, overlaps);
  const costAlloc =
    segmentCost != null
      ? allocateIntegerByWeights(
          Math.round(segmentCost * 10000),
          overlaps,
        ).map((x) => x / 10000)
      : overlaps.map(() => null as null);

  for (let i = 0; i < periods.length; i++) {
    if (overlaps[i] <= 0) continue;
    const wm = workAlloc[i] ?? 0;
    const c = costAlloc[i];
    const costRounded =
      c != null ? Math.round(c * 10000) / 10000 : null;
    if (wm <= 0 && (costRounded == null || costRounded === 0)) continue;
    mergeCell(merged, {
      taskId,
      taskTitle,
      periodStart: periods[i].periodStart.toISOString(),
      periodEnd: periods[i].periodEnd.toISOString(),
      workMinutes: wm,
      cost: costRounded,
    });
  }
}

function contourOverlapWeightsForPeriods(params: {
  startDate: Date;
  dueDate: Date;
  workContour: TaskWorkContour;
  granularity: 'week' | 'day';
  basis: ScheduleTimephasedBasis;
  workingPack: WorkingBasisPack | null;
}): number[] {
  const { startDate, dueDate, workContour, granularity, basis, workingPack } =
    params;
  const periods =
    granularity === 'day'
      ? enumerateUtcDays(utcDayStart(startDate), utcDayStart(dueDate))
      : enumerateUtcWeeks(utcDayStart(startDate), utcDayStart(dueDate));

  if (basis !== 'working' || !workingPack) {
    const spanDays = calendarSpanDaysInclusive(startDate, dueDate);
    const dayWeights = dayWeightsForContour(spanDays, workContour);
    const taskDay0 = utcDayStart(startDate).getTime();
    return periods.map((p) => {
      let w = 0;
      for (let i = 0; i < spanDays; i++) {
        const dayStart = new Date(taskDay0 + i * 86_400_000);
        if (dayInPeriodUtc(dayStart, p.periodStart, p.periodEnd)) {
          w += dayWeights[i] ?? 1;
        }
      }
      return w;
    });
  }

  const { weekly, exceptions, timeZone } = workingPack;
  const keys = enumerateDateKeysInclusiveInTz(startDate, dueDate, timeZone);
  if (keys.length === 0) {
    return periods.map(() => 0);
  }
  const contourW = dayWeightsForContour(keys.length, workContour);
  const minutes = keys.map((k) =>
    workingMinutesOnDateKey(k, weekly, exceptions, timeZone),
  );
  let slotCombined = contourW.map((cw, i) => cw * minutes[i]);
  let sumSC = slotCombined.reduce((a, b) => a + b, 0);
  if (sumSC <= 0) {
    slotCombined = contourW.map((cw, i) => cw * (minutes[i] > 0 ? minutes[i] : 1));
    sumSC = slotCombined.reduce((a, b) => a + b, 0);
  }
  if (sumSC <= 0) {
    slotCombined = contourW.slice();
    sumSC = slotCombined.reduce((a, b) => a + b, 0);
  }

  return periods.map((p) => {
    let w = 0;
    for (let i = 0; i < keys.length; i++) {
      const noon = zonedNoonFromDateKey(keys[i], timeZone);
      if (instantInPeriodInclusive(noon, p.periodStart, p.periodEnd)) {
        w += slotCombined[i] ?? 0;
      }
    }
    return w;
  });
}

/**
 * Timephased cells for one task. When `scheduleSegments` parses to a non-empty array,
 * work/cost follow segment boundaries; `workContour` is ignored for distribution shape
 * across segments (flat vs working overlap within each segment).
 * Otherwise contour weights apply across the task span (calendar or working slots).
 */
export function computeTaskTimephasedCells(params: {
  taskId: string;
  taskTitle: string;
  startDate: Date;
  dueDate: Date;
  workTotal: number | null;
  costTotal: number | null;
  scheduleSegments: unknown;
  workContour: TaskWorkContour;
  granularity: 'week' | 'day';
  basis: ScheduleTimephasedBasis;
  workingPack: WorkingBasisPack | null;
}): ProjectScheduleTimephasedCellDto[] {
  const {
    taskId,
    taskTitle,
    startDate,
    dueDate,
    workTotal,
    costTotal,
    scheduleSegments,
    workContour,
    granularity,
    basis,
    workingPack,
  } = params;

  const merged = new Map<string, ProjectScheduleTimephasedCellDto>();
  const segments = parseScheduleSegmentsForTimephased(scheduleSegments);
  const segWorking =
    basis === 'working' && workingPack ? workingPack : null;

  if (segments.length > 0) {
    const weights = resolveSegmentWorkWeights(segments);
    const totalW = workTotal != null && workTotal > 0 ? workTotal : 0;
    const segWorks =
      totalW > 0
        ? allocateIntegerByWeights(totalW, weights)
        : segments.map(() => 0);

    const totalC = costTotal != null && costTotal > 0 ? costTotal : null;
    const segCosts =
      totalC != null && totalC > 0
        ? allocateIntegerByWeights(
            Math.round(totalC * 10000),
            weights,
          ).map((x) => x / 10000)
        : segments.map(() => null as null);

    for (let i = 0; i < segments.length; i++) {
      distributeSegmentToPeriods({
        taskId,
        taskTitle,
        segStart: segments[i].start,
        segEnd: segments[i].end,
        segmentWork: segWorks[i] ?? 0,
        segmentCost: segCosts[i] ?? null,
        granularity,
        merged,
        workingPack: segWorking,
      });
    }
  } else {
    const overlapWeights = contourOverlapWeightsForPeriods({
      startDate,
      dueDate,
      workContour,
      granularity,
      basis,
      workingPack,
    });

    const periods =
      granularity === 'day'
        ? enumerateUtcDays(utcDayStart(startDate), utcDayStart(dueDate))
        : enumerateUtcWeeks(utcDayStart(startDate), utcDayStart(dueDate));

    const totalW = workTotal != null && workTotal > 0 ? workTotal : 0;
    const workAlloc = allocateIntegerByWeights(totalW, overlapWeights);
    const totalC = costTotal != null && costTotal > 0 ? costTotal : null;
    const costAlloc =
      totalC != null
        ? allocateIntegerByWeights(
            Math.round(totalC * 10000),
            overlapWeights,
          ).map((x) => x / 10000)
        : overlapWeights.map(() => null as null);

    for (let i = 0; i < periods.length; i++) {
      if (overlapWeights[i] <= 0) continue;
      const wm = workAlloc[i] ?? 0;
      const c = costAlloc[i];
      const costRounded =
        c != null ? Math.round(c * 10000) / 10000 : null;
      if (wm <= 0 && (costRounded == null || costRounded === 0)) continue;
      mergeCell(merged, {
        taskId,
        taskTitle,
        periodStart: periods[i].periodStart.toISOString(),
        periodEnd: periods[i].periodEnd.toISOString(),
        workMinutes: wm,
        cost: costRounded,
      });
    }
  }

  const cells = [...merged.values()];
  cells.sort((a, b) => {
    const c = a.periodStart.localeCompare(b.periodStart);
    return c !== 0 ? c : a.taskTitle.localeCompare(b.taskTitle);
  });
  return cells;
}
