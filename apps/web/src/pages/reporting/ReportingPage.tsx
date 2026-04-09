import { useMemo, useState } from 'react';
import { Loader2, Download, BookmarkPlus, Trash2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { WorkspaceReportingFilters } from '@vineroot/shared-types';
import { useWorkspaceStore } from '../../stores/workspace.store';
import {
  useReportingSummary,
  downloadReportingCsv,
} from '../../hooks/useReporting';
import { useProjects } from '../../hooks/useProjects';
import { usePortfolios } from '../../hooks/usePortfolios';
import { useWorkspace } from '../../hooks/useWorkspaces';
import { useWorkspaceTags } from '../../hooks/useWorkspaceTags';
import {
  useReportingSavedViews,
  useCreateReportingView,
  useDeleteReportingView,
} from '../../hooks/useReportingSavedViews';
import { Button } from '../../components/ui';

const STATUS_OPTIONS = [
  'BACKLOG',
  'READY',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
] as const;

function emptyFilters(): WorkspaceReportingFilters {
  return {};
}

export default function ReportingPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const wid = currentWorkspace?.id;

  const [appliedFilters, setAppliedFilters] = useState<WorkspaceReportingFilters>(emptyFilters());
  const [form, setForm] = useState<{
    from: string;
    to: string;
    projectIds: string[];
    portfolioId: string;
    assigneeIds: string[];
    statuses: string[];
    tagIds: string[];
  }>({
    from: '',
    to: '',
    projectIds: [],
    portfolioId: '',
    assigneeIds: [],
    statuses: [],
    tagIds: [],
  });
  const [saveName, setSaveName] = useState('');
  const [selectedViewId, setSelectedViewId] = useState<string>('');

  const { data: summary, isLoading, isError } = useReportingSummary(wid, appliedFilters);
  const { data: projects } = useProjects(wid ?? '');
  const { data: portfolios } = usePortfolios(wid);
  const { data: workspace } = useWorkspace(wid);
  const { data: tags } = useWorkspaceTags(wid);
  const { data: savedViews } = useReportingSavedViews(wid);
  const { mutate: createView, isPending: savingView } = useCreateReportingView(wid);
  const { mutate: deleteView } = useDeleteReportingView(wid);

  const members = workspace?.members ?? [];

  const filtersPayload = useMemo((): WorkspaceReportingFilters => {
    const f: WorkspaceReportingFilters = {};
    if (form.from.trim()) f.from = form.from.trim();
    if (form.to.trim()) f.to = form.to.trim();
    if (form.portfolioId) f.portfolioId = form.portfolioId;
    if (form.projectIds.length) f.projectIds = form.projectIds;
    if (form.assigneeIds.length) f.assigneeIds = form.assigneeIds;
    if (form.statuses.length) f.statuses = form.statuses;
    if (form.tagIds.length) f.tagIds = form.tagIds;
    return f;
  }, [form]);

  const applyFilters = () => {
    setAppliedFilters(filtersPayload);
  };

  const resetFilters = () => {
    setForm({
      from: '',
      to: '',
      projectIds: [],
      portfolioId: '',
      assigneeIds: [],
      statuses: [],
      tagIds: [],
    });
    setAppliedFilters(emptyFilters());
    setSelectedViewId('');
  };

  const loadSavedView = (id: string) => {
    const v = savedViews?.find((x) => x.id === id);
    if (!v) return;
    const c = v.config ?? {};
    setForm({
      from: typeof c.from === 'string' ? c.from : '',
      to: typeof c.to === 'string' ? c.to : '',
      projectIds: Array.isArray(c.projectIds) ? [...c.projectIds] : [],
      portfolioId: typeof c.portfolioId === 'string' ? c.portfolioId : '',
      assigneeIds: Array.isArray(c.assigneeIds) ? [...c.assigneeIds] : [],
      statuses: Array.isArray(c.statuses) ? [...c.statuses] : [],
      tagIds: Array.isArray(c.tagIds) ? [...c.tagIds] : [],
    });
    setAppliedFilters({ ...c });
    setSelectedViewId(id);
  };

  const handleSaveView = () => {
    const name = saveName.trim();
    if (!name) return;
    createView(
      { name, config: filtersPayload },
      {
        onSuccess: () => setSaveName(''),
      },
    );
  };

  if (!currentWorkspace) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace in the sidebar to view reporting.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-red-600">Could not load reporting data.</p>
      </div>
    );
  }

  const statusData = Object.entries(summary.tasksByStatus).map(([status, count]) => ({
    status: status.replace(/_/g, ' '),
    count,
  }));

  const workloadData = summary.workload.slice(0, 12).map((w) => ({
    name:
      w.displayName.length > 14 ? `${w.displayName.slice(0, 12)}…` : w.displayName,
    tasks: w.openTaskCount,
  }));

  const toggleIn = (arr: string[], id: string, set: (v: string[]) => void) => {
    if (arr.includes(id)) set(arr.filter((x) => x !== id));
    else set([...arr, id]);
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reporting</h1>
          <p className="text-gray-600 mt-1">
            Workspace metrics for {currentWorkspace.name}. Period{' '}
            <span className="font-medium text-gray-800">
              {summary.period.from} → {summary.period.to}
            </span>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
            onClick={() => wid && downloadReportingCsv(wid, appliedFilters)}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={form.from}
              onChange={(e) => setForm((s) => ({ ...s, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="date"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={form.to}
              onChange={(e) => setForm((s) => ({ ...s, to: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Portfolio</label>
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={form.portfolioId}
              onChange={(e) => setForm((s) => ({ ...s, portfolioId: e.target.value }))}
            >
              <option value="">All projects</option>
              {portfolios?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-gray-600 mb-2">Projects</span>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {projects?.map((p) => (
              <label
                key={p.id}
                className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.projectIds.includes(p.id)}
                  onChange={() =>
                    toggleIn(form.projectIds, p.id, (ids) =>
                      setForm((s) => ({ ...s, projectIds: ids })),
                    )
                  }
                  className="rounded border-gray-300"
                />
                {p.name}
              </label>
            ))}
            {!projects?.length && (
              <span className="text-sm text-gray-500">No projects in workspace</span>
            )}
          </div>
        </div>

        <div>
          <span className="block text-xs font-medium text-gray-600 mb-2">Assignees</span>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {members.map((m) => (
              <label
                key={m.userId}
                className="inline-flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.assigneeIds.includes(m.userId)}
                  onChange={() =>
                    toggleIn(form.assigneeIds, m.userId, (ids) =>
                      setForm((s) => ({ ...s, assigneeIds: ids })),
                    )
                  }
                  className="rounded border-gray-300"
                />
                {m.user.displayName}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="block text-xs font-medium text-gray-600 mb-2">Status</span>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((st) => (
                <label
                  key={st}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.statuses.includes(st)}
                    onChange={() =>
                      toggleIn(form.statuses, st, (ids) =>
                        setForm((s) => ({ ...s, statuses: ids })),
                      )
                    }
                    className="rounded border-gray-300"
                  />
                  {st.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium text-gray-600 mb-2">Tags</span>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {tags?.map((t) => (
                <label
                  key={t.id}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.tagIds.includes(t.id)}
                    onChange={() =>
                      toggleIn(form.tagIds, t.id, (ids) =>
                        setForm((s) => ({ ...s, tagIds: ids })),
                      )
                    }
                    className="rounded border-gray-300"
                  />
                  {t.name}
                </label>
              ))}
              {!tags?.length && (
                <span className="text-xs text-gray-500">No tags</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <Button type="button" onClick={applyFilters}>
            Apply filters
          </Button>
          <Button type="button" variant="secondary" onClick={resetFilters}>
            Reset
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-600">Saved views</label>
            <select
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              value={selectedViewId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedViewId(id);
                if (id) loadSavedView(id);
              }}
            >
              <option value="">Load…</option>
              {savedViews?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {selectedViewId && (
              <button
                type="button"
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                title="Delete saved view"
                onClick={() => {
                  if (confirm('Delete this saved view?')) {
                    deleteView(selectedViewId);
                    setSelectedViewId('');
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Name for new saved view"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm min-w-[12rem]"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={savingView || !saveName.trim()}
              icon={<BookmarkPlus className="w-4 h-4" />}
              onClick={handleSaveView}
            >
              Save view
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500">Open tasks</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">{summary.openTaskCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500">Completed in period</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">
            {summary.completedLast30Days}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500">Created in period</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">
            {summary.createdLast30Days}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Avg lead time</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {summary.flowMetrics.leadTimeDays.avg != null
              ? `${summary.flowMetrics.leadTimeDays.avg} d`
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            create → done · n={summary.flowMetrics.leadTimeDays.sampleSize}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Median lead time</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {summary.flowMetrics.leadTimeDays.median != null
              ? `${summary.flowMetrics.leadTimeDays.median} d`
              : '—'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Avg cycle time</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {summary.flowMetrics.cycleTimeDays.avg != null
              ? `${summary.flowMetrics.cycleTimeDays.avg} d`
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            start → done (tasks with a start date) · n=
            {summary.flowMetrics.cycleTimeDays.sampleSize}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Median cycle time</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">
            {summary.flowMetrics.cycleTimeDays.median != null
              ? `${summary.flowMetrics.cycleTimeDays.median} d`
              : '—'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Throughput (completions by week)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Calendar weeks (Mon–Sun) overlapping the reporting period. Each bar is tasks marked done that week.
        </p>
        {summary.throughputByWeek.length === 0 ? (
          <p className="text-gray-500 text-sm">No weeks in range.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.throughputByWeek.map((w) => ({
                  label: w.weekStart.slice(5),
                  n: w.completedCount,
                }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="n" fill="#10b981" radius={[4, 4, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks by status</h2>
        {statusData.length === 0 ? (
          <p className="text-gray-500 text-sm">No tasks match the current filters.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={64} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tasks" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Workload (open tasks by assignee)</h2>
        {workloadData.length === 0 ? (
          <p className="text-gray-500 text-sm">No assignees on open tasks for this filter.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={workloadData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="tasks" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Open tasks" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
