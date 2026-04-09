import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { DashboardWidget } from '../../../types';

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Backlog',
  READY: 'Ready',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  IN_REVIEW: 'Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const PIE_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#14b8a6',
  '#64748b',
];

export function TasksByStatusWidget({ widget }: { widget: DashboardWidget }) {
  const buckets = (widget.resolved?.buckets as { status: string; count: number }[] | undefined) ?? [];
  const data = buckets.map((b) => ({
    name: STATUS_LABEL[b.status] ?? b.status,
    count: b.count,
    status: b.status,
  }));

  const chartStyle = String(widget.config?.chartStyle ?? 'bar').toLowerCase();

  const empty = (
    <p className="text-sm text-gray-500 flex-1 flex items-center justify-center">No tasks yet</p>
  );

  return (
    <div className="h-full min-h-[200px] flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{widget.title}</h3>
      <p className="text-xs text-gray-500 mb-3">Tasks in this workspace (and linked projects)</p>
      {data.length === 0 ? (
        empty
      ) : chartStyle === 'pie' || chartStyle === 'donut' ? (
        <div className="flex-1 min-h-[180px] flex items-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={chartStyle === 'donut' ? '45%' : 0}
                outerRadius="70%"
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : chartStyle === 'horizontalbar' ? (
        <div className="flex-1 min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Tasks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex-1 min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={56}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tasks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
