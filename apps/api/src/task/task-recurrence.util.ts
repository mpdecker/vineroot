import { BadRequestException } from '@nestjs/common';

export type ParsedRecurrence = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  /** JS getUTCDay(): 0 Sun … 6 Sat */
  byDays: number[];
};

const DAY_TOKEN: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function parseParts(rule: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of rule.split(';')) {
    const p = raw.trim();
    if (!p) continue;
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim().toUpperCase();
    const v = p.slice(eq + 1).trim().toUpperCase();
    map.set(k, v);
  }
  return map;
}

export function parseRecurrenceRule(rule: string): ParsedRecurrence {
  const trimmed = rule?.trim();
  if (!trimmed) {
    throw new BadRequestException('recurrenceRule is empty');
  }
  const map = parseParts(trimmed);
  const freq = map.get('FREQ');
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY'].includes(freq)) {
    throw new BadRequestException(
      'recurrenceRule must set FREQ to DAILY, WEEKLY, or MONTHLY',
    );
  }
  const intervalRaw = map.get('INTERVAL') ?? '1';
  const interval = Math.max(1, parseInt(intervalRaw, 10) || 1);
  const byDayStr = map.get('BYDAY');
  const byDays: number[] = [];
  if (byDayStr) {
    for (const token of byDayStr.split(',')) {
      const t = token.trim().toUpperCase();
      if (DAY_TOKEN[t] === undefined) {
        throw new BadRequestException(`Unsupported BYDAY token: ${token}`);
      }
      byDays.push(DAY_TOKEN[t]);
    }
  }
  return {
    freq: freq as ParsedRecurrence['freq'],
    interval,
    byDays,
  };
}

function startOfUTCDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function addDaysUTC(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function addMonthsUTC(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  const day = x.getUTCDate();
  x.setUTCMonth(x.getUTCMonth() + months);
  if (x.getUTCDate() < day) {
    x.setUTCDate(0);
  }
  return x;
}

/** Next calendar day matching `targetDow` strictly after `strictlyAfter` (compare at UTC midnight). */
function nextWeekdayAfter(
  from: Date,
  targetDow: number,
  strictlyAfter: Date,
): Date {
  let d = startOfUTCDay(from);
  const cutoff = startOfUTCDay(strictlyAfter);
  for (let i = 0; i < 400; i++) {
    if (d.getTime() > cutoff.getTime() && d.getUTCDay() === targetDow) {
      return d;
    }
    d = addDaysUTC(d, 1);
  }
  throw new BadRequestException('Could not compute next weekly occurrence');
}

function earliestNextByDays(
  anchor: Date,
  days: number[],
  strictlyAfter: Date,
): Date {
  if (days.length === 0) {
    let d = startOfUTCDay(anchor);
    const cutoff = startOfUTCDay(strictlyAfter);
    for (let i = 0; i < 400; i++) {
      d = addDaysUTC(d, 1);
      if (d.getTime() > cutoff.getTime()) return d;
    }
    throw new BadRequestException('Could not compute next weekly occurrence');
  }
  let best: Date | null = null;
  for (const dow of days) {
    const cand = nextWeekdayAfter(anchor, dow, strictlyAfter);
    if (!best || cand.getTime() < best.getTime()) best = cand;
  }
  return best!;
}

/**
 * From anchor end date (due or start), advance until strictly after `completion`,
 * then return new due/start preserving offset between original due and start.
 */
export function computeNextRecurrenceWindow(input: {
  rule: string;
  dueDate: Date | null;
  startDate: Date | null;
  completion: Date;
}): { dueDate: Date | null; startDate: Date | null } {
  const parsed = parseRecurrenceRule(input.rule);
  const endAnchor = input.dueDate ?? input.startDate ?? input.completion;
  const startAnchor = input.startDate ?? input.dueDate ?? input.completion;
  const offsetMs =
    input.dueDate && input.startDate
      ? input.dueDate.getTime() - input.startDate.getTime()
      : null;

  let nextEnd: Date | undefined;
  if (parsed.freq === 'DAILY') {
    let d = startOfUTCDay(endAnchor);
    const cutoff = startOfUTCDay(input.completion);
    for (let i = 0; i < 400; i++) {
      if (d.getTime() > cutoff.getTime()) {
        nextEnd = d;
        break;
      }
      d = addDaysUTC(d, parsed.interval);
    }
    if (!nextEnd) {
      throw new BadRequestException('Could not compute next daily occurrence');
    }
  } else if (parsed.freq === 'WEEKLY') {
    if (parsed.byDays.length > 0) {
      nextEnd = earliestNextByDays(endAnchor, parsed.byDays, input.completion);
    } else {
      let d = startOfUTCDay(endAnchor);
      const cutoff = startOfUTCDay(input.completion);
      for (let i = 0; i < 400; i++) {
        if (d.getTime() > cutoff.getTime()) {
          nextEnd = d;
          break;
        }
        d = addDaysUTC(d, 7 * parsed.interval);
      }
      if (!nextEnd) {
        throw new BadRequestException('Could not compute next weekly occurrence');
      }
    }
  } else {
    let d = startOfUTCDay(endAnchor);
    const cutoff = startOfUTCDay(input.completion);
    for (let i = 0; i < 120; i++) {
      if (d.getTime() > cutoff.getTime()) {
        nextEnd = d;
        break;
      }
      d = addMonthsUTC(d, parsed.interval);
    }
    if (!nextEnd) {
      throw new BadRequestException('Could not compute next monthly occurrence');
    }
  }

  let nextStart: Date | null = null;
  let nextDue: Date | null = null;
  if (offsetMs != null && input.dueDate && input.startDate) {
    nextDue = nextEnd;
    nextStart = new Date(nextDue.getTime() - offsetMs);
  } else if (input.dueDate && !input.startDate) {
    nextDue = nextEnd;
  } else if (input.startDate && !input.dueDate) {
    const deltaDays = Math.round(
      (startOfUTCDay(endAnchor).getTime() -
        startOfUTCDay(startAnchor).getTime()) /
        86400000,
    );
    nextStart = addDaysUTC(nextEnd, deltaDays);
  } else {
    nextDue = nextEnd;
  }

  return { dueDate: nextDue, startDate: nextStart };
}
