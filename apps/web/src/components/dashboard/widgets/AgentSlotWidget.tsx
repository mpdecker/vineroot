import { Bot } from 'lucide-react';
import type { DashboardWidget } from '../../../types';

export function AgentSlotWidget({ widget }: { widget: DashboardWidget }) {
  const r = widget.resolved ?? {};
  const hint = (r.hint as string) ?? 'Agent-ready tile for KPIs, summaries, and alerts.';
  const slotKey = (r.slotKey as string) ?? 'default';

  return (
    <div className="h-full rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 flex flex-col">
      <div className="flex items-center gap-2 text-indigo-800">
        <Bot className="w-5 h-5 flex-shrink-0" />
        <h3 className="text-sm font-semibold">{widget.title}</h3>
      </div>
      <p className="text-xs text-indigo-600/80 mt-2 flex-1">{hint}</p>
      <p className="text-[10px] text-indigo-400 font-mono mt-2">slot:{slotKey}</p>
    </div>
  );
}
