/**
 * CPM calendar helpers. Default path uses UTC calendar dates (legacy).
 * When `timeZone` is a valid IANA id (not UTC), working days and exceptions
 * use that zone's local calendar date and weekday.
 */

const DAY_MS = 86_400_000;
const DEFAULT_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export type WeeklyPattern = Record<string, number>;

export type CalendarException = { date: string; workingMinutes: number };

const WEEKDAY_LONG_TO_KEY: Record<string, string> = {
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
  sunday: 'sun',
};

export function utcNoon(y: number, m0: number, d: number): Date {
  return new Date(Date.UTC(y, m0, d, 12, 0, 0, 0));
}

export function dateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateKeyUTC(key: string): Date {
  const [y, m, day] = key.split('-').map((x) => Number(x));
  if (!y || !m || !day) return new Date(NaN);
  return utcNoon(y, m - 1, day);
}

export function addUtcDays(d: Date, delta: number): Date {
  return new Date(d.getTime() + delta * DAY_MS);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isValidIanaTimeZoneId(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** UTC if missing, empty, or invalid IANA id. */
export function normalizeScheduleTimeZone(tz: string | null | undefined): string {
  if (!tz || typeof tz !== 'string' || tz.trim() === '') return 'UTC';
  const t = tz.trim();
  if (t === 'UTC') return 'UTC';
  return isValidIanaTimeZoneId(t) ? t : 'UTC';
}

/** Local calendar YYYY-MM-DD in `timeZone` for instant `d`. */
export function dateKeyInTimeZone(d: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  let y = '';
  let m = '';
  let day = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') day = p.value;
  }
  return `${y}-${m}-${day}`;
}

function getZonedDateTimeParts(
  d: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** `mon`..`sun` from local weekday in `timeZone`. */
export function localWeekdayKeyFromDate(d: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  });
  const w = fmt.format(d).toLowerCase();
  return WEEKDAY_LONG_TO_KEY[w] ?? 'mon';
}

function dayKeyFromUtcDate(d: Date): string {
  const dow = d.getUTCDay();
  return DEFAULT_DAY_KEYS[dow];
}

/** Proleptic Gregorian: add `delta` days to YYYY-MM-DD string. */
export function addCalendarDaysToDateKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map((x) => Number(x));
  const next = new Date(Date.UTC(y, m - 1, d + delta));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

/**
 * Smallest UTC instant whose local calendar date in `timeZone` equals `dateKey`.
 */
export function firstInstantOfZonedDateKey(dateKey: string, timeZone: string): Date {
  if (timeZone === 'UTC') {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }
  const [y, mo, da] = dateKey.split('-').map(Number);
  let lo = Date.UTC(y, mo - 1, da, 0, 0, 0, 0) - 2 * DAY_MS;
  let hi = Date.UTC(y, mo - 1, da, 0, 0, 0, 0) + 2 * DAY_MS;
  for (let i = 0; i < 16 && dateKeyInTimeZone(new Date(lo), timeZone) >= dateKey; i++) {
    lo -= DAY_MS;
  }
  for (let i = 0; i < 16 && dateKeyInTimeZone(new Date(hi), timeZone) < dateKey; i++) {
    hi += DAY_MS;
  }
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const k = dateKeyInTimeZone(new Date(mid), timeZone);
    if (k < dateKey) lo = mid + 1;
    else hi = mid;
  }
  return new Date(lo);
}

/**
 * Representative instant on local `dateKey` at 12:00 local (avoids midnight DST edges).
 */
export function zonedNoonFromDateKey(dateKey: string, timeZone: string): Date {
  if (timeZone === 'UTC') {
    const [y, m, d] = dateKey.split('-').map(Number);
    return utcNoon(y, m - 1, d);
  }
  let t = firstInstantOfZonedDateKey(dateKey, timeZone).getTime();
  for (let i = 0; i < 24; i++) {
    const p = getZonedDateTimeParts(new Date(t), timeZone);
    const key = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
    if (key !== dateKey) break;
    if (p.hour === 12 && p.minute === 0 && p.second === 0) return new Date(t);
    const curMin = p.hour * 60 + p.minute + p.second / 60;
    const deltaMin = 12 * 60 - curMin;
    t += Math.round(deltaMin * 60_000);
  }
  return new Date(t);
}

export function addZonedCalendarDays(d: Date, delta: number, timeZone: string): Date {
  if (delta === 0) return new Date(d.getTime());
  const key = dateKeyInTimeZone(d, timeZone);
  const nextKey = addCalendarDaysToDateKey(key, delta);
  return zonedNoonFromDateKey(nextKey, timeZone);
}

/** Offset from Monday (`mon` = 0) for `localWeekdayKeyFromDate` keys. */
const OFFSET_FROM_MON: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

/**
 * YYYY-MM-DD of the Monday starting the ISO week that contains `d` in `timeZone`
 * (same bucketing as project workload when using this TZ).
 */
export function weekStartMondayDateKeyInTimeZone(d: Date, timeZone: string): string {
  const tz = normalizeScheduleTimeZone(timeZone);
  const dayKey = dateKeyInTimeZone(d, tz);
  const noon = zonedNoonFromDateKey(dayKey, tz);
  const wk = localWeekdayKeyFromDate(noon, tz);
  const off = OFFSET_FROM_MON[wk] ?? 0;
  return addCalendarDaysToDateKey(dayKey, -off);
}

/** Consecutive Monday date keys, `weekCount` weeks starting at `firstMondayKey`. */
export function enumerateWeekStartMondayKeys(
  firstMondayKey: string,
  weekCount: number,
): string[] {
  const out: string[] = [];
  let k = firstMondayKey;
  for (let i = 0; i < weekCount; i++) {
    out.push(k);
    k = addCalendarDaysToDateKey(k, 7);
  }
  return out;
}

export function defaultWeeklyPattern(): WeeklyPattern {
  return { mon: 480, tue: 480, wed: 480, thu: 480, fri: 480, sat: 0, sun: 0 };
}

export function normalizeWeeklyPattern(raw: unknown): WeeklyPattern {
  const base = defaultWeeklyPattern();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(base)) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      base[k] = Math.min(v, 24 * 60);
    }
  }
  return base;
}

export function normalizeExceptions(raw: unknown): CalendarException[] {
  if (!Array.isArray(raw)) return [];
  const out: CalendarException[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (typeof r.date !== 'string') continue;
    const wm =
      typeof r.workingMinutes === 'number' && Number.isFinite(r.workingMinutes)
        ? Math.max(0, Math.min(r.workingMinutes, 24 * 60))
        : 0;
    out.push({ date: r.date.slice(0, 10), workingMinutes: wm });
  }
  return out;
}

/**
 * Working minutes on a calendar day given by `dateKey` (YYYY-MM-DD) in `timeZone`
 * (same semantics as `workingMinutesOnDay` at local noon on that date).
 */
export function workingMinutesOnDateKey(
  dateKey: string,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone: string,
): number {
  const tz = normalizeScheduleTimeZone(timeZone);
  const noon = zonedNoonFromDateKey(dateKey, tz);
  return workingMinutesOnDay(noon, weekly, exceptions, tz);
}

/** Inclusive list of YYYY-MM-DD date keys from start→due in `timeZone` (by local calendar). */
export function enumerateDateKeysInclusiveInTz(
  start: Date,
  endInclusive: Date,
  timeZone: string,
): string[] {
  const tz = normalizeScheduleTimeZone(timeZone);
  const keys: string[] = [];
  let k = dateKeyInTimeZone(start, tz);
  const endK = dateKeyInTimeZone(endInclusive, tz);
  for (let guard = 0; guard < 10000; guard++) {
    keys.push(k);
    if (k >= endK) break;
    const noon = zonedNoonFromDateKey(k, tz);
    const next = tz === 'UTC' ? addUtcDays(noon, 1) : addZonedCalendarDays(noon, 1, tz);
    k = dateKeyInTimeZone(next, tz);
  }
  return keys;
}

export function workingMinutesOnDay(
  d: Date,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone = 'UTC',
): number {
  const tz = normalizeScheduleTimeZone(timeZone);
  const key = tz === 'UTC' ? dateKeyUTC(d) : dateKeyInTimeZone(d, tz);
  const ex = exceptions.find((e) => e.date === key);
  if (ex) return ex.workingMinutes;
  const dk = tz === 'UTC' ? dayKeyFromUtcDate(d) : localWeekdayKeyFromDate(d, tz);
  const m = weekly[dk];
  return typeof m === 'number' && Number.isFinite(m) ? m : 0;
}

export function isWorkingDay(
  d: Date,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone = 'UTC',
): boolean {
  return workingMinutesOnDay(d, weekly, exceptions, timeZone) > 0;
}

/** First working day on or after `d` (same day counts if working). */
export function nextOrSameWorkingDay(
  d: Date,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone = 'UTC',
): Date {
  const tz = normalizeScheduleTimeZone(timeZone);
  let cur = new Date(d.getTime());
  for (let i = 0; i < 10_000; i++) {
    if (isWorkingDay(cur, weekly, exceptions, tz)) return cur;
    cur = tz === 'UTC' ? addUtcDays(cur, 1) : addZonedCalendarDays(cur, 1, tz);
  }
  return d;
}

/** First working day strictly after `d`. */
export function nextWorkingDayAfter(
  d: Date,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone = 'UTC',
): Date {
  const tz = normalizeScheduleTimeZone(timeZone);
  const next =
    tz === 'UTC' ? addUtcDays(d, 1) : addZonedCalendarDays(d, 1, tz);
  return nextOrSameWorkingDay(next, weekly, exceptions, tz);
}

/**
 * Move forward `workingDayCount` working days from anchor (exclusive of anchor unless anchor counts as step 0).
 * If `fromExclusive` is true, first step moves to next working day after anchor.
 */
export function addWorkingDays(
  anchor: Date,
  workingDayCount: number,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  fromExclusive: boolean,
  timeZone = 'UTC',
): Date {
  const tz = normalizeScheduleTimeZone(timeZone);
  let cur = fromExclusive
    ? nextWorkingDayAfter(anchor, weekly, exceptions, tz)
    : nextOrSameWorkingDay(anchor, weekly, exceptions, tz);
  let left = workingDayCount;
  while (left > 0) {
    cur = nextWorkingDayAfter(cur, weekly, exceptions, tz);
    left -= 1;
  }
  return cur;
}

export function addWorkingDaysBackward(
  anchor: Date,
  workingDayCount: number,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone = 'UTC',
): Date {
  const tz = normalizeScheduleTimeZone(timeZone);
  let cur = new Date(anchor.getTime());
  let left = workingDayCount;
  for (let i = 0; i < 10_000 && left > 0; i++) {
    cur = tz === 'UTC' ? addUtcDays(cur, -1) : addZonedCalendarDays(cur, -1, tz);
    if (isWorkingDay(cur, weekly, exceptions, tz)) left -= 1;
  }
  return cur;
}

/** Inclusive span: `durationWorkingDays` >= 1 means at least one working day. Milestone: 0 -> end = start. */
export function endDayInclusive(
  startDay: Date,
  durationWorkingDays: number,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone = 'UTC',
): Date {
  const tz = normalizeScheduleTimeZone(timeZone);
  if (durationWorkingDays <= 0) return startDay;
  let cur = nextOrSameWorkingDay(startDay, weekly, exceptions, tz);
  let left = durationWorkingDays - 1;
  while (left > 0) {
    cur = nextWorkingDayAfter(cur, weekly, exceptions, tz);
    left -= 1;
  }
  return cur;
}

export function durationWorkingDaysBetween(
  start: Date,
  endInclusive: Date,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone = 'UTC',
): number {
  const tz = normalizeScheduleTimeZone(timeZone);
  let cur = nextOrSameWorkingDay(start, weekly, exceptions, tz);
  const end = nextOrSameWorkingDay(endInclusive, weekly, exceptions, tz);
  if (cur > end) return 0;
  let n = 1;
  while (cur < end) {
    cur = nextWorkingDayAfter(cur, weekly, exceptions, tz);
    n += 1;
  }
  return n;
}

/**
 * Signed working-day count from baseline anchor to current anchor on each task’s calendar date
 * (project calendar: weekly pattern + exceptions, `timeZone`).
 * Counts working days strictly after the baseline calendar day through the current calendar day (inclusive).
 * Positive when the current finish/start is later than baseline.
 */
export function signedWorkingDayVarianceBetween(
  baselineDate: Date,
  currentDate: Date,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone: string,
): number | null {
  if (!baselineDate || !currentDate) return null;
  const tz = normalizeScheduleTimeZone(timeZone);
  const kb = tz === 'UTC' ? dateKeyUTC(baselineDate) : dateKeyInTimeZone(baselineDate, tz);
  const kc = tz === 'UTC' ? dateKeyUTC(currentDate) : dateKeyInTimeZone(currentDate, tz);
  if (kb === kc) return 0;

  const nextDateKey = (fromKey: string): string => {
    const noon = tz === 'UTC' ? parseDateKeyUTC(fromKey) : zonedNoonFromDateKey(fromKey, tz);
    const next =
      tz === 'UTC' ? addUtcDays(noon, 1) : addZonedCalendarDays(noon, 1, tz);
    return tz === 'UTC' ? dateKeyUTC(next) : dateKeyInTimeZone(next, tz);
  };

  const countWorkingInOpenInterval = (fromExclusiveKey: string, toInclusiveKey: string): number => {
    let n = 0;
    let key = nextDateKey(fromExclusiveKey);
    for (let g = 0; g < 10_000; g++) {
      const noon = tz === 'UTC' ? parseDateKeyUTC(key) : zonedNoonFromDateKey(key, tz);
      if (isWorkingDay(noon, weekly, exceptions, tz)) n += 1;
      if (key === toInclusiveKey) break;
      if (key > toInclusiveKey) break;
      key = nextDateKey(key);
    }
    return n;
  };

  if (kc > kb) {
    return countWorkingInOpenInterval(kb, kc);
  }
  return -countWorkingInOpenInterval(kc, kb);
}

/**
 * Sum working minutes on each local calendar day from `start` through `endInclusive` in `timeZone`.
 * Returns 0 when the range is empty or inverted on the calendar.
 */
export function sumWorkingMinutesInclusiveRange(
  start: Date,
  endInclusive: Date,
  weekly: WeeklyPattern,
  exceptions: CalendarException[],
  timeZone: string,
): number {
  const tz = normalizeScheduleTimeZone(timeZone);
  const ks = dateKeyInTimeZone(start, tz);
  const ke = dateKeyInTimeZone(endInclusive, tz);
  if (ks > ke) return 0;
  const keys = enumerateDateKeysInclusiveInTz(start, endInclusive, tz);
  let sum = 0;
  for (const k of keys) {
    sum += workingMinutesOnDateKey(k, weekly, exceptions, tz);
  }
  return sum;
}
