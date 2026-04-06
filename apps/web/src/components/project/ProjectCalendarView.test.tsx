import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectCalendarView } from './ProjectCalendarView';
import { useUIStore } from '../../stores/ui.store';
import type { Section, Task } from '../../types';

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-cal',
    createdById: 'u1',
    title: 'Calendar task',
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

/** Anchor to “today” so the task appears in the default month view. */
const due = new Date();
due.setHours(12, 0, 0, 0);

const sections: Section[] = [
  {
    id: 's1',
    projectId: 'p1',
    name: 'Section',
    sortOrder: 0,
    tasks: [buildTask({ title: 'Due item', dueDate: due.toISOString() })],
  },
];

describe('ProjectCalendarView', () => {
  beforeEach(() => {
    useUIStore.setState({ openTask: vi.fn() });
  });

  it('renders weekday headers and navigates months', async () => {
    render(<ProjectCalendarView sections={sections} />);

    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Due item')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next month/i }));
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('calls openTask with task id when a day task chip is clicked', async () => {
    const openTask = vi.fn();
    useUIStore.setState({ openTask });

    render(<ProjectCalendarView sections={sections} />);

    await userEvent.click(screen.getByRole('button', { name: 'Due item' }));
    expect(openTask).toHaveBeenCalledWith('t-cal');
  });
});
