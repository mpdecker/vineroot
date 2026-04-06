import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { ProjectBoardView } from './ProjectBoardView';
import type { Section, Task } from '../../types';

const createSection = vi.fn();
const updateSection = vi.fn();

vi.mock('../../hooks/useSections', () => ({
  useCreateSection: () => ({
    mutateAsync: createSection,
    isPending: false,
  }),
  useUpdateSection: () => ({
    mutateAsync: updateSection,
    isPending: false,
  }),
}));

vi.mock('../task/TaskCreate', () => ({
  TaskCreate: ({ sectionId }: { sectionId?: string }) => (
    <div data-testid={`task-create-${sectionId ?? 'none'}`}>TaskCreate</div>
  ),
}));

vi.mock('../task/TaskCard', () => ({
  TaskCard: ({ task }: { task: { id: string; title: string } }) => (
    <div>{task.title}</div>
  ),
}));

function minimalTask(id: string, title: string): Task {
  return {
    id,
    createdById: 'u1',
    title,
    status: 'BACKLOG',
    priority: 'NONE',
    sortOrder: 0,
    actorTier: 'UNASSIGNED',
    domain: 'GENERAL',
    complexity: 'LOW',
    reviewGate: 'NONE',
    retryCount: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function section(
  id: string,
  name: string,
  sortOrder: number,
  tasks: Task[] = [],
): Section {
  return {
    id,
    projectId: 'p1',
    name,
    sortOrder,
    tasks,
  };
}

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ProjectBoardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSection.mockResolvedValue({});
    updateSection.mockResolvedValue({});
  });

  it('sorts sections by sortOrder', () => {
    const sections = [
      section('s2', 'Second', 1, [minimalTask('t1', 'A')]),
      section('s1', 'First', 0, []),
    ];
    renderWithQuery(
      <ProjectBoardView
        sections={sections}
        projectId="p1"
        onSelectTask={vi.fn()}
      />,
    );

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('First');
    expect(headings[1]).toHaveTextContent('Second');
  });

  it('creates a section when Add section flow completes', async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <ProjectBoardView sections={[]} projectId="p1" onSelectTask={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /add section/i }));
    await user.type(screen.getByPlaceholderText(/section name/i), 'Icebox');
    await user.click(screen.getByRole('button', { name: /^add$/i }));

    expect(createSection).toHaveBeenCalledWith({ projectId: 'p1', name: 'Icebox' });
  });
});
