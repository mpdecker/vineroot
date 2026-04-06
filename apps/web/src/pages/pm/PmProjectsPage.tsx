import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Plus } from 'lucide-react';
import { getPmSupabase, type PmProjectRow } from '../../lib/pmSupabase';
import { PmProjectCreateModal } from './components/PmProjectCreateModal';

export default function PmProjectsPage() {
  const sb = getPmSupabase();
  const [projects, setProjects] = useState<PmProjectRow[]>([]);
  const [pendingByProject, setPendingByProject] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!sb) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: prows, error: pErr } = await sb
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (pErr || !prows) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setProjects(prows as PmProjectRow[]);

    const { data: grows } = await sb
      .from('human_gates')
      .select('project_id')
      .eq('status', 'PENDING');
    const map: Record<string, number> = {};
    for (const r of (grows ?? []) as { project_id: string }[]) {
      map[r.project_id] = (map[r.project_id] ?? 0) + 1;
    }
    setPendingByProject(map);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const total = Object.values(pendingByProject).reduce((a, b) => a + b, 0);
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = total > 0 ? `(${total}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [pendingByProject]);

  if (!sb) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">ModelT PM</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Set <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">VITE_SUPABASE_ANON_KEY</code> in{' '}
          <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">apps/web/.env</code>.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-gray-500">Loading projects…</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">ModelT PM</h1>
          <p className="text-sm text-gray-500">Orchestration projects (Supabase)</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New project
        </button>
      </div>

      <PmProjectCreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        {projects.length === 0 && (
          <li className="p-6 text-center text-gray-500">No projects yet.</li>
        )}
        {projects.map((p) => {
          const pending = pendingByProject[p.id] ?? 0;
          return (
            <li key={p.id}>
              <Link
                to={`/pm/projects/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.slug}</div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium dark:bg-gray-800">
                    {p.status}
                  </span>
                  {pending > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      {pending} gate{pending === 1 ? '' : 's'}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
