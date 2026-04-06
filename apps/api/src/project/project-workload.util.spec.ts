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

  it('buildProjectWorkloadDto buckets by due week and unassigned', () => {
    const weekStarts = enumerateWeekStarts(new Date(2026, 3, 6), 3);
    const dto = buildProjectWorkloadDto('p1', weekStarts, [
      {
        storyPoints: 2,
        startDate: null,
        dueDate: new Date(2026, 3, 8),
        assignees: [{ userId: 'u1', user: { displayName: 'Alice' } }],
      },
      {
        storyPoints: null,
        startDate: null,
        dueDate: null,
        assignees: [],
      },
    ]);

    expect(dto.projectId).toBe('p1');
    expect(dto.weekStarts).toHaveLength(3);
    const alice = dto.rows.find((r) => r.userId === 'u1');
    expect(alice?.weeks[0].taskCount).toBe(1);
    expect(alice?.weeks[0].storyPoints).toBe(2);
    expect(alice?.weeks[1].taskCount).toBe(0);

    const un = dto.rows.find((r) => r.userId === '__unassigned__');
    expect(un?.unscheduled.taskCount).toBe(1);
  });
});
