import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { EpicRollupDto } from '@vineroot/shared-types';
import { Project, Sprint, Task } from '../../types';
import type { EpicFilterValue } from '../../lib/filterSectionsByEpic';
import { useUIStore } from '../../stores/ui.store';
import type { SprintFilterValue } from '../../lib/filterSectionsBySprint';
import { Button } from '../ui';
import { Share2, Filter, Settings, Copy, ClipboardList } from 'lucide-react';
import { ProjectEditModal } from './ProjectEditModal';
import { useDuplicateProject } from '../../hooks/useProjects';

const COLOR_HEX: Record<string, string> = {
  BLUE: '#3b82f6',
  GREEN: '#22c55e',
  RED: '#ef4444',
  ORANGE: '#f97316',
  YELLOW: '#eab308',
  TEAL: '#14b8a6',
  INDIGO: '#6366f1',
  PURPLE: '#a855f7',
  PINK: '#ec4899',
  GRAY: '#6b7280',
};

interface ProjectHeaderProps {
  project: Project;
  currentView: string;
  /** Primary workspace for API routes (duplicate, etc.). */
  workspaceId?: string;
  /** List/board/backlog/sprint-board: hide subtask trees (sessionStorage per project). */
  rootsOnly?: boolean;
  onRootsOnlyChange?: (value: boolean) => void;
  /** List/board/timeline/calendar: filter roots by sprint (sessionStorage per project). */
  sprintFilter?: SprintFilterValue;
  onSprintFilterChange?: (value: SprintFilterValue) => void;
  sprints?: Sprint[];
  /** Tasks with workItemType EPIC (for list/board/timeline/calendar filter). */
  epicTasks?: Pick<Task, 'id' | 'title'>[];
  /** Optional roll-up stats for epic dropdown labels (descendant tasks only). */
  epicRollups?: Record<string, EpicRollupDto>;
  epicFilter?: EpicFilterValue;
  onEpicFilterChange?: (value: EpicFilterValue) => void;
  /** Opens saved views / advanced filters (incl. timeline, calendar, workload). */
  onOpenSavedViews?: () => void;
  /** On Sprint board tab: only concrete sprints (no All / Backlog). */
  sprintSelectMode?: 'full' | 'sprint-only';
}

export function ProjectHeader({
  project,
  currentView,
  workspaceId,
  rootsOnly = false,
  onRootsOnlyChange,
  sprintFilter = 'all',
  onSprintFilterChange,
  sprints = [],
  epicTasks = [],
  epicRollups,
  epicFilter = 'all',
  onEpicFilterChange,
  onOpenSavedViews,
  sprintSelectMode = 'full',
}: ProjectHeaderProps) {
  const openTask = useUIStore((s) => s.openTask);
  const [editOpen, setEditOpen] = useState(false);
  const navigate = useNavigate();
  const { mutate: duplicateProject, isPending: duplicating } = useDuplicateProject();
  const views = [
    { name: 'List', path: 'list' },
    { name: 'Board', path: 'board' },
    { name: 'Backlog', path: 'backlog' },
    { name: 'Sprint', path: 'sprint-board' },
    { name: 'Roadmap', path: 'roadmap' },
    { name: 'Epics', path: 'epics' },
    { name: 'Timeline', path: 'timeline' },
    { name: 'Calendar', path: 'calendar' },
    { name: 'Burndown', path: 'burndown' },
    { name: 'Flow', path: 'flow' },
    { name: 'Workload', path: 'workload' },
    { name: 'Activity', path: 'activity' },
  ];

  const sprintFilterViews = [
    'list',
    'board',
    'backlog',
    'sprint-board',
    'roadmap',
    'timeline',
    'calendar',
    'workload',
  ];
  const showSprintFilter =
    currentView !== 'backlog' &&
    sprintFilterViews.includes(currentView) &&
    onSprintFilterChange;
  const showEpicFilter =
    sprintFilterViews.includes(currentView) &&
    onEpicFilterChange &&
    epicTasks.length > 0;

  return (
    <div className="bg-white border-b border-gray-200 p-6 space-y-4">
      <ProjectEditModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
      />
      {/* Project info */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-6 h-6 rounded-lg"
            style={{
              backgroundColor: COLOR_HEX[project.color] ?? '#3b82f6',
            }}
          />
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        </div>
        {project.description && (
          <p className="text-sm text-gray-600">{project.description}</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* View tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {views.map((view) => (
            <NavLink
              key={view.path}
              to={`/projects/${project.id}/${view.path}`}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'text-brand-600 border-brand-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`
              }
            >
              {view.name}
            </NavLink>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {showSprintFilter &&
            (sprintSelectMode === 'sprint-only' && sprints.length === 0 ? (
              <span className="text-sm text-gray-500 whitespace-nowrap">No sprints yet</span>
            ) : (
              <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                <span className="text-gray-500">Sprint</span>
                <select
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-[160px]"
                  value={sprintFilter}
                  onChange={(e) =>
                    onSprintFilterChange!(e.target.value as SprintFilterValue)
                  }
                >
                  {sprintSelectMode === 'full' && (
                    <>
                      <option value="all">All work</option>
                      <option value="backlog">Backlog</option>
                    </>
                  )}
                  {[...sprints]
                    .sort((a, b) => b.startDate.localeCompare(a.startDate))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          {showEpicFilter && (
            <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
              <span className="text-gray-500">Epic</span>
              <select
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-[180px]"
                value={epicFilter}
                onChange={(e) =>
                  onEpicFilterChange!(e.target.value as EpicFilterValue)
                }
              >
                <option value="all">All epics</option>
                {epicTasks.map((e) => {
                  const r = epicRollups?.[e.id];
                  const suffix = r
                    ? ` — ${r.doneCount}/${r.taskCount} done, ${r.storyPointsDone}/${r.storyPointsTotal} pts`
                    : '';
                  const label = e.title.length > 28 ? `${e.title.slice(0, 26)}…` : e.title;
                  return (
                    <option key={e.id} value={e.id} title={`${e.title}${suffix}`}>
                      {label}
                      {suffix}
                    </option>
                  );
                })}
              </select>
            </label>
          )}
          {(currentView === 'list' ||
            currentView === 'board' ||
            currentView === 'backlog' ||
            currentView === 'sprint-board') &&
            onRootsOnlyChange && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={rootsOnly}
                onChange={(e) => onRootsOnlyChange(e.target.checked)}
              />
              Roots only
            </label>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Filter className="w-4 h-4" />}
            onClick={() => onOpenSavedViews?.()}
            disabled={!onOpenSavedViews}
          >
            Filter
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            icon={<ClipboardList className="w-4 h-4" />}
            onClick={() => navigate(`/projects/${project.id}/form`)}
          >
            Form
          </Button>
          {workspaceId && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy className="w-4 h-4" />}
              disabled={duplicating}
              onClick={() =>
                duplicateProject(
                  { workspaceId, projectId: project.id },
                  {
                    onSuccess: (p) => navigate(`/projects/${p.id}/list`),
                  },
                )
              }
            >
              {duplicating ? 'Copying…' : 'Duplicate project'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Settings className="w-4 h-4" />}
            onClick={() => setEditOpen(true)}
          >
            Settings
          </Button>
          <Button variant="primary" size="sm" icon={<Share2 className="w-4 h-4" />}>
            Share
          </Button>
        </div>
      </div>

      {epicFilter !== 'all' && (
        <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-amber-900/70 uppercase tracking-wide">
              Epic focus
            </div>
            <div
              className="font-semibold text-gray-900 truncate"
              title={
                epicRollups?.[epicFilter]?.title ??
                epicTasks.find((e) => e.id === epicFilter)?.title
              }
            >
              {epicRollups?.[epicFilter]?.title ??
                epicTasks.find((e) => e.id === epicFilter)?.title ??
                'Epic'}
            </div>
          </div>
          {epicRollups?.[epicFilter] && (
            <div className="flex flex-wrap gap-3 text-xs text-gray-700">
              <span>
                {epicRollups[epicFilter].doneCount}/{epicRollups[epicFilter].taskCount} tasks done
              </span>
              <span>
                {epicRollups[epicFilter].storyPointsDone}/{epicRollups[epicFilter].storyPointsTotal}{' '}
                pts done (tree)
              </span>
            </div>
          )}
          <button
            type="button"
            className="text-sm font-medium text-brand-600 hover:text-brand-700 shrink-0"
            onClick={() => openTask(epicFilter)}
          >
            Open epic
          </button>
        </div>
      )}
    </div>
  );
}
