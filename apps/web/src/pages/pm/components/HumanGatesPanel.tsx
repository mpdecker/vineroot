import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { PmHumanGateRow } from '../../../lib/pmSupabase';
import { getPmSupabase } from '../../../lib/pmSupabase';

type Props = {
  projectId: string;
  gates: PmHumanGateRow[];
  onResolved: () => void;
};

export function HumanGatesPanel({ projectId, gates, onResolved }: Props) {
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [selectedById, setSelectedById] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (gate: PmHumanGateRow) => {
    const decision = selectedById[gate.id];
    if (!decision) return;
    const sb = getPmSupabase();
    if (!sb) return;
    const notes = notesById[gate.id] ?? '';
    if (
      gate.gate_type === 'BLOCKED_HUMAN_REROUTE' &&
      !notes.trim()
    ) {
      return;
    }
    setBusy(gate.id);
    const { error } = await sb
      .from('human_gates')
      .update({
        decision,
        decision_notes: notes || null,
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', gate.id)
      .eq('status', 'PENDING');
    setBusy(null);
    if (!error) {
      await sb.from('audit_log').insert({
        project_id: projectId,
        gate_id: gate.id,
        event_type: 'HUMAN_DECISION',
        actor: 'human',
        from_value: 'PENDING',
        to_value: 'RESOLVED',
        detail: { decision, notes },
      });
      onResolved();
    }
  };

  if (gates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600">
        No pending human gates
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {gates.map((g) => {
        const options = Array.isArray(g.decision_options)
          ? (g.decision_options as string[])
          : [];
        const age = formatDistanceToNow(new Date(g.created_at), { addSuffix: true });
        const selected = selectedById[g.id];
        const reroute = g.gate_type === 'BLOCKED_HUMAN_REROUTE';
        return (
          <div
            key={g.id}
            className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">
                  {g.gate_type}
                </span>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">{g.context_summary}</p>
                <p className="mt-1 text-xs text-gray-500">Waiting {age}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedById((m) => ({ ...m, [g.id]: opt }))}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    selected === opt
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : g.recommended_option === opt
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100'
                        : 'border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800'
                  }`}
                >
                  {opt}
                  {g.recommended_option === opt ? ' · recommended' : ''}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-xs text-gray-500">Notes {reroute ? '(required)' : '(optional)'}</label>
              <textarea
                className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
                rows={2}
                value={notesById[g.id] ?? ''}
                onChange={(e) =>
                  setNotesById((m) => ({ ...m, [g.id]: e.target.value }))
                }
                placeholder={reroute ? 'Explain reroute…' : 'Rationale…'}
              />
            </div>
            <button
              type="button"
              disabled={!selected || busy === g.id || (reroute && !(notesById[g.id] ?? '').trim())}
              onClick={() => void resolve(g)}
              className="mt-3 rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
            >
              {busy === g.id ? 'Resolving…' : 'Resolve'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
