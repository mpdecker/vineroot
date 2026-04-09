import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskRow } from './TaskRow';
import type { Task } from '../../types';

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    createdById: 'u1',
    title: 'Write tests',
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

describe('TaskRow', () => {
  it('renders title and toggles status via checkbox control', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onStatusChange = vi.fn();

    const { rerender } = render(
      <TaskRow
        task={buildTask()}
        onSelect={onSelect}
        onStatusChange={onStatusChange}
      />,
    );

    expect(screen.getByText('Write tests')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);

    expect(onStatusChange).toHaveBeenCalledWith('t1', 'DONE');

    rerender(
      <TaskRow
        task={buildTask({ status: 'DONE' })}
        onSelect={onSelect}
        onStatusChange={onStatusChange}
      />,
    );

    await user.click(screen.getAllByRole('button')[0]);
    expect(onStatusChange).toHaveBeenCalledWith('t1', 'BACKLOG');
  });

  it('opens task detail when title is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onStatusChange = vi.fn();

    render(
      <TaskRow task={buildTask()} onSelect={onSelect} onStatusChange={onStatusChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Write tests' }));
    expect(onSelect).toHaveBeenCalledWith('t1');
  });

  it('shows abbreviated work item type chip when not TASK', () => {
    render(
      <TaskRow
        task={buildTask({ workItemType: 'STORY' })}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText('STO')).toBeInTheDocument();
  });

  it('shows story points chip when set', () => {
    render(
      <TaskRow
        task={buildTask({ storyPoints: 5 })}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText('5 pt')).toBeInTheDocument();
  });

  it('shows sprint name when sprint is present', () => {
    render(
      <TaskRow
        task={buildTask({ sprint: { id: 'sp1', name: 'Alpha sprint' } })}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Alpha sprint')).toBeInTheDocument();
  });

  it('renders schedule insight chips when provided', () => {
    render(
      <TaskRow
        task={buildTask()}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
        scheduleInsight={{
          onCriticalPath: true,
          slackLabel: '2w slack',
          deadlineBreached: true,
        }}
      />,
    );
    expect(screen.getByText('CP')).toBeInTheDocument();
    expect(screen.getByText('2w slack')).toBeInTheDocument();
    expect(screen.getByText('Deadline')).toBeInTheDocument();
  });

  it('omits schedule chips when scheduleInsight is absent', () => {
    render(<TaskRow task={buildTask()} onSelect={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.queryByText('CP')).not.toBeInTheDocument();
  });
});
