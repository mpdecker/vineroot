import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HumanGatesPanel } from './HumanGatesPanel';
import type { PmHumanGateRow } from '../../../lib/pmSupabase';

const updateMock = vi.fn();
const insertMock = vi.fn();

vi.mock('../../../lib/pmSupabase', () => ({
  getPmSupabase: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'human_gates') {
        return {
          update: (data: unknown) => {
            updateMock(data);
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(() => Promise.resolve({ error: null })),
              })),
            };
          },
        };
      }
      if (table === 'audit_log') {
        return {
          insert: (row: unknown) => {
            insertMock(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {};
    }),
  })),
}));

function gate(overrides: Partial<PmHumanGateRow> = {}): PmHumanGateRow {
  return {
    id: 'gate-1',
    project_id: 'proj-1',
    gate_type: 'GENERAL',
    originating_task_id: null,
    blocking_task_id: null,
    context_summary: 'Please decide',
    failure_history: [],
    decision_options: ['Yes', 'No'],
    recommended_option: 'Yes',
    decision: null,
    decision_notes: null,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    resolved_at: null,
    age_alert_sent: false,
    ...overrides,
  };
}

describe('HumanGatesPanel', () => {
  const onResolved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockClear();
    insertMock.mockClear();
  });

  it('renders empty state when no gates', () => {
    render(<HumanGatesPanel projectId="p1" gates={[]} onResolved={onResolved} />);
    expect(screen.getByText(/no pending human gates/i)).toBeInTheDocument();
  });

  it('disables resolve until an option is selected', async () => {
    render(<HumanGatesPanel projectId="p1" gates={[gate()]} onResolved={onResolved} />);
    const resolveBtn = screen.getByRole('button', { name: /resolve/i });
    expect(resolveBtn).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /yes/i }));
    expect(resolveBtn).not.toBeDisabled();
  });

  it('resolves gate and inserts audit when option chosen', async () => {
    render(<HumanGatesPanel projectId="p1" gates={[gate()]} onResolved={onResolved} />);
    await userEvent.click(screen.getByRole('button', { name: /yes/i }));
    await userEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'Yes',
        status: 'RESOLVED',
      }),
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'p1',
        gate_id: 'gate-1',
        event_type: 'HUMAN_DECISION',
      }),
    );
    expect(onResolved).toHaveBeenCalled();
  });

  it('keeps resolve disabled for BLOCKED_HUMAN_REROUTE without notes', async () => {
    render(
      <HumanGatesPanel
        projectId="p1"
        gates={[gate({ gate_type: 'BLOCKED_HUMAN_REROUTE' })]}
        onResolved={onResolved}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /yes/i }));
    expect(screen.getByRole('button', { name: /^resolve$/i })).toBeDisabled();
  });
});
