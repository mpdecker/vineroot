import { useEffect, useMemo, useState } from 'react';
import type {
  ProjectSprintVelocityDto,
  SprintBurnupDto,
  SprintBurndownDto,
} from '@vineroot/shared-types';
import {
  useProjectSprintVelocity,
  useSprintBurnup,
  useSprintBurndown,
} from '../../hooks/useProjects';
import type { Sprint } from '../../types';
import { Loader2 } from 'lucide-react';

interface ProjectBurndownViewProps {
  projectId: string;
  sprints: Sprint[];
}

const CHART = { w: 720, h: 280, top: 16, right: 16, bottom: 28, left: 40 };

function BurndownChart({ data }: { data: SprintBurndownDto }) {
  const { days, totalScope } = data;
  const innerW = CHART.w - CHART.left - CHART.right;
  const innerH = CHART.h - CHART.top - CHART.bottom;

  const { maxY, pointsRemaining, pointsIdeal, xForIndex } = useMemo(() => {
    if (days.length === 0) {
      return {
        maxY: 1,
        pointsRemaining: [] as { x: number; y: number }[],
        pointsIdeal: [] as { x: number; y: number }[],
        xForIndex: (_i: number) => 0,
      };
    }
    const maxY = Math.max(
      totalScope,
      ...days.map((d) => Math.max(d.remaining, d.ideal)),
      1,
    );
    const n = days.length;
    const xForIndex = (i: number) =>
      CHART.left + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
    const yForVal = (v: number) => CHART.top + innerH * (1 - v / maxY);
    const pointsRemaining = days.map((d, i) => ({
      x: xForIndex(i),
      y: yForVal(d.remaining),
    }));
    const pointsIdeal = days.map((d, i) => ({
      x: xForIndex(i),
      y: yForVal(d.ideal),
    }));
    return { maxY, pointsRemaining, pointsIdeal, xForIndex };
  }, [days, totalScope, innerW, innerH]);

  const linePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${CHART.w} ${CHART.h}`}
      className="max-w-3xl text-gray-600"
      role="img"
      aria-label="Sprint burndown chart"
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
      <text
        x={CHART.left - 8}
        y={CHART.top + 4}
        fontSize={10}
        textAnchor="end"
        fill="currentColor"
      >
        {Math.round(maxY)}
      </text>
      <text
        x={CHART.left - 8}
        y={CHART.top + innerH}
        fontSize={10}
        textAnchor="end"
        fill="currentColor"
      >
        0
      </text>
      {days.length > 0 && (
        <>
          <path
            d={linePath(pointsIdeal)}
            fill="none"
            stroke="rgb(148 163 184)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <path
            d={linePath(pointsRemaining)}
            fill="none"
            stroke="rgb(59 130 246)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {days.map((d, i) => (
            <text
              key={d.date}
              x={xForIndex(i)}
              y={CHART.h - 6}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              className="opacity-70"
            >
              {d.date.slice(5)}
            </text>
          ))}
        </>
      )}
    </svg>
  );
}

function BurnupScopeNarrative({ data }: { data: SprintBurnupDto }) {
  const changes = data.scopeChanges ?? [];
  const initial =
    data.initialScope ?? data.days[0]?.scopeTotal ?? 0;

  if (changes.length === 0) {
    return (
      <p className="text-xs text-gray-500 max-w-xl">
        Initial committed scope: <strong>{initial}</strong> pts. No mid-sprint scope shifts detected
        between consecutive days (from daily snapshots when stored).
      </p>
    );
  }

  return (
    <div className="text-xs text-gray-600 space-y-2 max-w-xl">
      <p>
        Started at <strong>{initial}</strong> pts.{' '}
        <span className="text-amber-800">Scope changed on {changes.length} day(s):</span>
      </p>
      <ul className="list-disc list-inside space-y-0.5 text-gray-700">
        {changes.map((c) => (
          <li key={c.date}>
            <span className="font-medium tabular-nums">{c.date}</span>:{' '}
            {c.delta > 0 ? '+' : ''}
            {c.delta} pts → total <strong>{c.scopeAfter}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BurnupChart({ data }: { data: SprintBurnupDto }) {
  const { days, totalScope } = data;
  const scopeChangeDates = useMemo(
    () => new Set((data.scopeChanges ?? []).map((c) => c.date)),
    [data.scopeChanges],
  );
  const innerW = CHART.w - CHART.left - CHART.right;
  const innerH = CHART.h - CHART.top - CHART.bottom;

  const { maxY, pointsScope, pointsCompleted, xForIndex } = useMemo(() => {
    if (days.length === 0) {
      return {
        maxY: 1,
        pointsScope: [] as { x: number; y: number }[],
        pointsCompleted: [] as { x: number; y: number }[],
        xForIndex: (_i: number) => 0,
      };
    }
    const maxY = Math.max(
      totalScope,
      ...days.map((d) => Math.max(d.scopeTotal, d.completedCumulative)),
      1,
    );
    const n = days.length;
    const xForIndex = (i: number) =>
      CHART.left + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
    const yForVal = (v: number) => CHART.top + innerH * (1 - v / maxY);
    const pointsScope = days.map((d, i) => ({
      x: xForIndex(i),
      y: yForVal(d.scopeTotal),
    }));
    const pointsCompleted = days.map((d, i) => ({
      x: xForIndex(i),
      y: yForVal(d.completedCumulative),
    }));
    return { maxY, pointsScope, pointsCompleted, xForIndex };
  }, [days, totalScope, innerW, innerH]);

  const linePath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${CHART.w} ${CHART.h}`}
      className="max-w-3xl text-gray-600"
      role="img"
      aria-label="Sprint burnup chart"
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
      <text
        x={CHART.left - 8}
        y={CHART.top + 4}
        fontSize={10}
        textAnchor="end"
        fill="currentColor"
      >
        {Math.round(maxY)}
      </text>
      <text
        x={CHART.left - 8}
        y={CHART.top + innerH}
        fontSize={10}
        textAnchor="end"
        fill="currentColor"
      >
        0
      </text>
      {days.length > 0 && (
        <>
          <path
            d={linePath(pointsScope)}
            fill="none"
            stroke="rgb(100 116 139)"
            strokeWidth={2}
            strokeDasharray="5 3"
          />
          <path
            d={linePath(pointsCompleted)}
            fill="none"
            stroke="rgb(16 185 129)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {days.map((d, i) =>
            scopeChangeDates.has(d.date) ? (
              <circle
                key={`sc-${d.date}`}
                cx={pointsScope[i]?.x ?? xForIndex(i)}
                cy={pointsScope[i]?.y ?? CHART.top + innerH}
                r={5}
                fill="rgb(245 158 11)"
                stroke="white"
                strokeWidth={1.5}
              >
                <title>Committed scope changed on {d.date}</title>
              </circle>
            ) : null,
          )}
          {days.map((d, i) => (
            <text
              key={d.date}
              x={xForIndex(i)}
              y={CHART.h - 6}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              className="opacity-70"
            >
              {d.date.slice(5)}
            </text>
          ))}
        </>
      )}
    </svg>
  );
}

const VEL = { w: 720, h: 200, top: 12, right: 16, bottom: 52, left: 8 };

function VelocityBars({ data }: { data: ProjectSprintVelocityDto }) {
  const ordered = useMemo(
    () => [...data.sprints].reverse(),
    [data.sprints],
  );
  const maxPts = useMemo(
    () => Math.max(1, ...ordered.map((b) => b.completedPoints)),
    [ordered],
  );
  const innerW = VEL.w - VEL.left - VEL.right;
  const innerH = VEL.h - VEL.top - VEL.bottom;
  const n = ordered.length;
  const gap = n > 0 ? Math.min(8, innerW / (n * 8)) : 0;
  const barW = n > 0 ? (innerW - gap * (n - 1)) / n : 0;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${VEL.w} ${VEL.h}`}
      className="max-w-3xl text-gray-600"
      role="img"
      aria-label="Sprint velocity chart"
    >
      <line
        x1={VEL.left}
        y1={VEL.top + innerH}
        x2={VEL.left + innerW}
        y2={VEL.top + innerH}
        stroke="currentColor"
        strokeOpacity={0.2}
      />
      {ordered.map((b, i) => {
        const h = innerH * (b.completedPoints / maxPts);
        const x = VEL.left + i * (barW + gap);
        const y = VEL.top + innerH - h;
        return (
          <g key={b.sprintId}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0)}
              rx={3}
              fill="rgb(16 185 129)"
              fillOpacity={0.85}
            />
            <title>
              {b.name}: {b.completedPoints} pts ({b.completedTaskCount} tasks) — {b.startDate} →{' '}
              {b.endDate}
            </title>
            <text
              x={x + barW / 2}
              y={VEL.h - 28}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              className="opacity-80"
            >
              {b.name.length > 14 ? `${b.name.slice(0, 12)}…` : b.name}
            </text>
            <text
              x={x + barW / 2}
              y={VEL.h - 14}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              className="opacity-60"
            >
              {b.completedPoints}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ProjectBurndownView({ projectId, sprints }: ProjectBurndownViewProps) {
  const sorted = useMemo(
    () => [...sprints].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [sprints],
  );
  const [sprintId, setSprintId] = useState(sorted[0]?.id ?? '');

  useEffect(() => {
    if (sorted.length && !sorted.some((s) => s.id === sprintId)) {
      setSprintId(sorted[0].id);
    }
  }, [sorted, sprintId]);

  const { data, isLoading, isError } = useSprintBurndown(projectId, sprintId || undefined);
  const burnup = useSprintBurnup(projectId, sprintId || undefined);
  const velocity = useProjectSprintVelocity(projectId, 6, sorted.length > 0);

  if (sorted.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Create a sprint from any task’s <strong>Planning</strong> panel to see a burndown chart.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="burndown-sprint" className="text-sm font-medium text-gray-700">
          Sprint
        </label>
        <select
          id="burndown-sprint"
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-[200px]"
          value={sprintId}
          onChange={(e) => setSprintId(e.target.value)}
        >
          {sorted.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.startDate.slice(0, 10)} → {s.endDate.slice(0, 10)})
            </option>
          ))}
        </select>
        {data && (
          <span className="text-xs text-gray-500">
            Scope: <strong>{data.totalScope}</strong> pts (non-cancelled tasks in sprint)
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 max-w-xl">
        <span className="inline-block w-8 h-0.5 bg-blue-500 align-middle mr-1" /> Remaining work
        <span className="inline-block w-8 h-px border-t-2 border-dashed border-gray-400 align-middle ml-4 mr-1" />{' '}
        Ideal trend (linear). Per-day values use stored sprint snapshots when present; otherwise they are
        recomputed from current tasks and completion dates.
      </p>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-600">Could not load burndown. Try another sprint.</p>
      )}
      {data && !isLoading && <BurndownChart data={data} />}

      <section className="pt-10 border-t border-gray-100 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Burnup</h2>
        <p className="text-xs text-gray-500 max-w-xl">
          <span className="inline-block w-8 h-0.5 bg-emerald-500 align-middle mr-1" /> Cumulative
          completed (story points) through each day
          <span className="inline-block w-8 h-px border-t-2 border-dashed border-slate-400 align-middle ml-4 mr-1" />{' '}
          Total scope uses snapshots when stored for that day; otherwise current sprint scope. Completions
          counted from sprint start through each day.
        </p>
        {burnup.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        )}
        {burnup.isError && (
          <p className="text-sm text-red-600">Could not load burnup.</p>
        )}
        {burnup.data && !burnup.isLoading && (
          <div className="space-y-3">
            <BurnupChart data={burnup.data} />
            <BurnupScopeNarrative data={burnup.data} />
          </div>
        )}
      </section>

      <section className="pt-10 border-t border-gray-100 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Velocity</h2>
        <p className="text-xs text-gray-500 max-w-xl">
          Story points from tasks marked <strong>DONE</strong> during each sprint’s dates (still on that
          sprint). Last six sprints by end date. Average:{' '}
          {velocity.data ? (
            <strong>{velocity.data.averageCompletedPoints}</strong>
          ) : (
            '—'
          )}{' '}
          pts/sprint.
        </p>
        {velocity.isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        )}
        {velocity.isError && (
          <p className="text-sm text-red-600">Could not load velocity.</p>
        )}
        {velocity.data && !velocity.isLoading && velocity.data.sprints.length > 0 && (
          <VelocityBars data={velocity.data} />
        )}
        {velocity.data && !velocity.isLoading && velocity.data.sprints.length === 0 && (
          <p className="text-sm text-gray-500">No sprints yet.</p>
        )}
      </section>
    </div>
  );
}
