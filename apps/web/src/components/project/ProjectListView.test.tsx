import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ProjectListView } from './ProjectListView';
import type { Section } from '../../types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCreateTask = vi.fn();
vi.mock('../../hooks/useTasks', () => ({
  useCreateTask: () => ({ mutateAsync: mockCreateTask, isPending: false }),
  useUpdateTask: () => ({ mutate: vi.fn() }),
  useReorderTasks: () => ({ mutate: vi.fn(), isPending: false }),
}));

const mockCreateSection = vi.fn();
vi.mock('../../hooks/useSections', () => ({
  useCreateSection: () => ({ mutateAsync: mockCreateSection, isPending: false }),
}));

// Stub UI sub-components to keep tests focused
vi.mock('../task/TaskRow', () => ({
  TaskRow: ({ task }: { task: { title: string } }) => <div data-testid="task-row">{task.title}</div>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const sampleSection: Section = {
  id: 'sec1',
  projectId: 'p1',
  name: 'Backlog',
  sortOrder: 0,
  tasks: [
    {
      id: 't1',
      projectId: 'p1',
      sectionId: 'sec1',
      createdById: 'u1',
      title: 'Existing Task',
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
    },
  ],
};

function renderList(sections: Section[] = [sampleSection], onSelectTask = vi.fn()) {
  const client = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <ProjectListView sections={sections} projectId="p1" onSelectTask={onSelectTask} />,
    { wrapper: Wrapper },
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  it('renders section headers', () => {
    renderList();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
  });

  it('renders existing tasks inside expanded sections', () => {
    renderList();
    expect(screen.getByText('Existing Task')).toBeInTheDocument();
  });

  it('collapses section when header is clicked', async () => {
    renderList();
    expect(screen.getByText('Existing Task')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Backlog'));

    expect(screen.queryByText('Existing Task')).not.toBeInTheDocument();
  });

  // ── Task creation ──

  it('shows "Add task" button inside each section', () => {
    renderList();
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('opens inline task input when "Add task" is clicked', async () => {
    renderList();
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    expect(screen.getByPlaceholderText(/task name/i)).toBeInTheDocument();
  });

  it('calls createTask with correct args when task name submitted via Enter', async () => {
    mockCreateTask.mockResolvedValue({ id: 'new-t' });
    renderList();

    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    const input = screen.getByPlaceholderText(/task name/i);
    await userEvent.type(input, 'Fix the bug{Enter}');

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Fix the bug', projectId: 'p1', sectionId: 'sec1' }),
      );
    });
  });

  it('calls createTask when Save button clicked', async () => {
    mockCreateTask.mockResolvedValue({ id: 'new-t2' });
    renderList();

    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    await userEvent.type(screen.getByPlaceholderText(/task name/i), 'Another task');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Another task' }),
      );
    });
  });

  it('does not call createTask for empty input', async () => {
    renderList();
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    // Escape to dismiss without value
    fireEvent.keyDown(screen.getByPlaceholderText(/task name/i), { key: 'Escape' });
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  // ── Section creation ──

  it('shows "Add section" button at the bottom', () => {
    renderList();
    expect(screen.getByText(/add section/i)).toBeInTheDocument();
  });

  it('opens inline section input when "Add section" is clicked', async () => {
    renderList();
    await userEvent.click(screen.getByText(/add section/i));
    expect(screen.getByPlaceholderText(/section name/i)).toBeInTheDocument();
  });

  it('calls createSection with correct args when submitted via Enter', async () => {
    mockCreateSection.mockResolvedValue({ id: 'new-sec' });
    renderList();

    await userEvent.click(screen.getByText(/add section/i));
    await userEvent.type(screen.getByPlaceholderText(/section name/i), 'In Progress{Enter}');

    await waitFor(() => {
      expect(mockCreateSection).toHaveBeenCalledWith({ projectId: 'p1', name: 'In Progress' });
    });
  });

  it('calls createSection when Save button clicked', async () => {
    mockCreateSection.mockResolvedValue({ id: 'new-sec2' });
    renderList();

    await userEvent.click(screen.getByText(/add section/i));
    await userEvent.type(screen.getByPlaceholderText(/section name/i), 'Done');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(mockCreateSection).toHaveBeenCalledWith({ projectId: 'p1', name: 'Done' });
    });
  });

  it('closes section input on Cancel', async () => {
    renderList();
    await userEvent.click(screen.getByText(/add section/i));
    expect(screen.getByPlaceholderText(/section name/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/section name/i)).not.toBeInTheDocument();
  });

  it('closes section input on Escape', async () => {
    renderList();
    await userEvent.click(screen.getByText(/add section/i));
    fireEvent.keyDown(screen.getByPlaceholderText(/section name/i), { key: 'Escape' });
    expect(screen.queryByPlaceholderText(/section name/i)).not.toBeInTheDocument();
  });
});
