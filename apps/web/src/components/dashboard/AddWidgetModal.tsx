import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button, Input } from '../ui';
import { useAddDashboardWidget } from '../../hooks/useDashboards';
import { useProjects } from '../../hooks/useProjects';
import { usePortfolios } from '../../hooks/usePortfolios';
import type { DashboardWidgetType } from '../../types';
import { clsx } from 'clsx';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  dashboardId: string;
}

const TYPES: { value: DashboardWidgetType; label: string; hint: string }[] = [
  {
    value: 'TASKS_BY_STATUS',
    label: 'Tasks by status',
    hint: 'Bar chart for the workspace',
  },
  {
    value: 'PROJECT_SUMMARY',
    label: 'Project summary',
    hint: 'Progress for one project',
  },
  {
    value: 'PROJECT_CFD',
    label: 'Project cumulative flow',
    hint: 'Stacked status counts (90 days)',
  },
  {
    value: 'PORTFOLIO_ACTIVE_SPRINTS',
    label: 'Portfolio active sprints',
    hint: 'Current/planned sprint health per project',
  },
  {
    value: 'PORTFOLIO_SPRINT_VELOCITY',
    label: 'Portfolio sprint velocity',
    hint: 'Rolling average completed points per project',
  },
  { value: 'NUMBER_METRIC', label: 'Number', hint: 'Single KPI (editable in config later)' },
  { value: 'AGENT_SLOT', label: 'Agent slot', hint: 'Placeholder for agent outputs' },
  { value: 'TEXT_NOTE', label: 'Text note', hint: 'Markdown-friendly note' },
];

const selectClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

export function AddWidgetModal({
  isOpen,
  onClose,
  workspaceId,
  dashboardId,
}: AddWidgetModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DashboardWidgetType>('TASKS_BY_STATUS');
  const [projectId, setProjectId] = useState('');
  const [portfolioId, setPortfolioId] = useState('');
  const [velocityTake, setVelocityTake] = useState('6');
  const [noteBody, setNoteBody] = useState('');
  const [metricValue, setMetricValue] = useState('0');
  const [metricLabel, setMetricLabel] = useState('Open bugs');
  const { data: projects } = useProjects(workspaceId);
  const { data: portfolios } = usePortfolios(workspaceId);
  const { mutateAsync: addWidget, isPending, error, reset } = useAddDashboardWidget();

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setType('TASKS_BY_STATUS');
      setProjectId('');
      setPortfolioId('');
      setVelocityTake('6');
      setNoteBody('');
      setMetricValue('0');
      setMetricLabel('Open bugs');
      reset();
    }
  }, [isOpen, reset]);

  const defaultTitle = () => {
    const t = TYPES.find((x) => x.value === type);
    return t?.label ?? 'Widget';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const widgetTitle = title.trim() || defaultTitle();
    let config: Record<string, unknown> = {};
    if ((type === 'PROJECT_SUMMARY' || type === 'PROJECT_CFD') && projectId) {
      config = { projectId };
    }
    if (
      (type === 'PORTFOLIO_ACTIVE_SPRINTS' || type === 'PORTFOLIO_SPRINT_VELOCITY') &&
      portfolioId
    ) {
      config = { portfolioId };
      if (type === 'PORTFOLIO_SPRINT_VELOCITY') {
        const n = parseInt(velocityTake, 10);
        config = { portfolioId, take: Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : 6 };
      }
    }
    if (type === 'TEXT_NOTE') config = { body: noteBody };
    if (type === 'NUMBER_METRIC') {
      config = { value: Number(metricValue) || 0, label: metricLabel };
    }
    if (type === 'AGENT_SLOT') config = { slotKey: 'primary', description: 'Awaiting agent run.' };

    try {
      await addWidget({
        workspaceId,
        dashboardId,
        type,
        title: widgetTitle,
        gridW:
          type === 'TASKS_BY_STATUS' ||
          type === 'PROJECT_CFD' ||
          type === 'PORTFOLIO_ACTIVE_SPRINTS' ||
          type === 'PORTFOLIO_SPRINT_VELOCITY'
            ? 6
            : 4,
        gridH:
          type === 'TASKS_BY_STATUS' ||
          type === 'PROJECT_CFD' ||
          type === 'PORTFOLIO_ACTIVE_SPRINTS' ||
          type === 'PORTFOLIO_SPRINT_VELOCITY'
            ? 3
            : 2,
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
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.hint}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={defaultTitle()}
        />

        {(type === 'PROJECT_SUMMARY' || type === 'PROJECT_CFD') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
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
        )}

        {(type === 'PORTFOLIO_ACTIVE_SPRINTS' || type === 'PORTFOLIO_SPRINT_VELOCITY') && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Portfolio</label>
              <select
                value={portfolioId}
                onChange={(e) => setPortfolioId(e.target.value)}
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
            {type === 'PORTFOLIO_SPRINT_VELOCITY' && (
              <Input
                label="Sprints in average (1–12)"
                value={velocityTake}
                onChange={(e) => setVelocityTake(e.target.value)}
                type="number"
                min={1}
                max={12}
              />
            )}
          </div>
        )}

        {type === 'TEXT_NOTE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={4}
              className={clsx(selectClass, 'resize-y')}
              placeholder="Context for the team…"
            />
          </div>
        )}

        {type === 'NUMBER_METRIC' && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Value"
              value={metricValue}
              onChange={(e) => setMetricValue(e.target.value)}
              type="number"
            />
            <Input
              label="Label"
              value={metricLabel}
              onChange={(e) => setMetricLabel(e.target.value)}
            />
          </div>
        )}

        {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isPending}
            disabled={
              ((type === 'PROJECT_SUMMARY' || type === 'PROJECT_CFD') && !projectId) ||
              ((type === 'PORTFOLIO_ACTIVE_SPRINTS' || type === 'PORTFOLIO_SPRINT_VELOCITY') &&
                !portfolioId)
            }
          >
            Add widget
          </Button>
        </div>
      </form>
    </Modal>
  );
}
