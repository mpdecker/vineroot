import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskDetail } from './TaskDetail';
import type { Task } from '../../types';

const mutate = vi.fn();
const assignMutate = vi.fn();
const unassignMutate = vi.fn();

vi.mock('../../hooks/useTasks', () => ({
  useUpdateTask: () => ({ mutate, isPending: false }),
  useAssignTask: () => ({ mutate: assignMutate, isPending: false }),
  useRemoveAssignee: () => ({ mutate: unassignMutate, isPending: false }),
  useTask: (_id: string, opts?: { placeholderData?: Task }) => ({
    data: opts?.placeholderData,
    isFetching: false,
  }),
  useTasks: () => ({ data: [] }),
  useCreateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useAddTaskDependency: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveTaskDependency: () => ({ mutate: vi.fn(), isPending: false }),
  useAddTaskAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTaskAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadTaskAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useSetTaskCustomFieldValue: () => ({ mutate: vi.fn() }),
  useDuplicateTask: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useProjects', () => ({
  useCreateSprint: () => ({ mutate: vi.fn(), isPending: false }),
  useProject: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('../../hooks/useCustomFields', () => ({
  useWorkspaceCustomFields: () => ({ data: [] }),
  useProjectCustomFields: () => ({ data: [] }),
  useAddProjectCustomField: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../stores/ui.store', () => ({
  useUIStore: (sel: (s: { openTask: () => void }) => unknown) =>
    sel({ openTask: vi.fn() }),
}));

vi.mock('../../hooks/useWorkspaces', () => ({
  useWorkspaces: () => ({ data: [] }),
}));

vi.mock('../../hooks/useComments', () => ({
  useTaskComments: () => ({ data: [], isLoading: false }),
  useCreateComment: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../hooks/useAuditLogs', () => ({
  useTaskAuditLogs: () => ({ data: [] }),
}));

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    createdById: 'u1',
    title: 'Task title',
    description: 'Desc',
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

describe('TaskDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation error when agent context JSON is invalid', async () => {
    render(
      <TaskDetail task={buildTask()} isOpen onClose={vi.fn()} />,
    );

    const ctx = screen.getByText('Agent context (JSON)').parentElement!.querySelector(
      'textarea',
    ) as HTMLTextAreaElement;
    fireEvent.change(ctx, { target: { value: '{not json' } });

    await userEvent.click(screen.getByRole('button', { name: /save agent settings/i }));

    expect(screen.getByText(/not valid json/i)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('calls updateTask with agent fields when JSON is valid', async () => {
    render(
      <TaskDetail
        task={buildTask({
          agentContext: { key: 'v' },
          agentOutput: { out: 1 },
          phase: 2,
          parallelGroup: 'g1',
        })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /save agent settings/i }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 't1',
        actorTier: expect.any(String),
        domain: expect.any(String),
        complexity: expect.any(String),
        reviewGate: expect.any(String),
        phase: 2,
        parallelGroup: 'g1',
        agentContext: { key: 'v' },
        agentOutput: { out: 1 },
      }),
    );
  });

  it('calls updateTask when priority changes', async () => {
    render(
      <TaskDetail task={buildTask({ priority: 'LOW' })} isOpen onClose={vi.fn()} />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/priority/i), 'HIGH');

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't1', priority: 'HIGH' }),
    );
  });

  it('shows subtasks tree and add control for project tasks', async () => {
    const child = buildTask({ id: 'st1', title: 'Child subtask', projectId: 'p1' });
    render(
      <TaskDetail
        task={buildTask({
          projectId: 'p1',
          subtasks: [child],
        })}
        isOpen
        onClose={vi.fn()}
        workspaceIds={['ws-1']}
      />,
    );

    expect(screen.getByRole('heading', { name: /subtasks/i })).toBeInTheDocument();
    expect(screen.getByText('Child subtask')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/new subtask title/i)).toBeInTheDocument();
  });

  it('shows dependencies and activity sections when data present', () => {
    render(
      <TaskDetail
        task={buildTask({
          projectId: 'p1',
          waitingOn: [
            {
              id: 'd1',
              dependentId: 't1',
              blockingId: 't2',
              type: 'WAITING_ON',
              createdAt: new Date().toISOString(),
              blockingTask: { id: 't2', title: 'Blocker', status: 'BACKLOG', projectId: 'p1' },
            },
          ],
          activityLogs: [
            {
              id: 'l1',
              actorId: 'u1',
              eventType: 'TASK_UPDATED',
              description: 'Custom field updated',
              createdAt: new Date().toISOString(),
              actor: { id: 'u1', email: 'a@b.com', displayName: 'Alex' },
            },
          ],
        })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /^dependencies$/i })).toBeInTheDocument();
    expect(screen.getByText('Blocker')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /activity/i })).toBeInTheDocument();
    expect(screen.getByText('Custom field updated')).toBeInTheDocument();
  });
});
