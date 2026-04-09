import type { ProjectColor } from '../../types';
import { ScheduleProgramDashboard } from './ScheduleProgramDashboard';
import { Button } from '../ui';

interface ScheduleProgramPanelProps {
  workspaceId: string;
  programId: string;
  active: boolean;
  projectIds: string[];
  projectColorById?: Map<string, ProjectColor>;
}

/**
 * Embedded program analytics (workspace settings). Loads data only when `active`.
 * For the full experience use the Programs command center (`/programs/:id`).
 */
export function ScheduleProgramPanel({
  workspaceId,
  programId,
  active,
  projectIds,
  projectColorById,
}: ScheduleProgramPanelProps) {
  if (!active) return null;
  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <ScheduleProgramDashboard
        workspaceId={workspaceId}
        programId={programId}
        projectIds={projectIds}
        dense
        projectColorById={projectColorById}
      />
    </div>
  );
}

export function ScheduleProgramToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Button type="button" variant="secondary" className="text-xs" onClick={onToggle}>
      {expanded ? 'Hide analytics' : 'Show analytics'}
    </Button>
  );
}
