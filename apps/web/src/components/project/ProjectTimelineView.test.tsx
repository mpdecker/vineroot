import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Section, Task } from '../../types';

vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('../../lib/scheduleExcelExport', () => ({
  buildScheduleExcelWorkbook: vi.fn(() => ({
    SheetNames: ['About', 'Tasks', 'Dependencies', 'Baselines'],
  })),
  downloadScheduleExcelWorkbook: vi.fn(),
}));

import { ProjectTimelineView } from './ProjectTimelineView';
import { useUIStore } from '../../stores/ui.store';
import { api } from '../../lib/api';
import {
  buildScheduleExcelWorkbook,
  downloadScheduleExcelWorkbook,
} from '../../lib/scheduleExcelExport';

function defaultApiGetImpl(url: string) {
  if (url.includes('/baselines/compare')) return Promise.resolve({ data: [] });
  if (url.includes('critical-path')) {
    return Promise.resolve({
      data: {
        projectId: 'p1',
        criticalTaskIds: [],
        tasks: [],
        drivingEdges: [],
      },
    });
  }
  if (url.includes('/baselines/summary')) {
    return Promise.resolve({
      data: {
        projectId: 'p1',
        baselineIndex: 0,
        projectTaskCount: 0,
        tasksWithBaselineCount: 0,
        finishLateCount: 0,
        finishEarlyCount: 0,
        finishOnTimeCount: 0,
        avgFinishVarianceDays: null,
        sumFinishVarianceDays: null,
        avgFinishVarianceWorkingDays: null,
        sumFinishVarianceWorkingDays: null,
        sumWorkVarianceMinutes: null,
        sumCostVariance: null,
        maxFinishSlipDays: null,
        maxFinishSlipWorkingDays: null,
        latestBaselineSavedAt: null,
      },
    });
  }
  if (
    url.includes('/schedule/baselines') &&
    !url.includes('compare') &&
    !url.includes('summary')
  ) {
    return Promise.resolve({ data: [] });
  }
  return Promise.resolve({ data: [] });
}

const sections: Section[] = [
  {
    id: 's1',
    projectId: 'p1',
    name: 'Todo',
    sortOrder: 0,
    tasks: [],
  },
];

describe('ProjectTimelineView', () => {
  beforeEach(() => {
    useUIStore.setState({ openTask: vi.fn() });
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    vi.mocked(api.get).mockImplementation(defaultApiGetImpl);
    vi.mocked(buildScheduleExcelWorkbook).mockClear();
    vi.mocked(downloadScheduleExcelWorkbook).mockClear();
  });

  it('renders WBS toggle', () => {
    render(<ProjectTimelineView sections={sections} projectId="p1" />);
    expect(screen.getByRole('button', { name: /^WBS$/ })).toBeInTheDocument();
  });

  it('persists WBS mode in sessionStorage when toggled', async () => {
    const user = userEvent.setup();
    render(<ProjectTimelineView sections={sections} projectId="p1" />);

    await user.click(screen.getByRole('button', { name: /^WBS$/ }));

    expect(sessionStorage.getItem('vineroot:project:p1:timelineWbs')).toBe('1');
  });

  it('loads baselines when Baseline is toggled with workspaceId', async () => {
    vi.mocked(api.get).mockClear();
    const user = userEvent.setup();
    render(<ProjectTimelineView sections={sections} projectId="p1" workspaceId="ws1" />);

    await user.click(screen.getByRole('button', { name: /^Baseline$/ }));

    expect(sessionStorage.getItem('vineroot:project:p1:timelineBaseline')).toBe('1');
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/workspaces/ws1/projects/p1/schedule/baselines/compare',
        expect.objectContaining({ params: { index: 0 } }),
      );
      expect(api.get).toHaveBeenCalledWith(
        '/workspaces/ws1/projects/p1/schedule/baselines/summary',
        expect.objectContaining({ params: { index: 0 } }),
      );
    });
  });

  it('requests critical path when row filter is set to critical path', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('baselines/compare')) return Promise.resolve({ data: [] });
      if (url.includes('baselines/summary')) {
        return Promise.resolve({
          data: {
            projectId: 'p1',
            baselineIndex: 0,
            projectTaskCount: 0,
            tasksWithBaselineCount: 0,
            finishLateCount: 0,
            finishEarlyCount: 0,
            finishOnTimeCount: 0,
            avgFinishVarianceDays: null,
            sumFinishVarianceDays: null,
            avgFinishVarianceWorkingDays: null,
            sumFinishVarianceWorkingDays: null,
            sumWorkVarianceMinutes: null,
            sumCostVariance: null,
            maxFinishSlipDays: null,
            maxFinishSlipWorkingDays: null,
            latestBaselineSavedAt: null,
          },
        });
      }
      if (url.includes('critical-path')) {
        return Promise.resolve({
          data: {
            projectId: 'p1',
            criticalTaskIds: ['ta'],
            tasks: [],
            drivingEdges: [],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    const task: Task = {
      id: 'ta',
      title: 'On CP',
      status: 'BACKLOG',
      priority: 'NONE',
      startDate: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-01-05T00:00:00.000Z',
      sortOrder: 0,
      actorTier: 'HUMAN',
      domain: 'GENERAL',
      complexity: 'LOW',
      reviewGate: 'NONE',
      retryCount: 0,
      isArchived: false,
      createdById: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const secs: Section[] = [{ ...sections[0], tasks: [task] }];

    render(<ProjectTimelineView sections={secs} projectId="p1" workspaceId="ws1" />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/workspaces/ws1/projects/p1/schedule/critical-path',
      );
    });

    await user.selectOptions(
      screen.getByLabelText(/Schedule row filter/i),
      'on_critical_path',
    );
  });

  it('Print / PDF invokes window.print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ProjectTimelineView sections={sections} projectId="p1" />);
    await user.click(screen.getByRole('button', { name: /Print \/ PDF/i }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('exposes print root and project name for print snapshot header', () => {
    render(
      <ProjectTimelineView
        sections={sections}
        projectId="p1"
        projectName="Phoenix rollout"
      />,
    );
    const root = screen.getByTestId('schedule-print-root');
    expect(root).toHaveAttribute('id', 'vineroot-schedule-print-root');
    expect(root).toHaveTextContent('Phoenix rollout');
  });

  it('Export Excel loads baselines in workspace context and downloads workbook', async () => {
    const user = userEvent.setup();
    const baselineRow = {
      taskId: 'ta',
      baselineIndex: 0,
      baselineStart: '2026-01-01T00:00:00.000Z',
      baselineFinish: '2026-01-02T00:00:00.000Z',
      baselineWorkMinutes: 60,
      baselineCost: 10,
      savedAt: '2026-01-03T00:00:00.000Z',
    };
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (
        url.includes('/schedule/baselines') &&
        !url.includes('compare') &&
        !url.includes('summary')
      ) {
        return Promise.resolve({ data: [baselineRow] });
      }
      return defaultApiGetImpl(url);
    });

    const task: Task = {
      id: 'ta',
      title: 'Task A',
      status: 'BACKLOG',
      priority: 'NONE',
      sortOrder: 0,
      actorTier: 'HUMAN',
      domain: 'GENERAL',
      complexity: 'LOW',
      reviewGate: 'NONE',
      retryCount: 0,
      isArchived: false,
      createdById: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const secs: Section[] = [{ ...sections[0], tasks: [task] }];

    render(
      <ProjectTimelineView
        sections={secs}
        projectId="p1"
        workspaceId="ws1"
        projectName="Excel project"
      />,
    );

    await user.click(screen.getByRole('button', { name: /^Export Excel$/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/workspaces/ws1/projects/p1/schedule/baselines',
      );
      expect(buildScheduleExcelWorkbook).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p1',
          projectName: 'Excel project',
          wbs: true,
          baselineRows: [baselineRow],
          sections: secs,
        }),
      );
      expect(downloadScheduleExcelWorkbook).toHaveBeenCalledWith(
        expect.objectContaining({ SheetNames: expect.any(Array) }),
        'schedule-template-p1.xlsx',
      );
    });
  });

  it('Export Excel without workspace skips baselines request and passes empty baselineRows', async () => {
    const user = userEvent.setup();
    const task: Task = {
      id: 'ta',
      title: 'Solo',
      status: 'BACKLOG',
      priority: 'NONE',
      sortOrder: 0,
      actorTier: 'HUMAN',
      domain: 'GENERAL',
      complexity: 'LOW',
      reviewGate: 'NONE',
      retryCount: 0,
      isArchived: false,
      createdById: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const secs: Section[] = [{ ...sections[0], tasks: [task] }];
    vi.mocked(api.get).mockClear();

    render(<ProjectTimelineView sections={secs} projectId="p1" />);

    await user.click(screen.getByRole('button', { name: /^Export Excel$/i }));

    await waitFor(() => {
      expect(downloadScheduleExcelWorkbook).toHaveBeenCalled();
    });
    expect(api.get).not.toHaveBeenCalledWith('/workspaces/ws1/projects/p1/schedule/baselines');
    expect(buildScheduleExcelWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({ baselineRows: [] }),
    );
  });

  it('Export schedule CSV triggers anchor download', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createUrl = vi.fn(() => 'blob:mock');
    const revokeUrl = vi.fn();
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createUrl,
    });
    Object.defineProperty(globalThis.URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeUrl,
    });

    const task: Task = {
      id: 'ta',
      title: 'Export me',
      status: 'BACKLOG',
      priority: 'NONE',
      startDate: '2026-01-01T00:00:00.000Z',
      dueDate: '2026-01-02T00:00:00.000Z',
      sortOrder: 0,
      actorTier: 'HUMAN',
      domain: 'GENERAL',
      complexity: 'LOW',
      reviewGate: 'NONE',
      retryCount: 0,
      isArchived: false,
      createdById: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const secs: Section[] = [{ ...sections[0], tasks: [task] }];

    const user = userEvent.setup();
    render(<ProjectTimelineView sections={secs} projectId="p1" />);

    await user.click(screen.getByRole('button', { name: /Export schedule CSV/i }));

    expect(createUrl).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    delete (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    delete (globalThis.URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
  });

  it('baseline mode lists BL10 in baseline slot select', async () => {
    const user = userEvent.setup();
    render(<ProjectTimelineView sections={sections} projectId="p1" workspaceId="ws1" />);

    await user.click(screen.getByRole('button', { name: /^Baseline$/ }));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'BL10' })).toBeInTheDocument();
    });
  });
});
