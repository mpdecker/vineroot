import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { getPmSupabase, type PmProjectRow, type PmTaskRow } from '../../lib/pmSupabase';

const KANBAN_COLUMNS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: 'PENDING', label: 'PENDING', match: (s) => s === 'PENDING' },
  { key: 'READY', label: 'READY', match: (s) => s === 'READY' },
  { key: 'IN_PROGRESS', label: 'IN_PROGRESS', match: (s) => s === 'IN_PROGRESS' },
  { key: 'VALIDATING', label: 'VALIDATING', match: (s) => s === 'VALIDATING' },
  { key: 'REVIEW_PENDING', label: 'REVIEW_PENDING', match: (s) => s === 'REVIEW_PENDING' },
  { key: 'DONE', label: 'DONE', match: (s) => s === 'DONE' },
  {
    key: 'BLOCKED_FAILED',
    label: 'BLOCKED / FAILED',
    match: (s) =>
      s === 'FAILED' ||
      s.startsWith('BLOCKED') ||
      s === 'ESCALATION_PENDING' ||
      s === 'CANCELLED',
  },
];

export default function PmTaskBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const sb = getPmSupabase();
  const [project, setProject] = useState<PmProjectRow | null>(null);
  const [tasks, setTasks] = useState<PmTaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [actorTier, setActorTier] = useState<string>('');
  const [complexity, setComplexity] = useState<string>('');
  const [parallelGroup, setParallelGroup] = useState<string>('');

  const load = useCallback(async () => {
    if (!sb || !projectId) return;
    setLoading(true);
    const [pRes, tRes] = await Promise.all([
      sb.from('projects').select('*').eq('id', projectId).maybeSingle(),
      sb.from('tasks').select('*').eq('project_id', projectId),
    ]);
    setProject((pRes.data as PmProjectRow) ?? null);
    setTasks((tRes.data as PmTaskRow[]) ?? []);
    setLoading(false);
  }, [sb, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusHint = searchParams.get('status');

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusHint && t.status !== statusHint) return false;
      if (phase !== '' && String(t.phase) !== phase) return false;
      if (domain && t.domain !== domain) return false;
      if (actorTier && t.actor_tier !== actorTier) return false;
      if (complexity && t.complexity !== complexity) return false;
      if (parallelGroup && (t.parallel_group ?? '') !== parallelGroup) return false;
      return true;
    });
  }, [tasks, statusHint, phase, domain, actorTier, complexity, parallelGroup]);

  const byColumn = useMemo(() => {
    const m: Record<string, PmTaskRow[]> = {};
    for (const col of KANBAN_COLUMNS) m[col.key] = [];
    for (const t of filtered) {
      const col = KANBAN_COLUMNS.find((c) => c.match(t.status));
      if (col) m[col.key].push(t);
      else m.BLOCKED_FAILED.push(t);
    }
    return m;
  }, [filtered]);

  const domains = useMemo(() => [...new Set(tasks.map((t) => t.domain))].sort(), [tasks]);
  const tiers = useMemo(() => [...new Set(tasks.map((t) => t.actor_tier))].sort(), [tasks]);
  const groups = useMemo(
    () => [...new Set(tasks.map((t) => t.parallel_group).filter(Boolean) as string[])].sort(),
    [tasks],
  );

  if (!sb || !projectId) {
    return <div className="p-8 text-gray-500">Missing configuration or project.</div>;
  }

  if (loading && !project) {
    return <div className="p-8">Loading…</div>;
  }

  if (!project) {
    return <div className="p-8">Project not found</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/pm/projects/${projectId}`} className="text-sm text-indigo-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold">{project.name} — board</h1>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
        >
          <option value="">All phases</option>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <option key={n} value={String(n)}>
              Phase {n}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
          value={actorTier}
          onChange={(e) => setActorTier(e.target.value)}
        >
          <option value="">All actors</option>
          {tiers.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
          value={complexity}
          onChange={(e) => setComplexity(e.target.value)}
        >
          <option value="">All complexity</option>
          {['TRIVIAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
          value={parallelGroup}
          onChange={(e) => setParallelGroup(e.target.value)}
        >
          <option value="">All parallel groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.key} className="w-64 shrink-0">
            <div className="mb-2 text-xs font-semibold uppercase text-gray-500">
              {col.label} ({byColumn[col.key]?.length ?? 0})
            </div>
            <div className="space-y-2">
              {(byColumn[col.key] ?? []).map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <div className="font-medium leading-snug">{t.title}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] dark:bg-gray-800">
                      {t.actor_tier}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] dark:bg-gray-800">
                      {t.complexity}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    est {t.estimated_minutes}m ·{' '}
                    {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
