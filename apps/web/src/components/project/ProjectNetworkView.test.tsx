import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ProjectCriticalPathDto, ProjectScheduleNetworkDto } from '@vineroot/shared-types';
import { ProjectNetworkView } from './ProjectNetworkView';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: { get: vi.fn() },
}));

const openTask = vi.fn();
vi.mock('../../stores/ui.store', () => ({
  useUIStore: (sel: (s: { openTask: typeof openTask }) => unknown) =>
    sel({ openTask }),
}));

describe('ProjectNetworkView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const network: ProjectScheduleNetworkDto = {
    projectId: 'p1',
    nodes: [
      { id: 'a', title: 'Task A' },
      { id: 'b', title: 'Task B' },
    ],
    edges: [
      {
        fromTaskId: 'a',
        toTaskId: 'b',
        linkType: 'FS',
        lagDays: 2,
        lagIsElapsed: false,
      },
    ],
  };

  const cp: ProjectCriticalPathDto = {
    projectId: 'p1',
    criticalTaskIds: [],
    tasks: [],
    drivingEdges: [{ fromTaskId: 'a', toTaskId: 'b' }],
  };

  it('renders SVG path titles with link type, lag, and driving flag', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/schedule/network')) {
        return Promise.resolve({ data: network });
      }
      if (url.includes('/critical-path')) {
        return Promise.resolve({ data: cp });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    const { container } = render(
      <ProjectNetworkView projectId="p1" workspaceId="ws1" />,
    );

    await waitFor(() => {
      expect(screen.getByRole('img', { name: /task dependency network/i })).toBeInTheDocument();
    });

    const titleEl = container.querySelector('path title');
    expect(titleEl?.textContent).toContain('FS');
    expect(titleEl?.textContent).toContain('lag 2');
    expect(titleEl?.textContent).toContain('working d');
    expect(titleEl?.textContent).toContain('driving');
  });

  it('uses elapsed lag label when lagIsElapsed is true', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/schedule/network')) {
        return Promise.resolve({
          data: {
            ...network,
            edges: [
              {
                fromTaskId: 'a',
                toTaskId: 'b',
                linkType: 'SS',
                lagDays: 0,
                lagIsElapsed: true,
              },
            ],
          },
        });
      }
      if (url.includes('/critical-path')) {
        return Promise.resolve({ data: { ...cp, drivingEdges: [] } });
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });

    const { container } = render(
      <ProjectNetworkView projectId="p1" workspaceId="ws1" />,
    );

    await waitFor(() => {
      expect(container.querySelector('path title')).toBeTruthy();
    });

    expect(container.querySelector('path title')?.textContent).toContain('elapsed d');
  });
});
