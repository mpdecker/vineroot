import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { Task } from '../../types';
import type { TaskScheduleInsight } from '../../lib/taskScheduleInsight';
import { ProjectTaskNestedBoard, ProjectTaskNestedList } from './ProjectTaskNestedViews';

vi.mock('../task/ListSortableTaskRow', () => ({
  ListSortableTaskRow: ({
    task,
    leading,
    scheduleInsight,
  }: {
    task: Task;
    leading?: ReactNode;
    scheduleInsight?: TaskScheduleInsight;
  }) => (
    <div data-testid={`row-${task.id}`}>
      {leading}
      <span>{task.title}</span>
      {scheduleInsight?.onCriticalPath ? <span data-testid={`insight-cp-${task.id}`}>CP</span> : null}
      {scheduleInsight?.slackLabel ? (
        <span data-testid={`insight-slack-${task.id}`}>{scheduleInsight.slackLabel}</span>
      ) : null}
    </div>
  ),
}));

vi.mock('./BoardSortableTaskCard', () => ({
  BoardSortableTaskCard: ({ task, leading }: { task: Task; leading?: ReactNode }) => (
    <div data-testid={`card-${task.id}`}>
      {leading}
      <span>{task.title}</span>
    </div>
  ),
}));

function baseTask(id: string, title: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    createdById: 'u1',
    title,
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder: 0,
    sectionId: 'sec1',
    actorTier: 'HUMAN',
    domain: 'GENERAL',
    complexity: 'LOW',
    reviewGate: 'NONE',
    retryCount: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

describe('ProjectTaskNestedList', () => {
  it('renders nested subtasks when expanded', async () => {
    const user = userEvent.setup();
    const child = baseTask('c1', 'Sub one', { parentTaskId: 'r1', sortOrder: 0 });
    const root = baseTask('r1', 'Root task', {
      sortOrder: 0,
      subtasks: [child],
    });

    render(
      <ProjectTaskNestedList
        sectionId="sec1"
        roots={[root]}
        onSelectTask={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Root task')).toBeInTheDocument();
    expect(screen.getByText('Sub one')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse subtasks/i }));
    expect(screen.queryByText('Sub one')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand subtasks/i }));
    expect(screen.getByText('Sub one')).toBeInTheDocument();
  });

  it('passes getScheduleInsight to root and nested rows', () => {
    const child = baseTask('c1', 'Sub one', { parentTaskId: 'r1', sortOrder: 0 });
    const root = baseTask('r1', 'Root task', {
      sortOrder: 0,
      subtasks: [child],
    });

    render(
      <ProjectTaskNestedList
        sectionId="sec1"
        roots={[root]}
        onSelectTask={vi.fn()}
        onStatusChange={vi.fn()}
        getScheduleInsight={(t) =>
          t.id === 'r1'
            ? { onCriticalPath: true, slackLabel: null, deadlineBreached: false }
            : t.id === 'c1'
              ? { onCriticalPath: false, slackLabel: '1d slack', deadlineBreached: false }
              : undefined
        }
      />,
    );

    expect(screen.getByTestId('insight-cp-r1')).toBeInTheDocument();
    expect(screen.getByTestId('insight-slack-c1')).toHaveTextContent('1d slack');
  });
});

describe('ProjectTaskNestedBoard', () => {
  it('renders nested subtasks when expanded', async () => {
    const user = userEvent.setup();
    const child = baseTask('c1', 'Card sub', { parentTaskId: 'r1', sortOrder: 0 });
    const root = baseTask('r1', 'Root card', {
      sortOrder: 0,
      subtasks: [child],
    });

    render(
      <ProjectTaskNestedBoard sectionId="sec1" roots={[root]} onSelectTask={vi.fn()} />,
    );

    expect(screen.getByText('Root card')).toBeInTheDocument();
    expect(screen.getByText('Card sub')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /collapse subtasks/i }));
    expect(screen.queryByText('Card sub')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expand subtasks/i }));
    expect(screen.getByText('Card sub')).toBeInTheDocument();
  });
});
