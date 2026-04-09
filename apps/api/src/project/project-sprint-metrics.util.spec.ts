import { TaskStatus } from '@prisma/client';
import {
  calendarDayToIsoKey,
  completedCumulativeThroughDayEnd,
  eachCalendarDayInclusive,
  endOfCalendarDay,
  prismaDateFromIsoKey,
  resolveSprintReportWindow,
  startOfCalendarDay,
  storyPointsRemainingAtDayEnd,
} from './project-sprint-metrics.util';

describe('project-sprint-metrics.util', () => {
  describe('resolveSprintReportWindow', () => {
    const sprintStart = new Date(2024, 5, 10);
    const sprintEnd = new Date(2024, 5, 12);

    it('returns full sprint when from/to omitted', () => {
      const r = resolveSprintReportWindow(sprintStart, sprintEnd);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.windowStart.getTime()).toBe(startOfCalendarDay(sprintStart).getTime());
        expect(r.windowEnd.getTime()).toBe(startOfCalendarDay(sprintEnd).getTime());
      }
    });

    it('restricts to intersection with sprint', () => {
      const mid = eachCalendarDayInclusive(sprintStart, sprintEnd)[1];
      const midKey = calendarDayToIsoKey(mid);
      const r = resolveSprintReportWindow(sprintStart, sprintEnd, midKey, midKey);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.windowStart.getTime()).toBe(startOfCalendarDay(mid).getTime());
        expect(r.windowEnd.getTime()).toBe(startOfCalendarDay(mid).getTime());
      }
    });

    it('clamps from before sprint start', () => {
      const r = resolveSprintReportWindow(sprintStart, sprintEnd, '2024-06-01', '2024-06-11');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.windowStart.getDate()).toBe(10);
      }
    });

    it('returns FROM_AFTER_TO when from > to before clamp', () => {
      expect(
        resolveSprintReportWindow(sprintStart, sprintEnd, '2024-06-12', '2024-06-10'),
      ).toEqual({ ok: false, code: 'FROM_AFTER_TO' });
    });

    it('returns NO_OVERLAP when window is entirely outside sprint', () => {
      expect(
        resolveSprintReportWindow(sprintStart, sprintEnd, '2024-07-01', '2024-07-05'),
      ).toEqual({ ok: false, code: 'NO_OVERLAP' });
    });

    it('returns INVALID_DATE for garbage input', () => {
      expect(
        resolveSprintReportWindow(sprintStart, sprintEnd, 'not-a-date', undefined),
      ).toEqual({ ok: false, code: 'INVALID_DATE' });
    });

    it('when only from is set, window end defaults to sprint end', () => {
      const r = resolveSprintReportWindow(sprintStart, sprintEnd, '2024-06-11', undefined);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.windowStart.getDate()).toBe(11);
        expect(r.windowEnd.getTime()).toBe(startOfCalendarDay(sprintEnd).getTime());
      }
    });

    it('when only to is set, window start defaults to sprint start', () => {
      const r = resolveSprintReportWindow(sprintStart, sprintEnd, undefined, '2024-06-11');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.windowStart.getTime()).toBe(startOfCalendarDay(sprintStart).getTime());
        expect(r.windowEnd.getDate()).toBe(11);
      }
    });
  });

  describe('eachCalendarDayInclusive', () => {
    it('returns inclusive local calendar days', () => {
      const start = new Date(2026, 3, 4);
      const end = new Date(2026, 3, 6);
      const days = eachCalendarDayInclusive(start, end);
      expect(days).toHaveLength(3);
      expect(days[0].getDate()).toBe(4);
      expect(days[2].getDate()).toBe(6);
    });
  });

  describe('calendarDayToIsoKey / prismaDateFromIsoKey', () => {
    it('round-trips a calendar day key for DB DATE queries', () => {
      const day = startOfCalendarDay(new Date(2026, 3, 4));
      const key = calendarDayToIsoKey(day);
      const d = prismaDateFromIsoKey(key);
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.toISOString().startsWith(key)).toBe(true);
    });
  });

  describe('storyPointsRemainingAtDayEnd', () => {
    const dayEnd = endOfCalendarDay(new Date(2026, 3, 4));

    it('returns 0 for CANCELLED', () => {
      expect(
        storyPointsRemainingAtDayEnd(
          {
            status: TaskStatus.CANCELLED,
            storyPoints: 5,
            completedAt: null,
            updatedAt: new Date(),
          },
          dayEnd,
        ),
      ).toBe(0);
    });

    it('returns 0 for DONE completed on or before day end', () => {
      const at = new Date(2026, 3, 4, 10, 0, 0);
      expect(
        storyPointsRemainingAtDayEnd(
          {
            status: TaskStatus.DONE,
            storyPoints: 3,
            completedAt: at,
            updatedAt: at,
          },
          dayEnd,
        ),
      ).toBe(0);
    });

    it('returns points for DONE completed after day end', () => {
      const at = new Date(2026, 3, 5, 10, 0, 0);
      expect(
        storyPointsRemainingAtDayEnd(
          {
            status: TaskStatus.DONE,
            storyPoints: 3,
            completedAt: at,
            updatedAt: at,
          },
          dayEnd,
        ),
      ).toBe(3);
    });

    it('returns full points for non-terminal statuses', () => {
      expect(
        storyPointsRemainingAtDayEnd(
          {
            status: TaskStatus.IN_PROGRESS,
            storyPoints: 8,
            completedAt: null,
            updatedAt: new Date(),
          },
          dayEnd,
        ),
      ).toBe(8);
    });
  });

  describe('completedCumulativeThroughDayEnd', () => {
    const sprintStartMs = startOfCalendarDay(new Date(2026, 3, 1)).getTime();
    const upper = endOfCalendarDay(new Date(2026, 3, 4)).getTime();

    it('sums DONE story points completed within window', () => {
      const t1 = new Date(2026, 3, 2, 12, 0, 0);
      const t2 = new Date(2026, 3, 4, 8, 0, 0);
      const sum = completedCumulativeThroughDayEnd(
        [
          {
            status: TaskStatus.DONE,
            storyPoints: 2,
            completedAt: t1,
            updatedAt: t1,
          },
          {
            status: TaskStatus.DONE,
            storyPoints: 5,
            completedAt: t2,
            updatedAt: t2,
          },
          {
            status: TaskStatus.IN_PROGRESS,
            storyPoints: 10,
            completedAt: null,
            updatedAt: new Date(),
          },
        ],
        sprintStartMs,
        upper,
      );
      expect(sum).toBe(7);
    });

    it('ignores completions before sprint start', () => {
      const early = new Date(2026, 2, 28, 12, 0, 0);
      const sum = completedCumulativeThroughDayEnd(
        [
          {
            status: TaskStatus.DONE,
            storyPoints: 3,
            completedAt: early,
            updatedAt: early,
          },
        ],
        sprintStartMs,
        upper,
      );
      expect(sum).toBe(0);
    });
  });
});
