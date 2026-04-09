import type { ReactElement } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProjectTimephasedView } from './ProjectTimephasedView';
import { api } from '../../lib/api';

function renderTimephased(
  ui: ReactElement,
  opts?: { initialEntries?: string[] },
) {
  return render(
    <MemoryRouter initialEntries={opts?.initialEntries ?? ['/timephased']}>
      {ui}
    </MemoryRouter>,
  );
}

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn() },
}));

describe('ProjectTimephasedView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches week granularity by default and renders cells', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        projectId: 'p1',
        granularity: 'week',
        basis: 'calendar',
        cells: [
          {
            taskId: 't1',
            taskTitle: 'Build',
            periodStart: '2026-01-05T00:00:00.000Z',
            periodEnd: '2026-01-11T23:59:59.999Z',
            workMinutes: 120,
            cost: 50.25,
          },
        ],
        resourceCells: [
          {
            resourceKey: 'unassigned',
            resourceLabel: 'Unassigned',
            periodStart: '2026-01-05T00:00:00.000Z',
            periodEnd: '2026-01-11T23:59:59.999Z',
            workMinutes: 120,
            cost: 50.25,
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderTimephased(<ProjectTimephasedView projectId="p1" workspaceId="ws1" />);

    await waitFor(() => {
      expect(screen.getByText('Build')).toBeInTheDocument();
    });

    expect(api.get).toHaveBeenCalledWith('/workspaces/ws1/projects/p1/schedule/timephased', {
      params: { granularity: 'week', basis: 'calendar' },
    });
    await user.selectOptions(screen.getByLabelText(/Grid layout/i), 'list');
    await waitFor(() => {
      expect(screen.getByText('50.25')).toBeInTheDocument();
    });
  });

  it('switches to day granularity when toggled', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        projectId: 'p1',
        granularity: 'week',
        basis: 'calendar',
        cells: [],
        resourceCells: [],
      },
    });

    const user = userEvent.setup();
    renderTimephased(<ProjectTimephasedView projectId="p1" workspaceId="ws1" />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    vi.mocked(api.get).mockClear();
    vi.mocked(api.get).mockResolvedValue({
      data: {
        projectId: 'p1',
        granularity: 'day',
        basis: 'calendar',
        cells: [],
        resourceCells: [],
      },
    });

    await user.click(screen.getByRole('button', { name: /^day$/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/workspaces/ws1/projects/p1/schedule/timephased', {
        params: { granularity: 'day', basis: 'calendar' },
      });
    });
  });

  it('shows empty hint when there are no cells', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        projectId: 'p1',
        granularity: 'week',
        basis: 'calendar',
        cells: [],
        resourceCells: [],
      },
    });

    renderTimephased(<ProjectTimephasedView projectId="p1" workspaceId="ws1" />);

    await waitFor(() => {
      expect(
        screen.getByText(/No dated tasks with work or cost to distribute/i),
      ).toBeInTheDocument();
    });
  });

  it('requests working basis when Working toggle selected', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        projectId: 'p1',
        granularity: 'week',
        basis: 'calendar',
        cells: [],
        resourceCells: [],
      },
    });

    const user = userEvent.setup();
    renderTimephased(<ProjectTimephasedView projectId="p1" workspaceId="ws1" />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    vi.mocked(api.get).mockClear();
    vi.mocked(api.get).mockResolvedValue({
      data: {
        projectId: 'p1',
        granularity: 'week',
        basis: 'working',
        cells: [],
        resourceCells: [],
      },
    });

    await user.click(screen.getByRole('button', { name: /^working$/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/workspaces/ws1/projects/p1/schedule/timephased', {
        params: { granularity: 'week', basis: 'working' },
      });
    });
  });

  it('reads granularity from URL search params on first fetch', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        projectId: 'p1',
        granularity: 'day',
        basis: 'calendar',
        cells: [],
        resourceCells: [],
      },
    });

    renderTimephased(<ProjectTimephasedView projectId="p1" workspaceId="ws1" />, {
      initialEntries: ['/timephased?granularity=day'],
    });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/workspaces/ws1/projects/p1/schedule/timephased', {
        params: { granularity: 'day', basis: 'calendar' },
      });
    });
  });

  it('shows error when API fails', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('fail'));

    renderTimephased(<ProjectTimephasedView projectId="p1" workspaceId="ws1" />);

    await waitFor(() => {
      expect(screen.getByText(/Could not load timephased data/i)).toBeInTheDocument();
    });
  });
});
