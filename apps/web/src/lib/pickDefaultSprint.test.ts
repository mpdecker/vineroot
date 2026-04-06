import { describe, expect, it } from 'vitest';
import { pickDefaultSprintId } from './pickDefaultSprint';
import type { Sprint } from '../types';

function s(
  id: string,
  state: Sprint['state'],
  start: string,
  end: string,
  sortOrder = 0,
): Sprint {
  return {
    id,
    projectId: 'p1',
    name: id,
    startDate: start,
    endDate: end,
    state,
    sortOrder,
    createdAt: '',
    updatedAt: '',
  };
}

describe('pickDefaultSprintId', () => {
  it('returns null for empty list', () => {
    expect(pickDefaultSprintId([])).toBeNull();
  });

  it('prefers ACTIVE over PLANNED', () => {
    const id = pickDefaultSprintId([
      s('later', 'PLANNED', '2026-06-01', '2026-06-14'),
      s('now', 'ACTIVE', '2026-04-01', '2026-04-14'),
    ]);
    expect(id).toBe('now');
  });

  it('uses earliest-start PLANNED when no ACTIVE', () => {
    const id = pickDefaultSprintId([
      s('b', 'PLANNED', '2026-05-01', '2026-05-14'),
      s('a', 'PLANNED', '2026-04-01', '2026-04-14'),
    ]);
    expect(id).toBe('a');
  });

  it('falls back to most recently ended when only CLOSED', () => {
    const id = pickDefaultSprintId([
      s('old', 'CLOSED', '2026-01-01', '2026-01-14'),
      s('new', 'CLOSED', '2026-03-01', '2026-03-14'),
    ]);
    expect(id).toBe('new');
  });
});
