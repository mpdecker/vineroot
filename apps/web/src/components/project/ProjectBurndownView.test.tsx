import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectBurndownView } from './ProjectBurndownView';
import type { Sprint } from '../../types';

vi.mock('../../hooks/useProjects', () => ({
  useSprintBurndown: vi.fn(),
  useSprintBurnup: vi.fn(),
  useProjectSprintVelocity: vi.fn(),
}));

import {
  useSprintBurndown,
  useSprintBurnup,
  useProjectSprintVelocity,
} from '../../hooks/useProjects';

const mockedBurndown = vi.mocked(useSprintBurndown);
const mockedBurnup = vi.mocked(useSprintBurnup);
const mockedVelocity = vi.mocked(useProjectSprintVelocity);

function sprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 'sp-1',
    projectId: 'p1',
    name: 'Sprint One',
    startDate: '2024-06-01T00:00:00.000Z',
    endDate: '2024-06-14T00:00:00.000Z',
    state: 'ACTIVE',
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectBurndownView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prompts to create a sprint when none exist', () => {
    mockedBurndown.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useSprintBurndown>);
    mockedBurnup.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useSprintBurnup>);
    mockedVelocity.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProjectSprintVelocity>);

    render(<ProjectBurndownView projectId="p1" sprints={[]} />);

    expect(
      screen.getByText(/Create a sprint from any task’s/i),
    ).toBeInTheDocument();
  });

  it('renders sprint selector and burndown chart when data loads', async () => {
    const user = userEvent.setup();
    mockedBurndown.mockReturnValue({
      data: {
        sprintId: 'sp-1',
        projectId: 'p1',
        totalScope: 6,
        days: [
          { date: '2024-06-01', remaining: 6, ideal: 6 },
          { date: '2024-06-02', remaining: 3, ideal: 0 },
        ],
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useSprintBurndown>);
    mockedBurnup.mockReturnValue({
      data: {
        sprintId: 'sp-1',
        projectId: 'p1',
        totalScope: 6,
        initialScope: 6,
        scopeChanges: [],
        days: [
          { date: '2024-06-01', completedCumulative: 0, scopeTotal: 6 },
          { date: '2024-06-02', completedCumulative: 3, scopeTotal: 6 },
        ],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useSprintBurnup>);
    mockedVelocity.mockReturnValue({
      data: {
        projectId: 'p1',
        sprints: [
          {
            sprintId: 'sp-1',
            name: 'Sprint One',
            startDate: '2024-06-01',
            endDate: '2024-06-14',
            state: 'ACTIVE',
            completedPoints: 4,
            completedTaskCount: 2,
          },
        ],
        averageCompletedPoints: 4,
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProjectSprintVelocity>);

    render(
      <ProjectBurndownView
        projectId="p1"
        sprints={[
          sprint(),
          sprint({
            id: 'sp-earlier',
            name: 'Earlier',
            startDate: '2024-05-01T00:00:00.000Z',
            endDate: '2024-05-14T00:00:00.000Z',
            sortOrder: 1,
          }),
        ]}
      />,
    );

    const combo = screen.getByRole('combobox', { name: /sprint/i });
    expect(combo).toBeInTheDocument();
    const scopeLine = screen.getByText(/non-cancelled tasks in sprint/i);
    expect(scopeLine.textContent).toMatch(/6/);

    const chart = screen.getByRole('img', { name: /burndown chart/i });
    expect(chart).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /^burnup$/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /burnup chart/i })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /^velocity$/i })).toBeInTheDocument();
    expect(screen.getByText(/pts\/sprint/i).textContent).toMatch(/4/);

    const velChart = screen.getByRole('img', { name: /velocity chart/i });
    expect(within(velChart).getByText('Sprint One')).toBeInTheDocument();

    await user.selectOptions(combo, 'sp-earlier');
    expect(mockedBurndown).toHaveBeenLastCalledWith('p1', 'sp-earlier');
  });

  it('shows loading and error states for burndown', () => {
    mockedBurndown.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useSprintBurndown>);
    mockedBurnup.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useSprintBurnup>);
    mockedVelocity.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProjectSprintVelocity>);

    render(<ProjectBurndownView projectId="p1" sprints={[sprint()]} />);
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('shows burndown error message when query fails', () => {
    mockedBurndown.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useSprintBurndown>);
    mockedBurnup.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useSprintBurnup>);
    mockedVelocity.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProjectSprintVelocity>);

    render(<ProjectBurndownView projectId="p1" sprints={[sprint()]} />);
    expect(screen.getByText(/Could not load burndown/i)).toBeInTheDocument();
  });
});
