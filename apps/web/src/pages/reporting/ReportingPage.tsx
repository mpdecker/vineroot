import { Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useReportingSummary } from '../../hooks/useReporting';

export default function ReportingPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const wid = currentWorkspace?.id;
  const { data: summary, isLoading, isError } = useReportingSummary(wid);

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

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reporting</h1>
        <p className="text-gray-600 mt-1">
          Workspace overview for {currentWorkspace.name} (last 30 days where noted).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500">Open tasks</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">{summary.openTaskCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500">Completed (30d)</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">
            {summary.completedLast30Days}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-sm text-gray-500">Created (30d)</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">
            {summary.createdLast30Days}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tasks by status</h2>
        {statusData.length === 0 ? (
          <p className="text-gray-500 text-sm">No tasks in this workspace yet.</p>
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
          <p className="text-gray-500 text-sm">No assignees on open tasks.</p>
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
