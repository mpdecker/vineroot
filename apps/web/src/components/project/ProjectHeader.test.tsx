import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectHeader } from './ProjectHeader';
import type { Project, Sprint } from '../../types';

vi.mock('../../hooks/useProjects', () => ({
  useDuplicateProject: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('./ProjectEditModal', () => ({
  ProjectEditModal: () => null,
}));

const project: Project = {
  id: 'p-header',
  workspaceIds: ['ws-a'],
  name: 'Header Project',
  color: 'BLUE',
  status: 'ACTIVE',
  isPrivate: false,
  isArchived: false,
  defaultView: 'list',
};

const sprints: Sprint[] = [
  {
    id: 'sp-a',
    projectId: 'p-header',
    name: 'Sprint A',
    startDate: '2024-06-01T00:00:00.000Z',
    endDate: '2024-06-14T00:00:00.000Z',
    state: 'ACTIVE',
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

function renderHeader(
  currentView: string,
  opts: {
    sprintFilter?: 'all' | 'backlog' | string;
    onSprintFilterChange?: (v: 'all' | 'backlog' | string) => void;
    epicTasks?: { id: string; title: string }[];
    epicFilter?: 'all' | string;
    onEpicFilterChange?: (v: 'all' | string) => void;
  } = {},
) {
  const onSprint = opts.onSprintFilterChange ?? vi.fn();
  const epicTasks = opts.epicTasks ?? [];
  const onEpicCb = opts.onEpicFilterChange ?? vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/projects/p-header/${currentView}`]}>
        <ProjectHeader
          project={project}
          currentView={currentView}
          sprintFilter={opts.sprintFilter ?? 'all'}
          onSprintFilterChange={onSprint}
          sprints={sprints}
          epicTasks={epicTasks}
          epicFilter={opts.epicFilter ?? 'all'}
          onEpicFilterChange={epicTasks.length ? onEpicCb : undefined}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onSprintFilterChange: onSprint, onEpicFilterChange: onEpicCb };
}

describe('ProjectHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes Burndown in view tabs', () => {
    renderHeader('list');
    const link = screen.getByRole('link', { name: /^burndown$/i });
    expect(link).toHaveAttribute('href', '/projects/p-header/burndown');
  });

  it('includes Flow in view tabs', () => {
    renderHeader('list');
    const link = screen.getByRole('link', { name: /^flow$/i });
    expect(link).toHaveAttribute('href', '/projects/p-header/flow');
  });

  it('shows sprint filter on list and notifies parent on change', async () => {
    const user = userEvent.setup();
    const { onSprintFilterChange } = renderHeader('list');

    const sprintSelect = screen.getByRole('combobox', { name: /sprint/i });
    expect(sprintSelect).toBeInTheDocument();

    await user.selectOptions(sprintSelect, 'backlog');
    expect(onSprintFilterChange).toHaveBeenCalledWith('backlog');

    await user.selectOptions(sprintSelect, 'sp-a');
    expect(onSprintFilterChange).toHaveBeenCalledWith('sp-a');
  });

  it('hides sprint filter on activity view', () => {
    renderHeader('activity');
    expect(screen.queryByRole('combobox', { name: /sprint/i })).not.toBeInTheDocument();
  });

  it('lists sprint names in filter dropdown', () => {
    renderHeader('board');
    expect(screen.getByRole('option', { name: 'Sprint A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All work' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Backlog' })).toBeInTheDocument();
  });

  it('shows epic filter when epic tasks exist and reports changes', async () => {
    const user = userEvent.setup();
    const onEpic = vi.fn();
    renderHeader('list', {
      epicTasks: [{ id: 'ep-1', title: 'Platform epic' }],
      onEpicFilterChange: onEpic,
    });

    const epicSelect = screen.getByRole('combobox', { name: /epic/i });
    expect(screen.getByRole('option', { name: 'Platform epic' })).toBeInTheDocument();

    await user.selectOptions(epicSelect, 'ep-1');
    expect(onEpic).toHaveBeenCalledWith('ep-1');
  });
});
