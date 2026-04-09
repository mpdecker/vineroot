import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ProjectCriticalPathDto, ProjectScheduleNetworkDto } from '@vineroot/shared-types';
import { api } from '../../lib/api';
import { useUIStore } from '../../stores/ui.store';

interface ProjectNetworkViewProps {
  projectId: string;
  workspaceId: string;
}

export function ProjectNetworkView({ projectId, workspaceId }: ProjectNetworkViewProps) {
  const [data, setData] = useState<ProjectScheduleNetworkDto | null>(null);
  const [cp, setCp] = useState<ProjectCriticalPathDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const openTask = useUIStore((s) => s.openTask);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .get<ProjectScheduleNetworkDto>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/network`,
      )
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setErr(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load schedule network.');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    void api
      .get<ProjectCriticalPathDto>(
        `/workspaces/${workspaceId}/projects/${projectId}/schedule/critical-path`,
      )
      .then((res) => {
        if (!cancelled) setCp(res.data);
      })
      .catch(() => {
        if (!cancelled) setCp(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceId]);

  const drivingEdgeKeys = useMemo(() => {
    const s = new Set<string>();
    for (const e of cp?.drivingEdges ?? []) {
      s.add(`${e.fromTaskId}\t${e.toTaskId}`);
    }
    return s;
  }, [cp]);

  const layout = useMemo(() => {
    if (!data?.nodes.length) {
      return {
        positions: new Map<string, { x: number; y: number }>(),
        w: 400,
        h: 280,
        nodeW: 104,
        nodeH: 36,
      };
    }
    const preds = new Map<string, string[]>();
    for (const n of data.nodes) preds.set(n.id, []);
    for (const e of data.edges) {
      if (!preds.has(e.toTaskId)) preds.set(e.toTaskId, []);
      preds.get(e.toTaskId)!.push(e.fromTaskId);
    }
    const level = new Map<string, number>();
    for (const n of data.nodes) level.set(n.id, 0);
    for (let pass = 0; pass < data.nodes.length + 2; pass++) {
      for (const n of data.nodes) {
        const ps = preds.get(n.id) ?? [];
        const L =
          ps.length === 0 ? 0 : Math.max(...ps.map((p) => level.get(p) ?? 0)) + 1;
        level.set(n.id, L);
      }
    }
    const byLevel = new Map<number, string[]>();
    let maxL = 0;
    for (const n of data.nodes) {
      const L = level.get(n.id) ?? 0;
      maxL = Math.max(maxL, L);
      if (!byLevel.has(L)) byLevel.set(L, []);
      byLevel.get(L)!.push(n.id);
    }
    const nodeW = 104;
    const nodeH = 36;
    const colGap = 48;
    const rowGap = 12;
    const positions = new Map<string, { x: number; y: number }>();
    for (let L = 0; L <= maxL; L++) {
      const ids = byLevel.get(L) ?? [];
      ids.forEach((id, i) => {
        positions.set(id, {
          x: L * (nodeW + colGap) + 20,
          y: i * (nodeH + rowGap) + 20,
        });
      });
    }
    const maxPerLevel = Math.max(1, ...[...byLevel.values()].map((a) => a.length));
    const w = (maxL + 1) * (nodeW + colGap) + 40;
    const h = maxPerLevel * (nodeH + rowGap) + 40;
    return { positions, w, h, nodeW, nodeH };
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-16 text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }
  if (err) {
    return <div className="p-6 text-sm text-red-600">{err}</div>;
  }
  if (!data?.nodes.length) {
    return (
      <div className="p-6 text-sm text-gray-500">No tasks in this project.</div>
    );
  }

  const { positions, w, h, nodeW, nodeH } = layout;
  const markerId = `network-arrow-${projectId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      <div className="px-6 py-3 border-b border-gray-200 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Network (PERT-style)</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Predecessor → successor. Arrow color: dark amber = driving (tight on forward pass); slate =
          other links.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-8 h-0.5 rounded-full bg-amber-600" aria-hidden />
            Driving
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-8 h-0.5 rounded-full bg-slate-400" aria-hidden />
            Non-driving
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-50/60">
        <svg
          width={w}
          height={h}
          className="bg-white rounded-lg border border-gray-200 shadow-sm"
          role="img"
          aria-label="Task dependency network"
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="rgb(100 116 139)" />
            </marker>
          </defs>
          {data.edges.map((e, i) => {
            const a = positions.get(e.fromTaskId);
            const b = positions.get(e.toTaskId);
            if (!a || !b) return null;
            const x1 = a.x + nodeW;
            const y1 = a.y + nodeH / 2;
            const x2 = b.x;
            const y2 = b.y + nodeH / 2;
            const mid = (x1 + x2) / 2;
            const driving = drivingEdgeKeys.has(`${e.fromTaskId}\t${e.toTaskId}`);
            const lagUnit = e.lagIsElapsed ? 'elapsed d' : 'working d';
            const edgeTitle = `${e.linkType} · lag ${e.lagDays} ${lagUnit}${driving ? ' · driving' : ''}`;
            return (
              <path
                key={`${e.fromTaskId}-${e.toTaskId}-${i}`}
                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={driving ? 'rgb(180 83 9)' : 'rgb(148 163 184)'}
                strokeWidth={driving ? 2.5 : 1.5}
                markerEnd={`url(#${markerId})`}
              >
                <title>{edgeTitle}</title>
              </path>
            );
          })}
          {data.nodes.map((n) => {
            const p = positions.get(n.id);
            if (!p) return null;
            const short =
              n.title.length > 16 ? `${n.title.slice(0, 14)}…` : n.title;
            return (
              <g
                key={n.id}
                className="cursor-pointer"
                onClick={() => openTask(n.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    openTask(n.id);
                  }
                }}
              >
                <rect
                  x={p.x}
                  y={p.y}
                  width={nodeW}
                  height={nodeH}
                  rx={6}
                  fill="rgb(248 250 252)"
                  stroke="rgb(203 213 225)"
                  className="hover:stroke-brand-500"
                />
                <text
                  x={p.x + 8}
                  y={p.y + nodeH / 2 + 4}
                  fill="rgb(30 41 59)"
                  fontSize={10}
                  fontWeight={500}
                >
                  {short}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
