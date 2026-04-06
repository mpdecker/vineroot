import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectTimelineView } from './ProjectTimelineView';
import { useUIStore } from '../../stores/ui.store';
import type { Section } from '../../types';

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
});
