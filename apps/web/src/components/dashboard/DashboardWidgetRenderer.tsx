import type { ComponentType } from 'react';
import type { DashboardWidget as DW, DashboardWidgetType } from '../../types';
import { WIDGET_TYPE_ORDER } from './widget-creation-params';
import { TasksByStatusWidget } from './widgets/TasksByStatusWidget';
import { ProjectSummaryWidget } from './widgets/ProjectSummaryWidget';
import { NumberMetricWidget } from './widgets/NumberMetricWidget';
import { AgentSlotWidget } from './widgets/AgentSlotWidget';
import { TextNoteWidget } from './widgets/TextNoteWidget';
import { ProjectCfdWidget } from './widgets/ProjectCfdWidget';
import { ProjectEvmWidget } from './widgets/ProjectEvmWidget';
import { PortfolioActiveSprintsWidget } from './widgets/PortfolioActiveSprintsWidget';
import { PortfolioSprintVelocityWidget } from './widgets/PortfolioSprintVelocityWidget';

const KNOWN_WIDGET_TYPES = new Set<string>(WIDGET_TYPE_ORDER);

/** Coerce API/JSON values (trimmed strings, boxed String objects) to a known widget type. */
export function normalizeDashboardWidgetType(raw: unknown): DashboardWidgetType | null {
  if (raw == null) return null;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  return KNOWN_WIDGET_TYPES.has(s) ? (s as DashboardWidgetType) : null;
}

const WIDGET_COMPONENTS: Record<DashboardWidgetType, ComponentType<{ widget: DW }>> = {
  TASKS_BY_STATUS: TasksByStatusWidget,
  PROJECT_SUMMARY: ProjectSummaryWidget,
  PROJECT_CFD: ProjectCfdWidget,
  PROJECT_EVM: ProjectEvmWidget,
  PORTFOLIO_ACTIVE_SPRINTS: PortfolioActiveSprintsWidget,
  PORTFOLIO_SPRINT_VELOCITY: PortfolioSprintVelocityWidget,
  NUMBER_METRIC: NumberMetricWidget,
  AGENT_SLOT: AgentSlotWidget,
  TEXT_NOTE: TextNoteWidget,
};

export interface DashboardWidgetRendererProps {
  widget: DW;
}

export function DashboardWidgetRenderer({ widget }: DashboardWidgetRendererProps) {
  const type = normalizeDashboardWidgetType(widget.type);
  if (!type) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Unknown widget type: {String(widget.type ?? '')}
      </div>
    );
  }
  const Comp = WIDGET_COMPONENTS[type];
  return <Comp widget={widget} />;
}
