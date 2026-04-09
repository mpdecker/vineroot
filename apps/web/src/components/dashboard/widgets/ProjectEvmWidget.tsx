import type { DashboardWidget } from '../../../types';

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtIdx(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function ProjectEvmWidget({ widget }: { widget: DashboardWidget }) {
  const r = widget.resolved ?? {};
  const err = r.error as string | undefined;
  const bac = r.bac as number | undefined;
  const pv = r.pv as number | undefined;
  const ev = r.ev as number | undefined;
  const ac = r.ac as number | undefined;
  const spi = r.spi as number | null | undefined;
  const cpi = r.cpi as number | null | undefined;
  const eac = r.eac as number | null | undefined;

  return (
    <div className="h-full rounded-lg border border-gray-200 bg-white p-3 shadow-sm flex flex-col min-h-[140px]">
      <h3 className="text-sm font-semibold text-gray-900 shrink-0">{widget.title}</h3>
      {err ? (
        <p className="text-sm text-amber-700 mt-2">{err}</p>
      ) : bac === undefined ? (
        <p className="text-xs text-gray-500 mt-2">No EVM data.</p>
      ) : (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-800 flex-1">
          <dt className="text-gray-500">BAC</dt>
          <dd className="font-medium tabular-nums">{fmt(bac)}</dd>
          <dt className="text-gray-500">PV</dt>
          <dd className="tabular-nums">{fmt(pv)}</dd>
          <dt className="text-gray-500">EV</dt>
          <dd className="tabular-nums">{fmt(ev)}</dd>
          <dt className="text-gray-500">AC</dt>
          <dd className="tabular-nums">{fmt(ac)}</dd>
          <dt className="text-gray-500">SPI</dt>
          <dd className="tabular-nums">{fmtIdx(spi ?? undefined)}</dd>
          <dt className="text-gray-500">CPI</dt>
          <dd className="tabular-nums">{fmtIdx(cpi ?? undefined)}</dd>
          <dt className="text-gray-500">EAC</dt>
          <dd className="tabular-nums">{fmt(eac ?? undefined)}</dd>
        </dl>
      )}
    </div>
  );
}
