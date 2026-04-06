import { describe, it, expect } from 'vitest';
import { ensureWorkspaceOnProject, mergeProjectsAcrossWorkspaces } from './projectWorkspace';
import type { Project } from '../types';

const base = (over: Partial<Project> = {}): Project => ({
  id: 'p1',
  workspaceIds: ['ws-a'],
  name: 'P',
  color: 'BLUE',
  status: 'ACTIVE',
  isPrivate: false,
  isArchived: false,
  defaultView: 'list',
  ...over,
});

describe('ensureWorkspaceOnProject', () => {
  it('adds workspace id when missing from workspaceIds', () => {
    const p = base({ workspaceIds: [] });
    const out = ensureWorkspaceOnProject(p, 'ws-x');
    expect(out.workspaceIds).toEqual(['ws-x']);
  });

  it('adds workspace id when workspaceIds is undefined', () => {
    const p = { ...base(), workspaceIds: undefined } as unknown as Project;
    const out = ensureWorkspaceOnProject(p, 'ws-x');
    expect(out.workspaceIds).toEqual(['ws-x']);
  });

  it('is a no-op when workspace already present', () => {
    const p = base({ workspaceIds: ['ws-a', 'ws-b'] });
    const out = ensureWorkspaceOnProject(p, 'ws-a');
    expect(out).toBe(p);
    expect(out.workspaceIds).toEqual(['ws-a', 'ws-b']);
  });
});

describe('mergeProjectsAcrossWorkspaces', () => {
  it('dedupes by id and unions workspaceIds', () => {
    const a = ensureWorkspaceOnProject(base({ id: 'p1', workspaceIds: [] }), 'ws-a');
    const b = ensureWorkspaceOnProject(base({ id: 'p1', workspaceIds: [] }), 'ws-b');
    const merged = mergeProjectsAcrossWorkspaces([[a], [b]]);
    expect(merged).toHaveLength(1);
    expect(merged[0].workspaceIds.sort()).toEqual(['ws-a', 'ws-b'].sort());
  });

  it('keeps distinct projects', () => {
    const merged = mergeProjectsAcrossWorkspaces([
      [base({ id: 'p1' })],
      [base({ id: 'p2', workspaceIds: ['ws-a'] })],
    ]);
    expect(merged.map((x) => x.id).sort()).toEqual(['p1', 'p2']);
  });

  it('when deduping, keeps counts from the first response if the second omits them', () => {
    const a = ensureWorkspaceOnProject(
      base({ id: 'p1', taskCount: 4, completedTaskCount: 1 }),
      'ws-a',
    );
    const b = ensureWorkspaceOnProject(base({ id: 'p1', workspaceIds: [] }), 'ws-b');
    const merged = mergeProjectsAcrossWorkspaces([[a], [b]]);
    expect(merged[0].taskCount).toBe(4);
    expect(merged[0].completedTaskCount).toBe(1);
  });

  it('when deduping, uses explicit zeros from a later response', () => {
    const a = ensureWorkspaceOnProject(
      base({ id: 'p1', taskCount: 9, completedTaskCount: 2 }),
      'ws-a',
    );
    const b = ensureWorkspaceOnProject(
      base({ id: 'p1', workspaceIds: [], taskCount: 0, completedTaskCount: 0 }),
      'ws-b',
    );
    const merged = mergeProjectsAcrossWorkspaces([[a], [b]]);
    expect(merged[0].taskCount).toBe(0);
    expect(merged[0].completedTaskCount).toBe(0);
  });
});
