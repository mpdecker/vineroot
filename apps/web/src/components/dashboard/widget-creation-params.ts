import type { DashboardWidgetType } from '../../types';

/** All form keys used across widget types; each spec only reads what it needs. */
export interface WidgetCreationFormState {
  projectId: string;
  portfolioId: string;
  velocityTake: string;
  noteBody: string;
  metricValue: string;
  metricLabel: string;
  metricMode: 'static' | 'live';
  liveMetric: string;
  displayFormat: string;
  chartMode: string;
  tasksChartStyle: string;
  agentSlotKey: string;
  agentDescription: string;
}

export const defaultWidgetCreationFormState = (): WidgetCreationFormState => ({
  projectId: '',
  portfolioId: '',
  velocityTake: '6',
  noteBody: '',
  metricValue: '0',
  metricLabel: 'Open bugs',
  metricMode: 'static',
  liveMetric: 'OPEN_TASKS',
  displayFormat: '',
  chartMode: '',
  tasksChartStyle: 'bar',
  agentSlotKey: 'primary',
  agentDescription: 'Awaiting agent run.',
});

export type WidgetFieldSpec =
  | { key: 'projectId'; kind: 'projectSelect' }
  | { key: 'portfolioId'; kind: 'portfolioSelect' }
  | {
      key: 'velocityTake';
      kind: 'numberInput';
      label: string;
      min: number;
      max: number;
    }
  | { key: 'noteBody'; kind: 'textarea'; label: string; placeholder?: string }
  | { key: 'numberMetric'; kind: 'numberMetric' }
  | {
      key: 'tasksChartStyle';
      kind: 'select';
      label: string;
      options: { value: string; label: string }[];
    }
  | { key: 'agentSlot'; kind: 'agentSlot' };

export interface WidgetCreationSpec {
  label: string;
  hint: string;
  gridW: number;
  gridH: number;
  fields: readonly WidgetFieldSpec[];
  buildConfig: (s: WidgetCreationFormState) => Record<string, unknown>;
  canSubmit: (s: WidgetCreationFormState) => boolean;
}

const LIVE_METRIC_OPTIONS: { value: string; label: string }[] = [
  { value: 'OPEN_TASKS', label: 'Open tasks' },
  { value: 'COMPLETED_IN_PERIOD', label: 'Completed in period' },
  { value: 'CREATED_IN_PERIOD', label: 'Created in period' },
  { value: 'DONE_TASKS', label: 'Done (all statuses filter)' },
  { value: 'IN_PROGRESS_TASKS', label: 'In progress' },
  { value: 'BLOCKED_TASKS', label: 'Blocked' },
  { value: 'TOTAL_TASKS', label: 'Total matching tasks' },
  { value: 'AVG_LEAD_TIME_DAYS', label: 'Avg lead time (days)' },
  { value: 'MEDIAN_LEAD_TIME_DAYS', label: 'Median lead time (days)' },
  { value: 'AVG_CYCLE_TIME_DAYS', label: 'Avg cycle time (days)' },
  { value: 'MEDIAN_CYCLE_TIME_DAYS', label: 'Median cycle time (days)' },
  { value: 'AVG_WEEKLY_THROUGHPUT', label: 'Avg completions / week' },
];

const CHART_STYLE_OPTIONS = [
  { value: 'bar', label: 'Vertical bars' },
  { value: 'horizontalBar', label: 'Horizontal bars' },
  { value: 'pie', label: 'Pie' },
  { value: 'donut', label: 'Donut' },
];

function clampVelocityTake(raw: string): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 6;
  return Math.min(12, Math.max(1, n));
}

export const WIDGET_CREATION_SPECS: Record<DashboardWidgetType, WidgetCreationSpec> = {
  TASKS_BY_STATUS: {
    label: 'Tasks by status',
    hint: 'Bar chart for the workspace',
    gridW: 6,
    gridH: 3,
    fields: [
      {
        key: 'tasksChartStyle',
        kind: 'select',
        label: 'Chart style',
        options: CHART_STYLE_OPTIONS,
      },
    ],
    buildConfig: (s) => ({
      chartStyle: s.tasksChartStyle || 'bar',
    }),
    canSubmit: () => true,
  },

  PROJECT_SUMMARY: {
    label: 'Project summary',
    hint: 'Progress for one project',
    gridW: 4,
    gridH: 2,
    fields: [{ key: 'projectId', kind: 'projectSelect' }],
    buildConfig: (s) => ({ projectId: s.projectId }),
    canSubmit: (s) => !!s.projectId,
  },

  PROJECT_CFD: {
    label: 'Project cumulative flow',
    hint: 'Stacked status counts (90 days)',
    gridW: 6,
    gridH: 3,
    fields: [{ key: 'projectId', kind: 'projectSelect' }],
    buildConfig: (s) => ({ projectId: s.projectId }),
    canSubmit: (s) => !!s.projectId,
  },

  PROJECT_EVM: {
    label: 'Project earned value',
    hint: 'BAC, PV, EV, AC, SPI, CPI from baselines and costs',
    gridW: 4,
    gridH: 2,
    fields: [{ key: 'projectId', kind: 'projectSelect' }],
    buildConfig: (s) => ({ projectId: s.projectId }),
    canSubmit: (s) => !!s.projectId,
  },

  PORTFOLIO_ACTIVE_SPRINTS: {
    label: 'Portfolio active sprints',
    hint: 'Current/planned sprint health per project',
    gridW: 6,
    gridH: 3,
    fields: [{ key: 'portfolioId', kind: 'portfolioSelect' }],
    buildConfig: (s) => ({ portfolioId: s.portfolioId }),
    canSubmit: (s) => !!s.portfolioId,
  },

  PORTFOLIO_SPRINT_VELOCITY: {
    label: 'Portfolio sprint velocity',
    hint: 'Rolling average completed points per project',
    gridW: 6,
    gridH: 3,
    fields: [
      { key: 'portfolioId', kind: 'portfolioSelect' },
      {
        key: 'velocityTake',
        kind: 'numberInput',
        label: 'Sprints in average (1–12)',
        min: 1,
        max: 12,
      },
    ],
    buildConfig: (s) => ({
      portfolioId: s.portfolioId,
      take: clampVelocityTake(s.velocityTake),
    }),
    canSubmit: (s) => !!s.portfolioId,
  },

  NUMBER_METRIC: {
    label: 'Number',
    hint: 'Static value or live workspace KPI from reporting filters',
    gridW: 4,
    gridH: 2,
    fields: [{ key: 'numberMetric', kind: 'numberMetric' }],
    buildConfig: (s) => {
      if (s.metricMode === 'live') {
        const cfg: Record<string, unknown> = {
          metric: s.liveMetric,
        };
        if (s.metricLabel.trim()) {
          cfg.label = s.metricLabel.trim();
        }
        if (s.displayFormat.trim()) {
          cfg.displayFormat = s.displayFormat.trim();
        }
        if (s.chartMode.trim()) {
          cfg.chartMode = s.chartMode.trim();
        }
        return cfg;
      }
      const cfg: Record<string, unknown> = {
        value: Number(s.metricValue) || 0,
        label: s.metricLabel,
      };
      if (s.displayFormat.trim()) {
        cfg.displayFormat = s.displayFormat.trim();
      }
      return cfg;
    },
    canSubmit: (s) => {
      if (s.metricMode === 'live') {
        return !!s.liveMetric;
      }
      return true;
    },
  },

  AGENT_SLOT: {
    label: 'Agent slot',
    hint: 'Placeholder for agent outputs',
    gridW: 4,
    gridH: 2,
    fields: [{ key: 'agentSlot', kind: 'agentSlot' }],
    buildConfig: (s) => ({
      slotKey: s.agentSlotKey.trim() || 'primary',
      description: s.agentDescription.trim() || 'Awaiting agent run.',
    }),
    canSubmit: () => true,
  },

  TEXT_NOTE: {
    label: 'Text note',
    hint: 'Markdown-friendly note',
    gridW: 4,
    gridH: 2,
    fields: [{ key: 'noteBody', kind: 'textarea', label: 'Note', placeholder: 'Context for the team…' }],
    buildConfig: (s) => ({ body: s.noteBody }),
    canSubmit: () => true,
  },
};

export const WIDGET_TYPE_ORDER: DashboardWidgetType[] = [
  'TASKS_BY_STATUS',
  'PROJECT_SUMMARY',
  'PROJECT_CFD',
  'PROJECT_EVM',
  'PORTFOLIO_ACTIVE_SPRINTS',
  'PORTFOLIO_SPRINT_VELOCITY',
  'NUMBER_METRIC',
  'AGENT_SLOT',
  'TEXT_NOTE',
];

export function getWidgetCreationSpec(type: DashboardWidgetType): WidgetCreationSpec {
  return WIDGET_CREATION_SPECS[type];
}

/** Export for the live-metric dropdown (modal renders using this list). */
export { LIVE_METRIC_OPTIONS };
