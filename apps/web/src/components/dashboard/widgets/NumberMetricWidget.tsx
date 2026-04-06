import type { DashboardWidget } from '../../../types';

export function NumberMetricWidget({ widget }: { widget: DashboardWidget }) {
  const r = widget.resolved ?? {};
  const value = r.value as number | string | undefined;
  const label = (r.label as string) ?? 'Metric';

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col justify-center items-center text-center">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{widget.title}</p>
      <p className="text-3xl font-bold text-indigo-600 mt-1 tabular-nums">{value ?? '—'}</p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
    </div>
  );
}
