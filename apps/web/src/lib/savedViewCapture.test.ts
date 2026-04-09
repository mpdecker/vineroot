import { describe, it, expect } from 'vitest';
import { buildSavedViewConfigFromCapture, summarizeSavedViewConfig } from './savedViewCapture';

describe('savedViewCapture', () => {
  it('buildSavedViewConfigFromCapture sets surface for timeline and workload query', () => {
    expect(
      buildSavedViewConfigFromCapture({
        sprintFilter: 'all',
        epicFilter: 'all',
        rootsOnly: false,
        currentView: 'timeline',
        workloadFrom: '',
      }),
    ).toMatchObject({ surface: 'timeline', sprintFilter: 'all' });

    expect(
      buildSavedViewConfigFromCapture({
        sprintFilter: 'all',
        epicFilter: 'all',
        rootsOnly: false,
        currentView: 'epics',
        workloadFrom: '',
      }),
    ).toMatchObject({ surface: 'epics' });

    expect(
      buildSavedViewConfigFromCapture({
        sprintFilter: 'sp1',
        epicFilter: 'all',
        rootsOnly: true,
        currentView: 'workload',
        workloadWeeks: 8,
        workloadFrom: '2026-01-06',
      }),
    ).toEqual({
      sprintFilter: 'sp1',
      epicFilter: 'all',
      rootsOnly: true,
      surface: 'workload',
      workloadWeeks: 8,
      workloadFrom: '2026-01-06',
    });
  });

  it('buildSavedViewConfigFromCapture stores list schedule filter and sort for list views', () => {
    expect(
      buildSavedViewConfigFromCapture({
        sprintFilter: 'all',
        epicFilter: 'all',
        rootsOnly: false,
        currentView: 'list',
        workloadFrom: '',
        listScheduleFilter: 'critical',
        listScheduleSort: 'slack_desc',
      }),
    ).toMatchObject({
      surface: 'list',
      listScheduleFilter: 'critical',
      listScheduleSort: 'slack_desc',
    });
  });

  it('summarizeSavedViewConfig resolves sprint and epic names', () => {
    const lines = summarizeSavedViewConfig(
      {
        surface: 'calendar',
        sprintFilter: 's1',
        epicFilter: 'e1',
        rootsOnly: true,
      },
      {
        sprints: [{ id: 's1', name: 'Sprint 42' }],
        epicTasks: [{ id: 'e1', title: 'Payments' }],
      },
    );
    expect(lines.some((l) => l.includes('Calendar'))).toBe(true);
    expect(
      summarizeSavedViewConfig(
        {
          surface: 'timeline',
          sprintFilter: 'all',
          epicFilter: 'all',
          rootsOnly: false,
        },
        { sprints: [], epicTasks: [] },
      ).some((l) => l.includes('Schedule')),
    ).toBe(true);
    expect(lines.some((l) => l.includes('Sprint 42'))).toBe(true);
    expect(lines.some((l) => l.includes('Payments'))).toBe(true);
    expect(lines.some((l) => l.includes('Roots only'))).toBe(true);
  });

  it('summarizeSavedViewConfig includes schedule filter and sort lines', () => {
    const lines = summarizeSavedViewConfig(
      {
        surface: 'board',
        sprintFilter: 'all',
        epicFilter: 'all',
        listScheduleFilter: 'deadline',
        listScheduleSort: 'critical_first',
      },
      { sprints: [], epicTasks: [] },
    );
    expect(lines.some((l) => l.includes('deadline'))).toBe(true);
    expect(lines.some((l) => l.includes('critical'))).toBe(true);
  });

  it('buildSavedViewConfigFromCapture sets timephased surface and optional fields', () => {
    expect(
      buildSavedViewConfigFromCapture({
        sprintFilter: 'all',
        epicFilter: 'all',
        rootsOnly: false,
        currentView: 'timephased',
        workloadFrom: '',
        timephasedGranularity: 'day',
        timephasedBasis: 'working',
        timephasedGridMode: 'resource_usage',
      }),
    ).toEqual({
      sprintFilter: 'all',
      epicFilter: 'all',
      rootsOnly: false,
      surface: 'timephased',
      timephasedGranularity: 'day',
      timephasedBasis: 'working',
      timephasedGridMode: 'resource_usage',
    });
  });

  it('buildSavedViewConfigFromCapture sets network surface', () => {
    expect(
      buildSavedViewConfigFromCapture({
        sprintFilter: 'all',
        epicFilter: 'all',
        rootsOnly: false,
        currentView: 'network',
        workloadFrom: '',
      }),
    ).toMatchObject({ surface: 'network' });
  });

  it('summarizeSavedViewConfig includes timephased detail lines', () => {
    const lines = summarizeSavedViewConfig(
      {
        surface: 'timephased',
        sprintFilter: 'all',
        epicFilter: 'all',
        timephasedGranularity: 'day',
        timephasedBasis: 'working',
        timephasedGridMode: 'list',
      },
      { sprints: [], epicTasks: [] },
    );
    expect(lines.some((l) => l.includes('Timephased'))).toBe(true);
    expect(lines.some((l) => l.includes('day buckets'))).toBe(true);
    expect(lines.some((l) => l.includes('working calendar'))).toBe(true);
    expect(lines.some((l) => l.includes('flat list'))).toBe(true);
  });

  it('summarizeSavedViewConfig labels network surface', () => {
    const lines = summarizeSavedViewConfig(
      { surface: 'network', sprintFilter: 'all', epicFilter: 'all' },
      { sprints: [], epicTasks: [] },
    );
    expect(lines.some((l) => l.includes('Network diagram'))).toBe(true);
  });
});
