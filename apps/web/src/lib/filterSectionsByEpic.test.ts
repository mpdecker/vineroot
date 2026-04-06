import { describe, it, expect } from 'vitest';
import { filterSectionsByEpic, listEpicTasks } from './filterSectionsByEpic';
import type { Section, Task } from '../types';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    createdById: 'u1',
    title: 'T',
    description: '',
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder: 0,
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

const baseSection = (tasks: Task[]): Section => ({
  id: 's1',
  projectId: 'p1',
  name: 'Col',
  sortOrder: 0,
  tasks,
});

describe('listEpicTasks', () => {
  it('collects EPIC tasks deduped and sorted by title', () => {
    const sections = [
      baseSection([
        task({ id: 'e2', title: 'Zebra', workItemType: 'EPIC' }),
        task({ id: 'e1', title: 'Alpha', workItemType: 'EPIC' }),
        task({ id: 'x', title: 'Story', workItemType: 'STORY', parentTaskId: 'e1' }),
      ]),
    ];
    const epics = listEpicTasks(sections);
    expect(epics.map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('filterSectionsByEpic', () => {
  const epic = task({ id: 'epic-1', title: 'E', workItemType: 'EPIC' });
  const story = task({
    id: 'story-1',
    title: 'S',
    workItemType: 'STORY',
    parentTaskId: 'epic-1',
  });
  const other = task({ id: 'other', title: 'O' });

  const sections: Section[] = [
    baseSection([epic, other]),
    baseSection([story]),
  ];

  it('returns sections unchanged for all', () => {
    expect(filterSectionsByEpic(sections, 'all')).toEqual(sections);
  });

  it('keeps epic, descendants, and sections that contain them', () => {
    const out = filterSectionsByEpic(sections, 'epic-1');
    expect(out[0].tasks?.map((t) => t.id)).toEqual(['epic-1']);
    expect(out[1].tasks?.map((t) => t.id)).toEqual(['story-1']);
  });

  it('keeps parent row when only subtasks match (subtree)', () => {
    const nested = task({
      id: 'root',
      title: 'R',
      subtasks: [task({ id: 'child', title: 'C', parentTaskId: 'epic-1' })],
    });
    const sec = baseSection([nested]);
    const byId = filterSectionsByEpic([sec], 'epic-1');
    expect(byId[0].tasks).toHaveLength(1);
    expect(byId[0].tasks?.[0].id).toBe('root');
    expect(byId[0].tasks?.[0].subtasks?.map((c) => c.id)).toEqual(['child']);
  });
});
