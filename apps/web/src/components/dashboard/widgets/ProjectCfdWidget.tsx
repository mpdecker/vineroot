import type { DashboardWidget } from '../../../types';
import { CfdChart } from '../../project/ProjectFlowView';

export function ProjectCfdWidget({ widget }: { widget: DashboardWidget }) {
  const r = widget.resolved ?? {};
  const err = r.error as string | undefined;
  const days = r.days as { date: string; byStatus: Record<string, number> }[] | undefined;
  const statusOrder = r.statusOrder as string[] | undefined;

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-3 shadow-sm flex flex-col min-h-[140px]">
      <h3 className="text-sm font-semibold text-gray-900 shrink-0">{widget.title}</h3>
      {err ? (
        <p className="text-sm text-amber-700 mt-2">{err}</p>
      ) : days && statusOrder && days.length > 0 ? (
        <div className="mt-2 flex-1 min-h-0 overflow-hidden">
          <CfdChart days={days} statusOrder={statusOrder} />
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-2">No CFD data yet.</p>
      )}
    </div>
  );
}
