import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { invalidateQueriesFromSocketEvent } from './socket';

function mockClient() {
  return { invalidateQueries: vi.fn() } as unknown as QueryClient;
}

describe('invalidateQueriesFromSocketEvent', () => {
  it('invalidates broad task and project keys on task:updated', () => {
    const qc = mockClient();
    invalidateQueriesFromSocketEvent(qc, {
      type: 'task:updated',
      data: { task: { id: 't1', projectId: 'p1' }, action: 'updated' },
      timestamp: new Date(),
      workspaceId: 'ws-1',
    });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks:me'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['goals'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['reporting'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['automations'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['audit-logs'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['comments'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['task-detail', 't1'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects', 'p1'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks', 'p1'] });
  });

  it('invalidates task id from taskId-only payload (agent complete)', () => {
    const qc = mockClient();
    invalidateQueriesFromSocketEvent(qc, {
      type: 'task:completed',
      data: { taskId: 't99', status: 'DONE' },
      timestamp: new Date(),
      workspaceId: 'ws-1',
    });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['task-detail', 't99'] });
  });

  it('handles agent:* events like task-like', () => {
    const qc = mockClient();
    invalidateQueriesFromSocketEvent(qc, {
      type: 'agent:completed',
      data: {},
      timestamp: new Date(),
      workspaceId: 'ws-1',
    });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('invalidates projects on section:updated without task-specific keys', () => {
    const qc = mockClient();
    invalidateQueriesFromSocketEvent(qc, {
      type: 'section:updated',
      data: {},
      timestamp: new Date(),
      workspaceId: 'ws-1',
    });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] });
    const keys = (qc.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => (c[0] as { queryKey: unknown[] }).queryKey,
    );
    expect(keys.some((k) => k[0] === 'tasks' && k.length > 1)).toBe(false);
  });

  it('invalidates task by comment.taskId on comment:created', () => {
    const qc = mockClient();
    invalidateQueriesFromSocketEvent(qc, {
      type: 'comment:created',
      data: { comment: { taskId: 't55' } },
      timestamp: new Date(),
      workspaceId: 'ws-1',
    });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['task-detail', 't55'] });
  });

  it('invalidates notifications on notification:new', () => {
    const qc = mockClient();
    invalidateQueriesFromSocketEvent(qc, {
      type: 'notification:new',
      data: {},
      timestamp: new Date(),
      workspaceId: 'ws-1',
    });

    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['notifications:unread'],
    });
  });
});
