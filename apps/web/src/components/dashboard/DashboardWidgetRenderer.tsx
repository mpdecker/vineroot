import type { DashboardWidget as DW } from '../../types';
import { TasksByStatusWidget } from './widgets/TasksByStatusWidget';
import { ProjectSummaryWidget } from './widgets/ProjectSummaryWidget';
import { NumberMetricWidget } from './widgets/NumberMetricWidget';
import { AgentSlotWidget } from './widgets/AgentSlotWidget';
import { TextNoteWidget } from './widgets/TextNoteWidget';
import { ProjectCfdWidget } from './widgets/ProjectCfdWidget';
import { PortfolioActiveSprintsWidget } from './widgets/PortfolioActiveSprintsWidget';
import { PortfolioSprintVelocityWidget } from './widgets/PortfolioSprintVelocityWidget';

export interface DashboardWidgetRendererProps {
  widget: DW;
}

export function DashboardWidgetRenderer({ widget }: DashboardWidgetRendererProps) {
  switch (widget.type) {
    case 'TASKS_BY_STATUS':
      return <TasksByStatusWidget widget={widget} />;
    case 'PROJECT_SUMMARY':
      return <ProjectSummaryWidget widget={widget} />;
    case 'PROJECT_CFD':
      return <ProjectCfdWidget widget={widget} />;
    case 'PORTFOLIO_ACTIVE_SPRINTS':
      return <PortfolioActiveSprintsWidget widget={widget} />;
    case 'PORTFOLIO_SPRINT_VELOCITY':
      return <PortfolioSprintVelocityWidget widget={widget} />;
    case 'NUMBER_METRIC':
      return <NumberMetricWidget widget={widget} />;
    case 'AGENT_SLOT':
      return <AgentSlotWidget widget={widget} />;
    case 'TEXT_NOTE':
      return <TextNoteWidget widget={widget} />;
    default:
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Unknown widget type: {(widget as DW).type}
        </div>
      );
  }
}
