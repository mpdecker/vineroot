import type { DashboardWidgetType } from '@vineroot/shared-types';

export interface DashboardTemplateWidgetSeed {
  type: DashboardWidgetType;
  title: string;
  sortOrder: number;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  config: Record<string, unknown>;
}

export interface DashboardTemplateDefinition {
  id: string;
  name: string;
  description: string;
  layoutMeta?: Record<string, unknown>;
  widgets: DashboardTemplateWidgetSeed[];
}

export const DASHBOARD_TEMPLATES: DashboardTemplateDefinition[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Empty dashboard — add widgets from scratch',
    layoutMeta: { templateId: 'blank', version: 1 },
    widgets: [],
  },
  {
    id: 'workspace_overview',
    name: 'Workspace overview',
    description: 'Tasks by status plus open, completed, and created KPIs',
    layoutMeta: { templateId: 'workspace_overview', version: 1 },
    widgets: [
      {
        type: 'TASKS_BY_STATUS',
        title: 'Tasks by status',
        sortOrder: 0,
        gridX: 0,
        gridY: 0,
        gridW: 8,
        gridH: 3,
        config: { chartStyle: 'bar' },
      },
      {
        type: 'NUMBER_METRIC',
        title: 'Open tasks',
        sortOrder: 1,
        gridX: 8,
        gridY: 0,
        gridW: 4,
        gridH: 1,
        config: {
          metric: 'OPEN_TASKS',
          label: 'Open tasks',
          reportingFilters: {},
          displayFormat: 'integer',
        },
      },
      {
        type: 'NUMBER_METRIC',
        title: 'Completed',
        sortOrder: 2,
        gridX: 8,
        gridY: 1,
        gridW: 4,
        gridH: 1,
        config: {
          metric: 'COMPLETED_IN_PERIOD',
          label: 'Completed in period',
          reportingFilters: {},
          displayFormat: 'integer',
          chartMode: 'sparkline',
        },
      },
      {
        type: 'NUMBER_METRIC',
        title: 'Created',
        sortOrder: 3,
        gridX: 8,
        gridY: 2,
        gridW: 4,
        gridH: 1,
        config: {
          metric: 'CREATED_IN_PERIOD',
          label: 'Created in period',
          reportingFilters: {},
          displayFormat: 'integer',
        },
      },
    ],
  },
  {
    id: 'executive_kpis',
    name: 'Executive KPIs',
    description: 'Four headline metrics in one row',
    layoutMeta: { templateId: 'executive_kpis', version: 1 },
    widgets: [
      {
        type: 'NUMBER_METRIC',
        title: 'Open',
        sortOrder: 0,
        gridX: 0,
        gridY: 0,
        gridW: 3,
        gridH: 2,
        config: {
          metric: 'OPEN_TASKS',
          label: 'Open work items',
          reportingFilters: {},
          displayFormat: 'integer',
        },
      },
      {
        type: 'NUMBER_METRIC',
        title: 'Throughput',
        sortOrder: 1,
        gridX: 3,
        gridY: 0,
        gridW: 3,
        gridH: 2,
        config: {
          metric: 'COMPLETED_IN_PERIOD',
          label: 'Completed in period',
          reportingFilters: {},
          displayFormat: 'integer',
          chartMode: 'sparkline',
        },
      },
      {
        type: 'NUMBER_METRIC',
        title: 'Lead time',
        sortOrder: 2,
        gridX: 6,
        gridY: 0,
        gridW: 3,
        gridH: 2,
        config: {
          metric: 'MEDIAN_LEAD_TIME_DAYS',
          label: 'Median lead time (days)',
          reportingFilters: {},
          displayFormat: 'decimal',
        },
      },
      {
        type: 'NUMBER_METRIC',
        title: 'Cycle time',
        sortOrder: 3,
        gridX: 9,
        gridY: 0,
        gridW: 3,
        gridH: 2,
        config: {
          metric: 'MEDIAN_CYCLE_TIME_DAYS',
          label: 'Median cycle (days)',
          reportingFilters: {},
          displayFormat: 'decimal',
        },
      },
      {
        type: 'TASKS_BY_STATUS',
        title: 'Distribution',
        sortOrder: 4,
        gridX: 0,
        gridY: 2,
        gridW: 12,
        gridH: 3,
        config: { chartStyle: 'horizontalBar' },
      },
    ],
  },
];

const TEMPLATE_BY_ID = new Map(DASHBOARD_TEMPLATES.map((t) => [t.id, t]));

export function getDashboardTemplate(id: string): DashboardTemplateDefinition | undefined {
  return TEMPLATE_BY_ID.get(id);
}

export function listDashboardTemplateSummaries(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return DASHBOARD_TEMPLATES.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}
