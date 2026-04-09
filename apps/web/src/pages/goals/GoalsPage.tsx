import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useWorkspaceStore } from '../../stores/workspace.store';
import {
  useGoals,
  useCreateGoal,
  useDeleteGoal,
  useCreateGoalMetric,
  useRecomputeGoalMetric,
} from '../../hooks/useGoals';
import { CreateGoalModal } from '../../components/goals/CreateGoalModal';
import { Button } from '../../components/ui';
import type { GoalMetricDefinition } from '@vineroot/shared-types';
import { GoalMetricType } from '@vineroot/shared-types';

export default function GoalsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const wid = currentWorkspace?.id;
  const { data: goals, isLoading } = useGoals(wid);
  const { mutate: createGoal, isPending: creating } = useCreateGoal(wid);
  const { mutate: deleteGoal } = useDeleteGoal(wid);
  const { mutate: addMetric, isPending: addingMetric } = useCreateGoalMetric(wid);
  const { mutate: recomputeMetric, isPending: recomputing } = useRecomputeGoalMetric(wid);
  const [createOpen, setCreateOpen] = useState(false);
  const [metricGoalId, setMetricGoalId] = useState<string | null>(null);
  const [metricName, setMetricName] = useState('');
  const [metricTarget, setMetricTarget] = useState('100');
  const [metricDefinitionJson, setMetricDefinitionJson] = useState('');
  const [metricDefError, setMetricDefError] = useState('');

  if (!currentWorkspace) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">Select a workspace in the sidebar to view goals.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Goals</h1>
          <p className="text-gray-600 mt-1">
            Track outcomes and metrics for {currentWorkspace.name}.
          </p>
        </div>
        <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          New goal
        </Button>
      </div>

      {!goals?.length ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No goals yet. Create one to align the team on measurable outcomes.
        </div>
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => (
            <li
              key={g.id}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{g.name}</h2>
                  {g.description && (
                    <p className="text-sm text-gray-600 mt-1">{g.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Status: {g.status}
                    {g.dueDate && ` · Due ${format(new Date(g.dueDate), 'MMM d, yyyy')}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteGoal(g.id)}
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  aria-label="Delete goal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {g.metrics && g.metrics.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Metrics
                  </h3>
                  <ul className="space-y-2">
                    {g.metrics.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-col gap-1 text-sm bg-gray-50 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-800">{m.name}</span>
                          <span className="text-gray-600 shrink-0">
                            {m.current} / {m.target}
                            {m.unit ? ` ${m.unit}` : ''}
                            <span className="text-gray-400 ml-2">({m.type})</span>
                          </span>
                        </div>
                        {m.definition && (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded bg-brand-50 text-brand-800 px-1.5 py-0.5">
                              Computed · {m.definition.kind}
                            </span>
                            {m.lastComputedAt && (
                              <span className="text-gray-500">
                                Updated {format(new Date(m.lastComputedAt), 'MMM d, HH:mm')}
                              </span>
                            )}
                            <button
                              type="button"
                              className="text-brand-600 hover:underline disabled:opacity-50"
                              disabled={recomputing}
                              onClick={() => recomputeMetric(m.id)}
                            >
                              Recompute now
                            </button>
                          </div>
                        )}
                        {m.lastError && (
                          <p className="text-xs text-red-600">{m.lastError}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100">
                {metricGoalId === g.id ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setMetricDefError('');
                      const t = parseFloat(metricTarget);
                      if (!metricName.trim() || Number.isNaN(t)) return;
                      let definition: GoalMetricDefinition | undefined;
                      if (metricDefinitionJson.trim()) {
                        try {
                          definition = JSON.parse(
                            metricDefinitionJson,
                          ) as GoalMetricDefinition;
                        } catch {
                          setMetricDefError('Definition must be valid JSON.');
                          return;
                        }
                      }
                      addMetric({
                        goalId: g.id,
                        body: {
                          name: metricName.trim(),
                          type: definition ? GoalMetricType.NUMBER : GoalMetricType.PERCENT,
                          target: t,
                          ...(definition ? { definition } : {}),
                        },
                      });
                      setMetricName('');
                      setMetricTarget('100');
                      setMetricDefinitionJson('');
                      setMetricDefError('');
                      setMetricGoalId(null);
                    }}
                  >
                    <input
                      value={metricName}
                      onChange={(e) => setMetricName(e.target.value)}
                      placeholder="Metric name"
                      className="flex-1 min-w-[140px] border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      value={metricTarget}
                      onChange={(e) => setMetricTarget(e.target.value)}
                      className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <textarea
                      value={metricDefinitionJson}
                      onChange={(e) => setMetricDefinitionJson(e.target.value)}
                      placeholder='Optional JSON definition, e.g. {"kind":"TASK_COUNT","statuses":["DONE"],"period":{"preset":"CURRENT_QUARTER"}}'
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-mono"
                    />
                    {metricDefError && (
                      <p className="text-xs text-red-600 w-full">{metricDefError}</p>
                    )}
                    <Button type="submit" size="sm" disabled={addingMetric}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setMetricGoalId(null)}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setMetricGoalId(g.id)}
                  >
                    Add metric
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateGoalModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) =>
          createGoal(body, {
            onSuccess: () => setCreateOpen(false),
          })
        }
        isPending={creating}
      />
    </div>
  );
}
