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
    expect(lines.some((l) => l.includes('Sprint 42'))).toBe(true);
    expect(lines.some((l) => l.includes('Payments'))).toBe(true);
    expect(lines.some((l) => l.includes('Roots only'))).toBe(true);
  });
});
