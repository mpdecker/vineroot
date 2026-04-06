import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardWidgetRenderer } from './DashboardWidgetRenderer';
import type { DashboardWidget } from '../../types';

const base = (over: Partial<DashboardWidget> = {}): DashboardWidget => ({
  id: 'w1',
  dashboardId: 'd1',
  type: 'TEXT_NOTE',
  title: 'Note',
  sortOrder: 0,
  gridX: 0,
  gridY: 0,
  gridW: 4,
  gridH: 2,
  config: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

describe('DashboardWidgetRenderer (widget)', () => {
  it('renders TEXT_NOTE with resolved body', () => {
    render(
      <DashboardWidgetRenderer
        widget={base({
          type: 'TEXT_NOTE',
          resolved: { body: 'Hello team' },
        })}
      />,
    );
    expect(screen.getByText('Hello team')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('renders NUMBER_METRIC', () => {
    render(
      <DashboardWidgetRenderer
        widget={base({
          type: 'NUMBER_METRIC',
          title: 'KPI',
          resolved: { value: 42, label: 'Stories' },
        })}
      />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Stories')).toBeInTheDocument();
  });

  it('renders AGENT_SLOT hint', () => {
    render(
      <DashboardWidgetRenderer
        widget={base({
          type: 'AGENT_SLOT',
          title: 'Agent',
          resolved: { hint: 'Custom hint', slotKey: 'sk1' },
        })}
      />,
    );
    expect(screen.getByText('Custom hint')).toBeInTheDocument();
    expect(screen.getByText(/slot:sk1/)).toBeInTheDocument();
  });

  it('renders PROJECT_SUMMARY error state', () => {
    render(
      <DashboardWidgetRenderer
        widget={base({
          type: 'PROJECT_SUMMARY',
          resolved: { error: 'Missing project' },
        })}
      />,
    );
    expect(screen.getByText('Missing project')).toBeInTheDocument();
  });

  it('renders PROJECT_CFD with resolved days', () => {
    render(
      <DashboardWidgetRenderer
        widget={base({
          type: 'PROJECT_CFD',
          title: 'Flow',
          resolved: {
            projectId: 'p1',
            days: [
              { date: '2026-01-01', byStatus: { BACKLOG: 1, DONE: 0 } },
              { date: '2026-01-02', byStatus: { BACKLOG: 0, DONE: 1 } },
            ],
            statusOrder: ['BACKLOG', 'DONE'],
          },
        })}
      />,
    );
    expect(screen.getByText('Flow')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /cumulative flow diagram/i })).toBeInTheDocument();
  });

  it('shows unknown type fallback', () => {
    render(
      <DashboardWidgetRenderer
        widget={
          {
            ...base(),
            type: 'UNKNOWN_TYPE',
          } as unknown as DashboardWidget
        }
      />,
    );
    expect(screen.getByText(/Unknown widget type/)).toBeInTheDocument();
  });
});
