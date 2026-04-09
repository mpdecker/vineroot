import {
  addUtcDays,
  addWorkingDays,
  addWorkingDaysBackward,
  addCalendarDaysToDateKey,
  dateKeyInTimeZone,
  dateKeyUTC,
  defaultWeeklyPattern,
  durationWorkingDaysBetween,
  endDayInclusive,
  firstInstantOfZonedDateKey,
  isWorkingDay,
  isValidIanaTimeZoneId,
  localWeekdayKeyFromDate,
  nextOrSameWorkingDay,
  nextWorkingDayAfter,
  normalizeExceptions,
  normalizeScheduleTimeZone,
  normalizeWeeklyPattern,
  parseDateKeyUTC,
  signedWorkingDayVarianceBetween,
  utcNoon,
  workingMinutesOnDay,
  zonedNoonFromDateKey,
  weekStartMondayDateKeyInTimeZone,
  enumerateWeekStartMondayKeys,
  sumWorkingMinutesInclusiveRange,
} from './schedule-calendar.util';

describe('schedule-calendar.util', () => {
  const weekly = defaultWeeklyPattern();
  const ex: [] = [];

  it('nextOrSameWorkingDay lands on Monday from Saturday', () => {
    const sat = utcNoon(2026, 3, 4); // Saturday
    const mon = nextOrSameWorkingDay(sat, weekly, ex);
    expect(mon.getUTCDay()).toBe(1);
  });

  it('addWorkingDays from exclusive anchor skips weekend', () => {
    const thu = utcNoon(2026, 0, 8); // Thu Jan 8 2026
    const fri = addUtcDays(thu, 1);
    const out = addWorkingDays(fri, 0, weekly, ex, true);
    expect(out.getUTCDay()).toBe(1); // Mon Jan 12
  });

  it('normalizeWeeklyPattern clamps invalid values and fills defaults', () => {
    const n = normalizeWeeklyPattern({ mon: 99999, bogus: 123 });
    expect(n.mon).toBe(24 * 60);
    expect(n.sat).toBe(0);
  });

  it('normalizeWeeklyPattern falls back for non-object', () => {
    expect(normalizeWeeklyPattern(null).fri).toBe(480);
  });

  it('normalizeExceptions parses date and workingMinutes', () => {
    const list = normalizeExceptions([
      { date: '2026-06-15T00:00:00.000Z', workingMinutes: 240 },
      { invalid: true },
    ]);
    expect(list).toEqual([{ date: '2026-06-15', workingMinutes: 240 }]);
  });

  it('workingMinutesOnDay uses exception override', () => {
    const d = utcNoon(2026, 5, 15);
    const key = dateKeyUTC(d);
    const mins = workingMinutesOnDay(d, weekly, [{ date: key, workingMinutes: 0 }]);
    expect(mins).toBe(0);
  });

  it('isWorkingDay matches workingMinutesOnDay > 0', () => {
    expect(isWorkingDay(utcNoon(2026, 0, 5), weekly, ex)).toBe(true);
    expect(isWorkingDay(utcNoon(2026, 0, 4), weekly, ex)).toBe(false);
  });

  it('sumWorkingMinutesInclusiveRange sums Mon–Fri across a week span (UTC)', () => {
    const mon = utcNoon(2026, 0, 5);
    const fri = utcNoon(2026, 0, 9);
    const total = sumWorkingMinutesInclusiveRange(mon, fri, weekly, ex, 'UTC');
    expect(total).toBe(5 * 480);
    const partial = sumWorkingMinutesInclusiveRange(mon, utcNoon(2026, 0, 7), weekly, ex, 'UTC');
    expect(partial).toBe(3 * 480);
  });

  it('endDayInclusive returns start for milestone duration 0', () => {
    const mon = utcNoon(2026, 0, 5);
    expect(endDayInclusive(mon, 0, weekly, ex).getTime()).toBe(mon.getTime());
  });

  it('signedWorkingDayVarianceBetween skips weekends for Fri to Mon slip', () => {
    const fri = utcNoon(2026, 0, 9);
    const mon = utcNoon(2026, 0, 12);
    expect(signedWorkingDayVarianceBetween(fri, mon, weekly, ex, 'UTC')).toBe(1);
  });

  it('signedWorkingDayVarianceBetween is negative when current is earlier', () => {
    const fri = utcNoon(2026, 0, 16);
    const wed = utcNoon(2026, 0, 14);
    expect(signedWorkingDayVarianceBetween(fri, wed, weekly, ex, 'UTC')).toBe(-2);
  });

  it('durationWorkingDaysBetween counts inclusive working days', () => {
    const mon = utcNoon(2026, 0, 5);
    const wed = utcNoon(2026, 0, 7);
    expect(durationWorkingDaysBetween(mon, wed, weekly, ex)).toBe(3);
  });

  it('addWorkingDaysBackward moves to prior working days', () => {
    const mon = utcNoon(2026, 0, 5);
    const prev = addWorkingDaysBackward(mon, 1, weekly, ex);
    expect(prev.getUTCDay()).toBe(5);
  });

  it('nextWorkingDayAfter skips same-day', () => {
    const mon = utcNoon(2026, 0, 5);
    const tue = nextWorkingDayAfter(mon, weekly, ex);
    expect(tue.getUTCDate()).toBe(6);
  });

  it('parseDateKeyUTC round-trips with dateKeyUTC', () => {
    const d = utcNoon(2026, 2, 10);
    expect(dateKeyUTC(parseDateKeyUTC('2026-03-10'))).toBe('2026-03-10');
  });

  it('normalizeScheduleTimeZone rejects bogus ids', () => {
    expect(normalizeScheduleTimeZone('Not/AZone')).toBe('UTC');
    expect(normalizeScheduleTimeZone('America/New_York')).toBe('America/New_York');
  });

  it('isValidIanaTimeZoneId matches Intl', () => {
    expect(isValidIanaTimeZoneId('UTC')).toBe(true);
    expect(isValidIanaTimeZoneId('Invalid')).toBe(false);
  });

  it('addCalendarDaysToDateKey rolls months', () => {
    expect(addCalendarDaysToDateKey('2026-01-30', 5)).toBe('2026-02-04');
  });

  it('America/New_York: UTC Monday morning can still be prior local Sunday (non-working)', () => {
    const tz = 'America/New_York';
    // 2026-01-05 04:00 UTC = 2026-01-04 evening in NY → local Sunday
    const d = new Date('2026-01-05T04:00:00.000Z');
    expect(dateKeyInTimeZone(d, tz)).toBe('2026-01-04');
    expect(isWorkingDay(d, weekly, [], tz)).toBe(false);
    expect(isWorkingDay(d, weekly, [], 'UTC')).toBe(true);
  });

  it('nextOrSameWorkingDay advances using local calendar in US Eastern', () => {
    const tz = 'America/New_York';
    const sunLocal = new Date('2026-01-04T17:00:00.000Z'); // noon Eastern on Sunday
    const mon = nextOrSameWorkingDay(sunLocal, weekly, [], tz);
    expect(dateKeyInTimeZone(mon, tz)).toBe('2026-01-05');
  });

  it('firstInstantOfZonedDateKey yields a UTC instant on the requested local calendar date', () => {
    const tz = 'America/New_York';
    const t = firstInstantOfZonedDateKey('2026-01-05', tz);
    expect(dateKeyInTimeZone(t, tz)).toBe('2026-01-05');
  });

  it('zonedNoonFromDateKey stays on the same local date in US Eastern', () => {
    const tz = 'America/New_York';
    const key = '2026-01-06';
    const noon = zonedNoonFromDateKey(key, tz);
    expect(dateKeyInTimeZone(noon, tz)).toBe(key);
  });

  it('localWeekdayKeyFromDate maps a zoned noon to mon..sun keys', () => {
    const tz = 'America/New_York';
    const monNoon = zonedNoonFromDateKey('2026-01-05', tz);
    expect(localWeekdayKeyFromDate(monNoon, tz)).toBe('mon');
  });

  it('addWorkingDays respects timeZone when stepping calendar days', () => {
    const tz = 'America/New_York';
    const fri = zonedNoonFromDateKey('2026-01-09', tz);
    // Exclusive anchor → next working day Mon 12, then one more → Tue 13
    const out = addWorkingDays(fri, 1, weekly, [], true, tz);
    expect(dateKeyInTimeZone(out, tz)).toBe('2026-01-13');
  });

  it('weekStartMondayDateKeyInTimeZone returns Monday key in UTC', () => {
    const wed = utcNoon(2026, 0, 7);
    expect(weekStartMondayDateKeyInTimeZone(wed, 'UTC')).toBe('2026-01-05');
  });

  it('enumerateWeekStartMondayKeys lists consecutive Monday keys', () => {
    expect(enumerateWeekStartMondayKeys('2026-01-05', 3)).toEqual([
      '2026-01-05',
      '2026-01-12',
      '2026-01-19',
    ]);
  });
});
