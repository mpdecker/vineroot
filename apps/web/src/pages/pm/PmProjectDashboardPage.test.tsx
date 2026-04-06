import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PmProjectDashboardPage from './PmProjectDashboardPage';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

const { getPmSupabaseMock, channelMock } = vi.hoisted(() => ({
  getPmSupabaseMock: vi.fn(),
  channelMock: {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue('ch'),
  },
}));

vi.mock('../../lib/pmSupabase', () => ({
  getPmSupabase: () => getPmSupabaseMock(),
}));

describe('PmProjectDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    channelMock.on.mockClear();
    channelMock.subscribe.mockClear();
  });

  it('prompts for Supabase when client is null', () => {
    getPmSupabaseMock.mockReturnValue(null);
    render(
      <MemoryRouter initialEntries={[`/pm/projects/${PROJECT_ID}`]}>
        <Routes>
          <Route path="/pm/projects/:projectId" element={<PmProjectDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/configure supabase/i)).toBeInTheDocument();
  });

  it('shows project name, gates, and task summary', async () => {
    getPmSupabaseMock.mockReturnValue({
      channel: vi.fn(() => channelMock),
      removeChannel: vi.fn(),
      from: (table: string) => {
        if (table === 'projects') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: PROJECT_ID,
                      slug: 'my-app',
                      name: 'My Application',
                      status: 'PHASE_2',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      idea_brief_path: null,
                      plan_path: null,
                      design_doc_path: null,
                      repo_url: null,
                      metadata: {},
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 't1',
                      project_id: PROJECT_ID,
                      phase: 0,
                      implementation_phase: null,
                      title: 'T',
                      description: '',
                      actor_tier: 'HUMAN',
                      domain: 'PLANNING',
                      complexity: 'LOW',
                      estimated_minutes: 60,
                      timeout_minutes: 60,
                      parallel_group: null,
                      status: 'PENDING',
                      priority: 3,
                      review_gate: 'AUTOMATED_ONLY',
                      acceptance_criteria: [],
                      context_refs: [],
                      notes: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  ],
                  error: null,
                }),
            }),
          };
        }
        if (table === 'human_gates') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: 'g1',
                          project_id: PROJECT_ID,
                          gate_type: 'PHASE_GATE',
                          originating_task_id: null,
                          blocking_task_id: null,
                          context_summary: 'Approve phase',
                          failure_history: [],
                          decision_options: ['OK'],
                          recommended_option: 'OK',
                          decision: null,
                          decision_notes: null,
                          status: 'PENDING',
                          created_at: new Date().toISOString(),
                          resolved_at: null,
                          age_alert_sent: false,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: 'a1',
                          project_id: PROJECT_ID,
                          task_id: null,
                          gate_id: null,
                          event_type: 'TASK_STATUS_CHANGE',
                          actor: 'x',
                          from_value: 'A',
                          to_value: 'B',
                          detail: {},
                          created_at: new Date().toISOString(),
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    } as never);

    render(
      <MemoryRouter initialEntries={[`/pm/projects/${PROJECT_ID}`]}>
        <Routes>
          <Route path="/pm/projects/:projectId" element={<PmProjectDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('My Application')).toBeInTheDocument();
    expect(screen.getByText('Approve phase')).toBeInTheDocument();
    expect(screen.getByText(/task summary/i)).toBeInTheDocument();
    expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    expect(getPmSupabaseMock()!.channel).toHaveBeenCalled();
  });
});
