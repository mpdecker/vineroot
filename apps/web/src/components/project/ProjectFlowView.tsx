import { useMemo } from 'react';
import type { ProjectCfdDto } from '@vineroot/shared-types';
import { useProjectCfd } from '../../hooks/useProjects';
import { Loader2 } from 'lucide-react';

const CHART = { w: 720, h: 320, top: 16, right: 16, bottom: 32, left: 44 };

/** Fills for stacked CFD (Tailwind-like palette). */
const CFD_FILL: Record<string, string> = {
  BACKLOG: 'rgb(156 163 175)',
  READY: 'rgb(96 165 250)',
  IN_PROGRESS: 'rgb(14 165 233)',
  BLOCKED: 'rgb(248 113 113)',
  IN_REVIEW: 'rgb(250 204 21)',
  ESCALATION_PENDING: 'rgb(192 132 252)',
  BLOCKED_AWAITING_HUMAN: 'rgb(251 146 60)',
  BLOCKED_HUMAN_REROUTE: 'rgb(251 146 60)',
  REROUTED_READY: 'rgb(125 211 252)',
  DONE: 'rgb(74 222 128)',
  CANCELLED: 'rgb(209 213 219)',
};

function bandPath(
  days: ProjectCfdDto['days'],
  statusOrder: string[],
  statusIndex: number,
  innerW: number,
  innerH: number,
  left: number,
  top: number,
  maxY: number,
): string {
  const n = days.length;
  if (n === 0) return '';
  const xAt = (i: number) =>
    left + (n <= 1 ? innerW / 2 : (innerW * i) / Math.max(1, n - 1));
  const yAt = (count: number) => top + innerH * (1 - count / maxY);

  const lower: number[] = [];
  const upper: number[] = [];
  for (let i = 0; i < n; i++) {
    let below = 0;
    for (let j = 0; j < statusIndex; j++) {
      below += days[i].byStatus[statusOrder[j]] ?? 0;
    }
    const v = days[i].byStatus[statusOrder[statusIndex]] ?? 0;
    lower.push(below);
    upper.push(below + v);
  }

  let d = `M ${xAt(0)} ${yAt(upper[0])}`;
  for (let i = 1; i < n; i++) d += ` L ${xAt(i)} ${yAt(upper[i])}`;
  d += ` L ${xAt(n - 1)} ${yAt(lower[n - 1])}`;
  for (let i = n - 2; i >= 0; i--) d += ` L ${xAt(i)} ${yAt(lower[i])}`;
  d += ' Z';
  return d;
}

export function CfdChart({
  days,
  statusOrder,
}: Pick<ProjectCfdDto, 'days' | 'statusOrder'>) {
  const innerW = CHART.w - CHART.left - CHART.right;
  const innerH = CHART.h - CHART.top - CHART.bottom;

  const maxY = useMemo(
    () =>
      Math.max(
        1,
        ...days.map((d) =>
          statusOrder.reduce((s, k) => s + (d.byStatus[k] ?? 0), 0),
        ),
      ),
    [days, statusOrder],
  );

  const bands = useMemo(() => {
    return statusOrder
      .map((status, idx) => {
        const hasAny = days.some((d) => (d.byStatus[status] ?? 0) > 0);
        if (!hasAny) return null;
        return {
          status,
          d: bandPath(days, statusOrder, idx, innerW, innerH, CHART.left, CHART.top, maxY),
        };
      })
      .filter(Boolean) as { status: string; d: string }[];
  }, [days, statusOrder, innerW, innerH, maxY]);

  const n = days.length;
  const xLabel = (i: number) =>
    CHART.left + (n <= 1 ? innerW / 2 : (innerW * i) / Math.max(1, n - 1));

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${CHART.w} ${CHART.h}`}
      className="max-w-4xl text-gray-600"
      role="img"
      aria-label="Cumulative flow diagram"
    >
      <line
        x1={CHART.left}
        y1={CHART.top + innerH}
        x2={CHART.left + innerW}
        y2={CHART.top + innerH}
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      <line
        x1={CHART.left}
        y1={CHART.top}
        x2={CHART.left}
        y2={CHART.top + innerH}
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      {bands.map((b) => (
        <path
          key={b.status}
          d={b.d}
          fill={CFD_FILL[b.status] ?? 'rgb(148 163 184)'}
          fillOpacity={0.85}
          stroke="white"
          strokeWidth={0.5}
        />
      ))}
      {days.map((d, i) => {
        if (n > 14 && i % Math.ceil(n / 12) !== 0 && i !== n - 1) return null;
        return (
          <text
            key={d.date}
            x={xLabel(i)}
            y={CHART.h - 8}
            fontSize={9}
            textAnchor="middle"
            fill="currentColor"
            className="opacity-70"
          >
            {d.date.slice(5)}
          </text>
        );
      })}
      <text
        x={CHART.left - 6}
        y={CHART.top + innerH / 2}
        fontSize={10}
        textAnchor="middle"
        fill="currentColor"
        className="opacity-60"
        transform={`rotate(-90, ${CHART.left - 6}, ${CHART.top + innerH / 2})`}
      >
        Tasks
      </text>
    </svg>
  );
}

function Legend({
  statusOrder,
  days,
}: {
  statusOrder: string[];
  days: ProjectCfdDto['days'];
}) {
  const seen = statusOrder.filter((s) => days.some((d) => (d.byStatus[s] ?? 0) > 0));
  if (seen.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-600 mt-3">
      {seen.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: CFD_FILL[s] ?? '#94a3b8' }}
          />
          {s.replace(/_/g, ' ')}
        </span>
      ))}
    </div>
  );
}

export function ProjectFlowView({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useProjectCfd(projectId);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Cumulative flow</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          Task counts by status over the last 90 days. When project tasks change, we store a daily snapshot;
          missing days reuse the last known counts (or current live totals before the first snapshot).
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-600">Could not load cumulative flow for this project.</p>
      )}
      {data && !isLoading && data.days.length > 0 && (
        <>
          <CfdChart days={data.days} statusOrder={data.statusOrder} />
          <Legend statusOrder={data.statusOrder} days={data.days} />
        </>
      )}
      {data && !isLoading && data.days.length === 0 && (
        <p className="text-sm text-gray-500">No days in range.</p>
      )}
    </div>
  );
}
