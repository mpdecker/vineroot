import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  getPmSupabase,
  type PmProjectRow,
  type PmTaskRow,
  type PmHumanGateRow,
  type PmAuditRow,
} from '../../lib/pmSupabase';
import { HumanGatesPanel } from './components/HumanGatesPanel';

const PHASES = ['PHASE_0', 'PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4', 'PHASE_5', 'PHASE_6', 'PHASE_7', 'PHASE_8'];

function phaseIndex(status: string) {
  const i = PHASES.indexOf(status);
  return i >= 0 ? i : 0;
}

export default function PmProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const sb = getPmSupabase();
  const [project, setProject] = useState<PmProjectRow | null>(null);
  const [tasks, setTasks] = useState<PmTaskRow[]>([]);
  const [gates, setGates] = useState<PmHumanGateRow[]>([]);
  const [audit, setAudit] = useState<PmAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sb || !projectId) return;
    setLoading(true);
    const [pRes, tRes, gRes, aRes] = await Promise.all([
      sb.from('projects').select('*').eq('id', projectId).maybeSingle(),
      sb.from('tasks').select('*').eq('project_id', projectId),
      sb
        .from('human_gates')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true }),
      sb
        .from('audit_log')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setProject((pRes.data as PmProjectRow) ?? null);
    setTasks((tRes.data as PmTaskRow[]) ?? []);
    setGates((gRes.data as PmHumanGateRow[]) ?? []);
    setAudit((aRes.data as PmAuditRow[]) ?? []);
    setLoading(false);
  }, [sb, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!sb || !projectId) return;
    const ch = sb
      .channel(`pm-gates-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'human_gates',
          filter: `project_id=eq.${projectId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [sb, projectId, load]);

  if (!sb) {
    return (
      <div className="p-8 text-gray-500">
        Configure Supabase env vars to use ModelT PM.
      </div>
    );
  }

  if (!projectId) {
    return <div className="p-8">Missing project</div>;
  }

  if (loading && !project) {
    return <div className="p-8 text-gray-500">Loading…</div>;
  }

  if (!project) {
    return <div className="p-8">Project not found</div>;
  }

  const idx = phaseIndex(project.status);
  const summary: Record<string, number> = {};
  for (const t of tasks) {
    summary[t.status] = (summary[t.status] ?? 0) + 1;
  }

  const stripKeys = ['PENDING', 'READY', 'IN_PROGRESS', 'DONE', 'FAILED'];
  const blocked =
    (summary.BLOCKED_AWAITING_HUMAN ?? 0) +
    (summary.BLOCKED_METADATA_ERROR ?? 0) +
    (summary.BLOCKED_DEPENDENCY_CANCELLED ?? 0) +
    (summary.BLOCKED_HUMAN_REROUTE ?? 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/pm" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            ← All PM projects
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-gray-500">{project.slug}</p>
        </div>
        <Link
          to={`/pm/projects/${projectId}/board`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          Task board
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Phase progress</h2>
        <div className="flex gap-1">
          {PHASES.map((ph, i) => (
            <div
              key={ph}
              title={ph}
              className={`h-2 flex-1 rounded ${
                i <= idx ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-500">Current: {project.status}</p>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Human gates</h2>
          {gates.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
              {gates.length}
            </span>
          )}
        </div>
        <HumanGatesPanel projectId={projectId} gates={gates} onResolved={load} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Task summary</h2>
        <div className="flex flex-wrap gap-2">
          {stripKeys.map((k) => (
            <Link
              key={k}
              to={`/pm/projects/${projectId}/board?status=${encodeURIComponent(k)}`}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <span className="text-gray-500">{k}</span>{' '}
              <span className="font-semibold">{summary[k] ?? 0}</span>
            </Link>
          ))}
          <span className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
            <span className="text-gray-500">BLOCKED</span>{' '}
            <span className="font-semibold">{blocked}</span>
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
        <ul className="space-y-2 text-sm">
          {audit.map((e) => (
            <li key={e.id} className="rounded border border-gray-100 p-2 dark:border-gray-800">
              <span className="font-medium">{e.event_type}</span>
              {e.actor && <span className="text-gray-500"> · {e.actor}</span>}
              <span className="text-xs text-gray-400">
                {' '}
                · {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
              </span>
              {(e.from_value || e.to_value) && (
                <div className="text-xs text-gray-500">
                  {e.from_value} → {e.to_value}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
