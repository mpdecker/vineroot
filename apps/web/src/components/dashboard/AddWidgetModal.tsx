import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui';
import { useAddDashboardWidget } from '../../hooks/useDashboards';
import { useProjects } from '../../hooks/useProjects';
import { usePortfolios } from '../../hooks/usePortfolios';
import type { DashboardWidgetType } from '../../types';
import { clsx } from 'clsx';
import {
  defaultWidgetCreationFormState,
  getWidgetCreationSpec,
  LIVE_METRIC_OPTIONS,
  WIDGET_TYPE_ORDER,
  type WidgetCreationFormState,
  type WidgetFieldSpec,
} from './widget-creation-params';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  dashboardId: string;
}

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

function WidgetFieldRenderer({
  field,
  form,
  setForm,
  projects,
  portfolios,
}: {
  field: WidgetFieldSpec;
  form: WidgetCreationFormState;
  setForm: React.Dispatch<React.SetStateAction<WidgetCreationFormState>>;
  projects: { id: string; name: string }[] | undefined;
  portfolios: { id: string; name: string }[] | undefined;
}) {
  switch (field.kind) {
    case 'projectSelect':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm((s) => ({ ...s, projectId: e.target.value }))}
            className={selectClass}
            required
          >
            <option value="">Select project…</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      );
    case 'portfolioSelect':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Portfolio</label>
          <select
            value={form.portfolioId}
            onChange={(e) => setForm((s) => ({ ...s, portfolioId: e.target.value }))}
            className={selectClass}
            required
          >
            <option value="">Select portfolio…</option>
            {(portfolios ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      );
    case 'numberInput':
      return (
        <Input
          label={field.label}
          value={form.velocityTake}
          onChange={(e) => setForm((s) => ({ ...s, velocityTake: e.target.value }))}
          type="number"
          min={field.min}
          max={field.max}
        />
      );
    case 'textarea':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
          <textarea
            value={form.noteBody}
            onChange={(e) => setForm((s) => ({ ...s, noteBody: e.target.value }))}
            rows={4}
            className={clsx(selectClass, 'resize-y')}
            placeholder={field.placeholder}
          />
        </div>
      );
    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
          <select
            value={form.tasksChartStyle}
            onChange={(e) => setForm((s) => ({ ...s, tasksChartStyle: e.target.value }))}
            className={selectClass}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'numberMetric':
      return (
        <div className="space-y-4">
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-2">Source</span>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="metricMode"
                  checked={form.metricMode === 'static'}
                  onChange={() => setForm((s) => ({ ...s, metricMode: 'static' }))}
                />
                Static value
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="metricMode"
                  checked={form.metricMode === 'live'}
                  onChange={() => setForm((s) => ({ ...s, metricMode: 'live' }))}
                />
                Workspace metric
              </label>
            </div>
          </div>
          {form.metricMode === 'live' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Metric</label>
                <select
                  value={form.liveMetric}
                  onChange={(e) => setForm((s) => ({ ...s, liveMetric: e.target.value }))}
                  className={selectClass}
                >
                  {LIVE_METRIC_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Label (optional)"
                value={form.metricLabel}
                onChange={(e) => setForm((s) => ({ ...s, metricLabel: e.target.value }))}
                placeholder="Overrides default label"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Display format
                </label>
                <select
                  value={form.displayFormat}
                  onChange={(e) => setForm((s) => ({ ...s, displayFormat: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Default</option>
                  <option value="integer">Integer</option>
                  <option value="decimal">Decimal (1 place)</option>
                  <option value="percent">Percent (whole)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mini chart</label>
                <select
                  value={form.chartMode}
                  onChange={(e) => setForm((s) => ({ ...s, chartMode: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">None</option>
                  <option value="sparkline">Weekly completions sparkline</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Value"
                value={form.metricValue}
                onChange={(e) => setForm((s) => ({ ...s, metricValue: e.target.value }))}
                type="number"
              />
              <Input
                label="Label"
                value={form.metricLabel}
                onChange={(e) => setForm((s) => ({ ...s, metricLabel: e.target.value }))}
              />
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Display format
                </label>
                <select
                  value={form.displayFormat}
                  onChange={(e) => setForm((s) => ({ ...s, displayFormat: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Default</option>
                  <option value="integer">Integer</option>
                  <option value="decimal">Decimal</option>
                  <option value="percent">Percent</option>
                </select>
              </div>
            </div>
          )}
        </div>
      );
    case 'agentSlot':
      return (
        <div className="space-y-3">
          <Input
            label="Slot key"
            value={form.agentSlotKey}
            onChange={(e) => setForm((s) => ({ ...s, agentSlotKey: e.target.value }))}
            placeholder="primary"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.agentDescription}
              onChange={(e) => setForm((s) => ({ ...s, agentDescription: e.target.value }))}
              rows={2}
              className={clsx(selectClass, 'resize-y')}
            />
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function AddWidgetModal({
  isOpen,
  onClose,
  workspaceId,
  dashboardId,
}: AddWidgetModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DashboardWidgetType>('TASKS_BY_STATUS');
  const [form, setForm] = useState<WidgetCreationFormState>(defaultWidgetCreationFormState);
  const { data: projects } = useProjects(workspaceId);
  const { data: portfolios } = usePortfolios(workspaceId);
  const { mutateAsync: addWidget, isPending, error, reset } = useAddDashboardWidget();

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setType('TASKS_BY_STATUS');
      setForm(defaultWidgetCreationFormState());
      reset();
    }
  }, [isOpen, reset]);

  const spec = getWidgetCreationSpec(type);

  const defaultTitle = () => spec.label;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!spec.canSubmit(form)) return;
    const widgetTitle = title.trim() || defaultTitle();
    const config = spec.buildConfig(form);
    try {
      await addWidget({
        workspaceId,
        dashboardId,
        type,
        title: widgetTitle,
        gridW: spec.gridW,
        gridH: spec.gridH,
        config,
      });
      onClose();
    } catch {
      /* surfaced via error state */
    }
  };

  const errMsg =
    error instanceof Error
      ? error.message
      : (error as unknown as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add widget" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DashboardWidgetType)}
            className={selectClass}
          >
            {WIDGET_TYPE_ORDER.map((t) => {
              const s = getWidgetCreationSpec(t);
              return (
                <option key={t} value={t}>
                  {s.label} — {s.hint}
                </option>
              );
            })}
          </select>
        </div>
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={defaultTitle()}
        />

        <div className="space-y-4">
          {spec.fields.map((field) => (
            <WidgetFieldRenderer
              key={`${field.key}-${field.kind}`}
              field={field}
              form={form}
              setForm={setForm}
              projects={projects}
              portfolios={portfolios}
            />
          ))}
        </div>

        {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={!spec.canSubmit(form)}>
            Add widget
          </Button>
        </div>
      </form>
    </Modal>
  );
}
