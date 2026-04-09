import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import type { DashboardWidget } from '../../../types';

function formatMetricValue(
  value: number,
  displayFormat?: string,
): string {
  const f = (displayFormat ?? '').toLowerCase();
  if (f === 'integer') {
    return String(Math.round(value));
  }
  if (f === 'decimal') {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  if (f === 'percent') {
    return `${Math.round(value)}%`;
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1);
}

export function NumberMetricWidget({ widget }: { widget: DashboardWidget }) {
  const r = widget.resolved ?? {};
  const err = r.error as string | undefined;
  const valueRaw = r.value as number | undefined;
  const label = (r.label as string) ?? 'Metric';
  const period = r.period as { from: string; to: string } | undefined;
  const sparkline = r.sparkline as { label: string; value: number }[] | undefined;
  const displayFormat =
    (r.displayFormat as string) ?? (widget.config?.displayFormat as string) ?? undefined;

  const chartData =
    sparkline?.map((p) => ({
      name: p.label.slice(5),
      v: p.value,
    })) ?? [];

  if (err) {
    return (
      <div className="h-full rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm flex flex-col justify-center">
        <p className="text-xs font-medium text-amber-900 uppercase tracking-wide">{widget.title}</p>
        <p className="text-sm text-amber-800 mt-2">{err}</p>
      </div>
    );
  }

  const display =
    valueRaw === undefined || valueRaw === null
      ? '—'
      : formatMetricValue(Number(valueRaw), displayFormat);

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{widget.title}</p>
      <p className="text-3xl font-bold text-indigo-600 mt-1 tabular-nums">{display}</p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
      {period && (
        <p className="text-[11px] text-gray-400 mt-1">
          {period.from} → {period.to}
        </p>
      )}
      {chartData.length > 0 && (
        <div className="mt-3 h-14 w-full flex-1 min-h-[56px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" hide />
              <Tooltip
                formatter={(v: number) => [v, 'Completed']}
                labelFormatter={(l) => `Week ${l}`}
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
