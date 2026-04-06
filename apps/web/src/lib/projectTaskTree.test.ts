import { describe, it, expect, beforeEach } from 'vitest';
import type { Section, Task } from '../types';
import {
  buildTaskMapFromSections,
  flattenTasksFromSections,
  getTaskFromSections,
  getDirectChildIds,
  rebuildProjectSectionsFromTaskMap,
  cascadeSectionToDescendants,
} from './projectTaskTree';

function t(
  id: string,
  overrides: Partial<Task> & { subtasks?: Task[] } = {},
): Task {
  return {
    id,
    createdById: 'u1',
    title: id,
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder: 0,
    sectionId: 's1',
    actorTier: 'HUMAN',
    domain: 'GENERAL',
    complexity: 'LOW',
    reviewGate: 'NONE',
    retryCount: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function sampleTreeSections(): Section[] {
  return [
    {
      id: 's1',
      projectId: 'p1',
      name: 'A',
      sortOrder: 0,
      tasks: [
        t('root', {
          sortOrder: 0,
          subtasks: [
            t('c1', { parentTaskId: 'root', sortOrder: 0 }),
            t('c2', {
              parentTaskId: 'root',
              sortOrder: 1,
              subtasks: [t('gc', { parentTaskId: 'c2', sortOrder: 0 })],
            }),
          ],
        }),
      ],
    },
  ];
}

describe('projectTaskTree', () => {
  let sections: Section[];

  beforeEach(() => {
    sections = sampleTreeSections();
  });

  it('buildTaskMapFromSections indexes every nested task', () => {
    const m = buildTaskMapFromSections(sections);
    expect([...m.keys()].sort()).toEqual(['c1', 'c2', 'gc', 'root']);
  });

  it('getTaskFromSections finds deep nodes', () => {
    expect(getTaskFromSections(sections, 'gc')?.id).toBe('gc');
    expect(getTaskFromSections(sections, 'missing')).toBeUndefined();
  });

  it('getDirectChildIds returns sorted sibling ids', () => {
    expect(getDirectChildIds(sections, 'root')).toEqual(['c1', 'c2']);
    expect(getDirectChildIds(sections, 'c2')).toEqual(['gc']);
  });

  it('getDirectChildIds returns empty for leaf or unknown parent', () => {
    expect(getDirectChildIds(sections, 'c1')).toEqual([]);
    expect(getDirectChildIds(sections, 'gc')).toEqual([]);
    expect(getDirectChildIds(sections, 'nope')).toEqual([]);
  });

  it('getTaskFromSections finds tasks in later sections', () => {
    const multi: Section[] = [
      ...sections,
      {
        id: 's2',
        projectId: 'p1',
        name: 'B',
        sortOrder: 1,
        tasks: [t('other', { sectionId: 's2', sortOrder: 0 })],
      },
    ];
    expect(getTaskFromSections(multi, 'other')?.sectionId).toBe('s2');
  });

  it('flattenTasksFromSections is depth-first pre-order', () => {
    expect(flattenTasksFromSections(sections).map((x) => x.id)).toEqual([
      'root',
      'c1',
      'c2',
      'gc',
    ]);
  });

  it('cascadeSectionToDescendants updates nested sectionId', () => {
    const local = sampleTreeSections();
    const m = buildTaskMapFromSections(local);
    m.get('root')!.sectionId = 's2';
    cascadeSectionToDescendants(m, 'root', 's2');
    expect(m.get('c1')!.sectionId).toBe('s2');
    expect(m.get('c2')!.sectionId).toBe('s2');
    expect(m.get('gc')!.sectionId).toBe('s2');
  });

  it('rebuildProjectSectionsFromTaskMap preserves tree shape', () => {
    const flat = buildTaskMapFromSections(sections);
    const next = rebuildProjectSectionsFromTaskMap(sections, flat);
    expect(next[0].tasks?.[0].subtasks?.map((x) => x.id)).toEqual(['c1', 'c2']);
    expect(next[0].tasks?.[0].subtasks?.find((x) => x.id === 'c2')?.subtasks?.[0].id).toBe(
      'gc',
    );
  });

  it('rebuildProjectSectionsFromTaskMap keeps roots in correct sections after map edits', () => {
    const multi: Section[] = [
      {
        id: 's1',
        projectId: 'p1',
        name: 'A',
        sortOrder: 0,
        tasks: [t('a', { sectionId: 's1', sortOrder: 0 })],
      },
      {
        id: 's2',
        projectId: 'p1',
        name: 'B',
        sortOrder: 1,
        tasks: [t('b', { sectionId: 's2', sortOrder: 0 })],
      },
    ];
    const flat = buildTaskMapFromSections(multi);
    flat.get('a')!.sortOrder = 1;
    flat.get('b')!.sortOrder = 0;
    const next = rebuildProjectSectionsFromTaskMap(multi, flat);
    expect(next.find((s) => s.id === 's1')?.tasks?.map((x) => x.id)).toEqual(['a']);
    expect(next.find((s) => s.id === 's2')?.tasks?.map((x) => x.id)).toEqual(['b']);
    expect(next.find((s) => s.id === 's1')?.tasks?.[0].sortOrder).toBe(1);
    expect(next.find((s) => s.id === 's2')?.tasks?.[0].sortOrder).toBe(0);
  });
});
