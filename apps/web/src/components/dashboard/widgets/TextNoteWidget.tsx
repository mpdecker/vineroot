import type { DashboardWidget } from '../../../types';

export function TextNoteWidget({ widget }: { widget: DashboardWidget }) {
  const body = String((widget.resolved?.body as string) ?? (widget.config.body as string) ?? '');

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{widget.title}</h3>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{body || 'Empty note'}</p>
    </div>
  );
}
