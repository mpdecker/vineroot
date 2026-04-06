import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import type { Task } from '../../types';

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    createdById: 'u1',
    title: 'Card task',
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

describe('TaskCard', () => {
  it('renders work item type chip when not TASK', () => {
    render(
      <TaskCard
        task={buildTask({ workItemType: 'STORY' })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('STORY')).toBeInTheDocument();
  });

  it('does not render work item chip for default TASK type', () => {
    render(
      <TaskCard task={buildTask({ workItemType: 'TASK' })} onSelect={vi.fn()} />,
    );
    expect(screen.queryByText('TASK')).not.toBeInTheDocument();
  });

  it('renders story points when set', () => {
    render(
      <TaskCard task={buildTask({ storyPoints: 8 })} onSelect={vi.fn()} />,
    );
    expect(screen.getByText('8 pt')).toBeInTheDocument();
  });

  it('does not render story points chip when null', () => {
    render(
      <TaskCard task={buildTask({ storyPoints: null })} onSelect={vi.fn()} />,
    );
    expect(screen.queryByText(/pt/)).not.toBeInTheDocument();
  });

  it('renders sprint name when sprint is present', () => {
    render(
      <TaskCard
        task={buildTask({ sprint: { id: 'sp1', name: 'Sprint 42' } })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Sprint 42')).toBeInTheDocument();
  });
});
