import { enumerateWeekStartMondayKeys } from '../schedule/schedule-calendar.util';
import {
  startOfWeekMonday,
  enumerateWeekStarts,
  buildProjectWorkloadDto,
} from './project-workload.util';

describe('project-workload.util', () => {
  it('startOfWeekMonday returns Monday for mid-week', () => {
    const wed = new Date(2026, 3, 8);
    const mon = startOfWeekMonday(wed);
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(6);
    expect(mon.getMonth()).toBe(3);
  });

  it('startOfWeekMonday maps Sunday to previous Monday', () => {
    const sun = new Date(2026, 3, 12);
    const mon = startOfWeekMonday(sun);
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(6);
  });

  it('enumerateWeekStarts returns consecutive Mondays', () => {
    const first = new Date(2026, 3, 6);
    const ws = enumerateWeekStarts(first, 3);
    expect(ws).toHaveLength(3);
    expect(ws[0].getDay()).toBe(1);
    expect(ws[1].getTime() - ws[0].getTime()).toBe(7 * 86400000);
    expect(ws[2].getTime() - ws[1].getTime()).toBe(7 * 86400000);
  });

  it('buildProjectWorkloadDto buckets by due week and unassigned (UTC week keys)', () => {
    const weekKeys = enumerateWeekStartMondayKeys('2026-04-06', 3);
    const dto = buildProjectWorkloadDto(
      'p1',
      weekKeys,
      [
        {
          storyPoints: 2,
          startDate: null,
          dueDate: new Date(Date.UTC(2026, 3, 8, 12, 0, 0)),
          assignees: [{ userId: 'u1', user: { displayName: 'Alice' } }],
        },
        {
          storyPoints: null,
          startDate: null,
          dueDate: null,
          assignees: [],
        },
      ],
      'UTC',
    );

    expect(dto.projectId).toBe('p1');
    expect(dto.weekStarts).toEqual(['2026-04-06', '2026-04-13', '2026-04-20']);
    expect(dto.from).toBe('2026-04-06');
    expect(dto.to).toBe('2026-04-26');
    const alice = dto.rows.find((r) => r.userId === 'u1');
    expect(alice?.weeks[0].taskCount).toBe(1);
    expect(alice?.weeks[0].storyPoints).toBe(2);
    expect(alice?.weeks[0].allocationPercent).toBe(100);
    expect(alice?.weeks[1].taskCount).toBe(0);

    const un = dto.rows.find((r) => r.userId === '__unassigned__');
    expect(un?.unscheduled.taskCount).toBe(1);
    expect(un?.unscheduled.allocationPercent).toBe(0);
  });

  it('buildProjectWorkloadDto sums allocationPercent from assignee units', () => {
    const weekKeys = enumerateWeekStartMondayKeys('2026-04-06', 2);
    const dto = buildProjectWorkloadDto(
      'p1',
      weekKeys,
      [
        {
          storyPoints: 0,
          startDate: null,
          dueDate: new Date(Date.UTC(2026, 3, 8, 12, 0, 0)),
          assignees: [{ userId: 'u1', user: { displayName: 'Alice' }, unitsPercent: 40 }],
        },
        {
          storyPoints: 0,
          startDate: null,
          dueDate: new Date(Date.UTC(2026, 3, 9, 12, 0, 0)),
          assignees: [{ userId: 'u1', user: { displayName: 'Alice' }, unitsPercent: 30 }],
        },
      ],
      'UTC',
    );
    const alice = dto.rows.find((r) => r.userId === 'u1');
    expect(alice?.weeks[0].taskCount).toBe(2);
    expect(alice?.weeks[0].allocationPercent).toBe(70);
  });
});
