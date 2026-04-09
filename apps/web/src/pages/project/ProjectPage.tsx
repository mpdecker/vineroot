import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { ProjectSavedViewConfigDto } from '@vineroot/shared-types';
import { useProject, useProjectEpicRollups } from '../../hooks/useProjects';
import { useUIStore } from '../../stores/ui.store';
import { ProjectHeader } from '../../components/project/ProjectHeader';
import { ProjectListView } from '../../components/project/ProjectListView';
import { ProjectBoardView } from '../../components/project/ProjectBoardView';
import { ProjectTimelineView } from '../../components/project/ProjectTimelineView';
import { ProjectEpicRoadmapView } from '../../components/project/ProjectEpicRoadmapView';
import { ProjectEpicDashboardView } from '../../components/project/ProjectEpicDashboardView';
import { ProjectCalendarView } from '../../components/project/ProjectCalendarView';
import { ProjectActivityView } from '../../components/project/ProjectActivityView';
import { ProjectBurndownView } from '../../components/project/ProjectBurndownView';
import { ProjectFlowView } from '../../components/project/ProjectFlowView';
import { ProjectWorkloadView } from '../../components/project/ProjectWorkloadView';
import { ProjectNetworkView } from '../../components/project/ProjectNetworkView';
import { ProjectTimephasedView } from '../../components/project/ProjectTimephasedView';
import { ProjectSavedViewsModal } from '../../components/project/ProjectSavedViewsModal';
import { TaskDetail } from '../../components/task/TaskDetail';
import { useAuthStore } from '../../stores/auth.store';
import { getTaskFromSections } from '../../lib/projectTaskTree';
import {
  filterSectionsByEpic,
  listEpicTasks,
  type EpicFilterValue,
} from '../../lib/filterSectionsByEpic';
import {
  filterSectionsBySprint,
  type SprintFilterValue,
} from '../../lib/filterSectionsBySprint';
import type { Section } from '../../types';
import { pickDefaultSprintId } from '../../lib/pickDefaultSprint';
import { sortSectionsByBacklogRank } from '../../lib/sortBacklogRoots';
import {
  filterSectionsBySchedule,
  sortSectionsBySchedule,
  type ListScheduleFilter,
  type ListScheduleSort,
} from '../../lib/filterSectionsBySchedule';
import { useProjectScheduleCriticalPath } from '../../hooks/useProjectScheduleCriticalPath';
import {
  parseTimephasedBasis,
  parseTimephasedGranularity,
  parseTimephasedGridMode,
} from '../../lib/timephasedSearchParams';
import { computeTaskScheduleInsight } from '../../lib/taskScheduleInsight';
import { Loader2 } from 'lucide-react';

function readRootsOnlyFromStorage(key: string): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function readSprintFilter(projectId: string): SprintFilterValue {
  try {
    const v = sessionStorage.getItem(`vineroot:project:${projectId}:sprintFilter`);
    if (v === 'all' || v === 'backlog') return v;
    if (v && v.length >= 8) return v;
  } catch {
    /* ignore */
  }
  return 'all';
}

function readEpicFilter(projectId: string): EpicFilterValue {
  try {
    const v = sessionStorage.getItem(`vineroot:project:${projectId}:epicFilter`);
    if (v == null || v === 'all') return 'all';
    if (v.length >= 8) return v;
  } catch {
    /* ignore */
  }
  return 'all';
}

function readListScheduleFilter(projectId: string): ListScheduleFilter {
  try {
    const v = sessionStorage.getItem(`vineroot:project:${projectId}:listScheduleFilter`);
    if (v === 'critical' || v === 'slack' || v === 'deadline') return v;
  } catch {
    /* ignore */
  }
  return 'all';
}

function readListScheduleSort(projectId: string): ListScheduleSort {
  try {
    const v = sessionStorage.getItem(`vineroot:project:${projectId}:listScheduleSort`);
    if (
      v === 'critical_first' ||
      v === 'slack_desc' ||
      v === 'deadline_breach_first' ||
      v === 'constraint_type'
    ) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return 'none';
}

/** List/board only: hide nested subtasks (dense projects). */
function sectionsRootsOnly(sections: Section[]): Section[] {
  return sections.map((s) => ({
    ...s,
    tasks: (s.tasks ?? []).map((t) => ({ ...t, subtasks: [] })),
  }));
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentView = location.pathname.split('/').pop() || 'list';
  const { data: project, isLoading } = useProject(projectId || '');
  const { activeTaskId, openTask, closeTask } = useUIStore();
  const { user } = useAuthStore();
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [rootsOnly, setRootsOnly] = useState(false);
  const [sprintFilter, setSprintFilter] = useState<SprintFilterValue>('all');
  const [epicFilter, setEpicFilter] = useState<EpicFilterValue>('all');
  const [listScheduleFilter, setListScheduleFilter] = useState<ListScheduleFilter>('all');
  const [listScheduleSort, setListScheduleSort] = useState<ListScheduleSort>('none');

  useEffect(() => {
    if (!project?.id) return;
    const key = `vineroot:project:${project.id}:rootsOnly`;
    setRootsOnly(readRootsOnlyFromStorage(key));
    setSprintFilter(readSprintFilter(project.id));
    setEpicFilter(readEpicFilter(project.id));
    setListScheduleFilter(readListScheduleFilter(project.id));
    setListScheduleSort(readListScheduleSort(project.id));
  }, [project?.id]);

  const epicTasks = useMemo(
    () => listEpicTasks(project?.sections ?? []),
    [project?.sections],
  );

  const { data: epicRollupsData } = useProjectEpicRollups(project?.id);
  const epicRollupById = useMemo(() => {
    if (!epicRollupsData?.epics?.length) return undefined;
    return Object.fromEntries(epicRollupsData.epics.map((e) => [e.epicId, e]));
  }, [epicRollupsData]);

  useEffect(() => {
    if (!project?.id || epicFilter === 'all') return;
    if (!epicTasks.some((e) => e.id === epicFilter)) {
      setEpicFilter('all');
      try {
        sessionStorage.setItem(`vineroot:project:${project.id}:epicFilter`, 'all');
      } catch {
        /* ignore */
      }
    }
  }, [project?.id, epicFilter, epicTasks]);

  const persistRootsOnly = (v: boolean) => {
    if (!project?.id) return;
    setRootsOnly(v);
    try {
      sessionStorage.setItem(`vineroot:project:${project.id}:rootsOnly`, v ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  };

  const persistSprintFilter = (v: SprintFilterValue) => {
    if (!project?.id) return;
    setSprintFilter(v);
    try {
      sessionStorage.setItem(`vineroot:project:${project.id}:sprintFilter`, v);
    } catch {
      /* ignore */
    }
  };

  const persistEpicFilter = (v: EpicFilterValue) => {
    if (!project?.id) return;
    setEpicFilter(v);
    try {
      sessionStorage.setItem(`vineroot:project:${project.id}:epicFilter`, v);
    } catch {
      /* ignore */
    }
  };

  const sprintBoardResolvedId = useMemo(() => {
    if (currentView !== 'sprint-board') return null;
    const list = project?.sprints ?? [];
    if (
      sprintFilter !== 'all' &&
      sprintFilter !== 'backlog' &&
      list.some((s) => s.id === sprintFilter)
    ) {
      return sprintFilter;
    }
    return pickDefaultSprintId(list);
  }, [currentView, project?.sprints, sprintFilter]);

  const effectiveSprintFilter = useMemo<SprintFilterValue>(() => {
    if (currentView === 'backlog') return 'backlog';
    if (currentView === 'sprint-board') {
      return sprintBoardResolvedId ?? 'all';
    }
    return sprintFilter;
  }, [currentView, sprintFilter, sprintBoardResolvedId]);

  /** Sprint tab: show resolved sprint in the header without forcing sessionStorage until the user picks. */
  const headerSprintFilter = useMemo<SprintFilterValue>(() => {
    if (currentView !== 'sprint-board') return sprintFilter;
    const list = project?.sprints ?? [];
    if (
      sprintFilter !== 'all' &&
      sprintFilter !== 'backlog' &&
      list.some((s) => s.id === sprintFilter)
    ) {
      return sprintFilter;
    }
    return (sprintBoardResolvedId ?? sprintFilter) as SprintFilterValue;
  }, [currentView, sprintFilter, sprintBoardResolvedId, project?.sprints]);

  const sprintFilterForSavedViewCapture = useMemo(() => {
    if (currentView !== 'sprint-board') return sprintFilter;
    if (sprintFilter !== 'all' && sprintFilter !== 'backlog') return sprintFilter;
    return (sprintBoardResolvedId ?? sprintFilter) as SprintFilterValue;
  }, [currentView, sprintFilter, sprintBoardResolvedId]);

  const epicScopedSections = useMemo(() => {
    const secs = project?.sections ?? [];
    const views = [
      'list',
      'board',
      'backlog',
      'sprint-board',
      'roadmap',
      'timeline',
      'calendar',
    ];
    if (epicFilter === 'all' || !views.includes(currentView)) {
      return secs;
    }
    return filterSectionsByEpic(secs, epicFilter);
  }, [project?.sections, epicFilter, currentView]);

  const sprintScopedSections = useMemo(() => {
    const secs = epicScopedSections;
    const viewsWithSprint = [
      'list',
      'board',
      'backlog',
      'sprint-board',
      'roadmap',
      'timeline',
      'calendar',
    ];
    if (currentView === 'sprint-board' && !sprintBoardResolvedId) {
      return secs.map((s) => ({ ...s, tasks: [] }));
    }
    if (effectiveSprintFilter === 'all' || !viewsWithSprint.includes(currentView)) {
      return secs;
    }
    return filterSectionsBySprint(secs, effectiveSprintFilter);
  }, [epicScopedSections, effectiveSprintFilter, currentView, sprintBoardResolvedId]);

  const listBoardSections = useMemo(() => {
    const base = rootsOnly ? sectionsRootsOnly(sprintScopedSections) : sprintScopedSections;
    if (currentView === 'backlog') {
      return sortSectionsByBacklogRank(base);
    }
    return base;
  }, [sprintScopedSections, rootsOnly, currentView]);

  const listScheduleViewsEnabled = ['list', 'board', 'backlog', 'sprint-board'].includes(
    currentView,
  );

  const scheduleCp = useProjectScheduleCriticalPath(
    project?.id,
    project?.workspaceIds?.[0],
    Boolean(project?.id && listScheduleViewsEnabled),
  );

  const listBoardSectionsSchedule = useMemo(() => {
    const ws = project?.workspaceIds?.[0];
    if (!ws || !listScheduleViewsEnabled) return listBoardSections;
    if (scheduleCp.loadFailed) {
      return listBoardSections;
    }
    let secs = filterSectionsBySchedule(
      listBoardSections,
      listScheduleFilter,
      scheduleCp.scheduleByTaskId,
      scheduleCp.criticalIds,
    );
    secs = sortSectionsBySchedule(
      secs,
      listScheduleSort,
      scheduleCp.scheduleByTaskId,
      scheduleCp.criticalIds,
    );
    return secs;
  }, [
    listBoardSections,
    project?.workspaceIds,
    listScheduleViewsEnabled,
    listScheduleFilter,
    listScheduleSort,
    scheduleCp.scheduleByTaskId,
    scheduleCp.criticalIds,
    scheduleCp.loadFailed,
  ]);

  const persistListScheduleFilter = (v: ListScheduleFilter) => {
    if (!project?.id) return;
    setListScheduleFilter(v);
    try {
      sessionStorage.setItem(`vineroot:project:${project.id}:listScheduleFilter`, v);
    } catch {
      /* ignore */
    }
  };

  const persistListScheduleSort = (v: ListScheduleSort) => {
    if (!project?.id) return;
    setListScheduleSort(v);
    try {
      sessionStorage.setItem(`vineroot:project:${project.id}:listScheduleSort`, v);
    } catch {
      /* ignore */
    }
  };

  const applySavedViewConfig = (config: ProjectSavedViewConfigDto) => {
    if (!project?.id) return;
    if (config.sprintFilter !== undefined) {
      persistSprintFilter(config.sprintFilter as SprintFilterValue);
    }
    if (config.epicFilter !== undefined) {
      persistEpicFilter(config.epicFilter as EpicFilterValue);
    }
    if (config.rootsOnly !== undefined) {
      persistRootsOnly(config.rootsOnly);
    }
    if (config.listScheduleFilter !== undefined) {
      persistListScheduleFilter(config.listScheduleFilter as ListScheduleFilter);
    }
    if (config.listScheduleSort !== undefined) {
      persistListScheduleSort(config.listScheduleSort as ListScheduleSort);
    }
    if (config.surface === 'workload') {
      const qs = new URLSearchParams();
      if (config.workloadWeeks != null) {
        qs.set('weeks', String(config.workloadWeeks));
      }
      if (config.workloadFrom) {
        qs.set('from', config.workloadFrom);
      }
      const q = qs.toString();
      navigate(`/projects/${project.id}/workload${q ? `?${q}` : ''}`);
      return;
    }
    if (config.surface === 'timephased') {
      const qs = new URLSearchParams();
      if (config.timephasedGranularity) {
        qs.set('granularity', config.timephasedGranularity);
      }
      if (config.timephasedBasis) {
        qs.set('basis', config.timephasedBasis);
      }
      if (config.timephasedGridMode) {
        qs.set('grid', config.timephasedGridMode);
      }
      const q = qs.toString();
      navigate(`/projects/${project.id}/timephased${q ? `?${q}` : ''}`);
      return;
    }
    if (config.surface === 'network') {
      navigate(`/projects/${project.id}/network`);
      return;
    }
    if (config.surface === 'epics') {
      navigate(`/projects/${project.id}/epics`);
      return;
    }
    if (config.surface) {
      navigate(`/projects/${project.id}/${config.surface}`);
    }
  };

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const activeTask =
    activeTaskId != null
      ? getTaskFromSections(project.sections ?? [], activeTaskId)
      : undefined;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <ProjectHeader
          project={project}
          currentView={currentView}
          workspaceId={project.workspaceIds?.[0]}
          rootsOnly={rootsOnly}
          onRootsOnlyChange={persistRootsOnly}
          sprintFilter={headerSprintFilter}
          onSprintFilterChange={persistSprintFilter}
          sprintSelectMode={currentView === 'sprint-board' ? 'sprint-only' : 'full'}
          sprints={project.sprints ?? []}
          epicTasks={epicTasks}
          epicRollups={epicRollupById}
          epicFilter={epicFilter}
          onEpicFilterChange={persistEpicFilter}
          onOpenSavedViews={() => setSavedViewsOpen(true)}
        />
        <ProjectSavedViewsModal
          isOpen={savedViewsOpen}
          onClose={() => setSavedViewsOpen(false)}
          projectId={project.id}
          projectCreatedById={project.createdById}
          currentUserId={user?.id}
          sprints={(project.sprints ?? []).map((s) => ({ id: s.id, name: s.name }))}
          epicTasks={epicTasks.map((t) => ({ id: t.id, title: t.title }))}
          capture={{
            sprintFilter: sprintFilterForSavedViewCapture,
            epicFilter,
            rootsOnly,
            currentView,
            workloadWeeks:
              currentView === 'workload'
                ? (() => {
                    const w = searchParams.get('weeks');
                    if (w == null || w === '') return undefined;
                    const n = parseInt(w, 10);
                    if (!Number.isFinite(n)) return undefined;
                    return Math.min(26, Math.max(4, n));
                  })()
                : undefined,
            workloadFrom:
              currentView === 'workload' ? (searchParams.get('from') ?? '') : '',
            listScheduleFilter,
            listScheduleSort,
            ...(currentView === 'timephased'
              ? {
                  timephasedGranularity: parseTimephasedGranularity(searchParams),
                  timephasedBasis: parseTimephasedBasis(searchParams),
                  timephasedGridMode: parseTimephasedGridMode(searchParams),
                }
              : {}),
          }}
          onApply={applySavedViewConfig}
        />
        <div className="flex-1 overflow-auto">
          {(currentView === 'list' || currentView === 'backlog') && (
            <ProjectListView
              sections={listBoardSectionsSchedule}
              projectId={project.id}
              onSelectTask={openTask}
              scheduleWorkspaceId={project.workspaceIds?.[0]}
              scheduleFilter={listScheduleFilter}
              scheduleSort={listScheduleSort}
              scheduleLoading={scheduleCp.loading}
              scheduleLoadFailed={scheduleCp.loadFailed}
              onScheduleFilterChange={persistListScheduleFilter}
              onScheduleSortChange={persistListScheduleSort}
              getScheduleInsight={(task) =>
                computeTaskScheduleInsight(
                  task,
                  scheduleCp.scheduleByTaskId,
                  scheduleCp.criticalIds,
                  {
                    loadFailed: scheduleCp.loadFailed,
                    loading: scheduleCp.loading,
                  },
                )
              }
            />
          )}
          {(currentView === 'board' || currentView === 'sprint-board') && (
            <ProjectBoardView
              sections={listBoardSectionsSchedule}
              projectId={project.id}
              kanbanWipEnforcement={project.kanbanWipEnforcement ?? 'OFF'}
              onSelectTask={openTask}
            />
          )}
          {currentView === 'roadmap' && (
            <ProjectEpicRoadmapView sections={sprintScopedSections} epicFilter={epicFilter} />
          )}
          {currentView === 'epics' && <ProjectEpicDashboardView projectId={project.id} />}
          {currentView === 'timeline' && (
            <ProjectTimelineView
              sections={sprintScopedSections}
              projectId={project.id}
              workspaceId={project.workspaceIds[0]}
              projectName={project.name}
            />
          )}
          {currentView === 'network' && project.workspaceIds[0] && (
            <ProjectNetworkView
              projectId={project.id}
              workspaceId={project.workspaceIds[0]}
            />
          )}
          {currentView === 'timephased' && project.workspaceIds[0] && (
            <ProjectTimephasedView
              projectId={project.id}
              workspaceId={project.workspaceIds[0]}
            />
          )}
          {currentView === 'calendar' && (
            <ProjectCalendarView sections={sprintScopedSections} />
          )}
          {currentView === 'burndown' && (
            <ProjectBurndownView projectId={project.id} sprints={project.sprints ?? []} />
          )}
          {currentView === 'flow' && <ProjectFlowView projectId={project.id} />}
          {currentView === 'workload' && (
            <ProjectWorkloadView
              projectId={project.id}
              workspaceId={project.workspaceIds[0] ?? ''}
              sprintFilter={sprintFilter}
              epicFilter={epicFilter}
            />
          )}
          {currentView === 'activity' && (
            <ProjectActivityView projectId={project.id} />
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {activeTask && (
        <TaskDetail
          task={activeTask}
          workspaceIds={project.workspaceIds}
          scheduleWorkspaceId={project.workspaceIds?.[0]}
          sprints={project.sprints}
          isOpen={!!activeTaskId}
          onClose={closeTask}
        />
      )}
    </div>
  );
}
