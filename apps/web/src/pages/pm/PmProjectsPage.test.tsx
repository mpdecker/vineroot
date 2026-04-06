import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PmProjectsPage from './PmProjectsPage';

const { getPmSupabaseMock } = vi.hoisted(() => ({
  getPmSupabaseMock: vi.fn(),
}));

vi.mock('../../lib/pmSupabase', () => ({
  getPmSupabase: () => getPmSupabaseMock(),
}));

describe('PmProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows setup message when Supabase is not configured', () => {
    getPmSupabaseMock.mockReturnValue(null);
    render(
      <MemoryRouter>
        <PmProjectsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/modelt pm/i)).toBeInTheDocument();
    expect(screen.getByText(/vite_supabase_url/i)).toBeInTheDocument();
  });

  it('lists projects and pending gate counts', async () => {
    getPmSupabaseMock.mockReturnValue({
      from: (table: string) => {
        if (table === 'projects') {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: 'p1',
                      slug: 'app',
                      name: 'App',
                      status: 'PHASE_0',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      idea_brief_path: null,
                      plan_path: null,
                      design_doc_path: null,
                      repo_url: null,
                      metadata: {},
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
              eq: () =>
                Promise.resolve({
                  data: [{ project_id: 'p1' }, { project_id: 'p1' }],
                  error: null,
                }),
            }),
          };
        }
        return {};
      },
    } as never);

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<PmProjectsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('App')).toBeInTheDocument();
    expect(screen.getByText('2 gates')).toBeInTheDocument();
  });
});
