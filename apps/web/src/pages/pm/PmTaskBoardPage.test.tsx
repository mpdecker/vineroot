import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PmTaskBoardPage from './PmTaskBoardPage';

const { getPmSupabaseMock } = vi.hoisted(() => ({
  getPmSupabaseMock: vi.fn(),
}));

vi.mock('../../lib/pmSupabase', () => ({
  getPmSupabase: () => getPmSupabaseMock(),
}));

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('PmTaskBoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows missing config when supabase null', () => {
    getPmSupabaseMock.mockReturnValue(null);
    render(
      <MemoryRouter initialEntries={[`/pm/projects/${PROJECT_ID}/board`]}>
        <Routes>
          <Route path="/pm/projects/:projectId/board" element={<PmTaskBoardPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/missing configuration/i)).toBeInTheDocument();
  });

  it('renders kanban columns with filtered tasks', async () => {
    getPmSupabaseMock.mockReturnValue({
      from: (table: string) => {
        if (table === 'projects') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: PROJECT_ID,
                      slug: 's',
                      name: 'Project S',
                      status: 'PHASE_0',
                      created_at: '',
                      updated_at: '',
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
                      title: 'Pending task',
                      description: '',
                      actor_tier: 'HUMAN',
                      domain: 'PLANNING',
                      complexity: 'LOW',
                      estimated_minutes: 30,
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
                    {
                      id: 't2',
                      project_id: PROJECT_ID,
                      phase: 0,
                      implementation_phase: null,
                      title: 'Done task',
                      description: '',
                      actor_tier: 'HUMAN',
                      domain: 'PLANNING',
                      complexity: 'LOW',
                      estimated_minutes: 10,
                      timeout_minutes: 60,
                      parallel_group: null,
                      status: 'DONE',
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
        return {};
      },
    } as never);

    render(
      <MemoryRouter initialEntries={[`/pm/projects/${PROJECT_ID}/board`]}>
        <Routes>
          <Route path="/pm/projects/:projectId/board" element={<PmTaskBoardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Project S — board')).toBeInTheDocument();
    expect(screen.getByText('Pending task')).toBeInTheDocument();
    expect(screen.getByText('Done task')).toBeInTheDocument();
    expect(screen.getByText(/PENDING \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/DONE \(1\)/)).toBeInTheDocument();
  });
});
