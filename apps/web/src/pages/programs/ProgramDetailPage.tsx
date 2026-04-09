import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Layers, Loader2 } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAuthStore } from '../../stores/auth.store';
import {
  useScheduleProgram,
  useAddProjectToScheduleProgram,
  useRemoveProjectFromScheduleProgram,
} from '../../hooks/useSchedulePrograms';
import { useProjects } from '../../hooks/useProjects';
import { useWorkspace } from '../../hooks/useWorkspaces';
import { ScheduleProgramDashboard } from '../../components/workspace/ScheduleProgramDashboard';
import { Button } from '../../components/ui';
import type { ProjectColor } from '../../types';

function isWorkspaceAdmin(
  userId: string | undefined,
  members: { userId: string; role: string }[] | undefined,
): boolean {
  if (!userId || !members?.length) return false;
  const m = members.find((x) => x.userId === userId);
  return m?.role === 'OWNER' || m?.role === 'ADMIN';
}

export default function ProgramDetailPage() {
  const { programId } = useParams<{ programId: string }>();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspaceStore();
  const user = useAuthStore((s) => s.user);
  const workspaceId =
    searchParams.get('ws')?.trim() || currentWorkspace?.id || undefined;

  const { data: workspace } = useWorkspace(workspaceId);
  const { data: program, isLoading, error } = useScheduleProgram(
    workspaceId,
    programId,
  );
  const { data: workspaceProjects } = useProjects(workspaceId ?? '');
  const { mutate: addProject, isPending: adding } =
    useAddProjectToScheduleProgram(workspaceId);
  const { mutate: removeProject, isPending: removing } =
    useRemoveProjectFromScheduleProgram(workspaceId);
  const [pickId, setPickId] = useState('');

  const admin = useMemo(
    () => isWorkspaceAdmin(user?.id, workspace?.members),
    [user?.id, workspace?.members],
  );

  const projectIds = program?.projectIds ?? [];

  const projectColorById = useMemo(() => {
    const m = new Map<string, ProjectColor>();
    for (const p of workspaceProjects ?? []) {
      m.set(p.id, p.color);
    }
    return m;
  }, [workspaceProjects]);

  const memberSet = useMemo(() => new Set(projectIds), [projectIds]);
  const addable = useMemo(
    () => (workspaceProjects ?? []).filter((p) => !memberSet.has(p.id)),
    [workspaceProjects, memberSet],
  );

  if (!workspaceId) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-gray-600">
          Select a workspace or open this page from the Programs list (workspace context is
          required).
        </p>
        <Link to="/programs" className="text-brand-600 text-sm mt-2 inline-block">
          Back to programs
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-8 flex items-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading program…
      </div>
    );
  }

  if (error || !program || !programId) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <p className="text-red-600">Program not found or you don&apos;t have access.</p>
        <Link to="/programs" className="text-brand-600 text-sm mt-2 inline-block">
          Back to programs
        </Link>
      </div>
    );
  }

  const wsQs = `?ws=${encodeURIComponent(workspaceId)}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-10">
        <div>
          <Link
            to={`/programs${wsQs}`}
            className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Programs
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-lg flex-shrink-0">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                {program.name}
              </h1>
              <p className="text-gray-500 mt-1.5 text-sm">
                {workspace?.name ?? 'Workspace'} · {projectIds.length} project
                {projectIds.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
        </div>
        <Link
          to="/settings/workspace?tab=programs"
          className="inline-flex items-center gap-2 self-start text-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Workspace settings
        </Link>
      </div>

      <div className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Projects in this program</h2>
        <p className="text-sm text-gray-500 mb-4 max-w-2xl">
          Cross-project task dependencies are only allowed between these projects.
        </p>
        {projectIds.length === 0 ? (
          <p className="text-sm text-gray-500">No projects linked yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {projectIds.map((pid) => {
              const name = workspaceProjects?.find((x) => x.id === pid)?.name ?? pid;
              return (
                <li
                  key={pid}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-800 text-sm overflow-hidden"
                >
                  <Link
                    to={`/projects/${pid}`}
                    className="pl-3 pr-2 py-1.5 hover:bg-gray-200/80 transition-colors"
                  >
                    {name}
                  </Link>
                  {admin && (
                    <button
                      type="button"
                      disabled={removing}
                      className="pr-2 py-1.5 text-gray-500 hover:text-red-600"
                      title="Remove from program"
                      onClick={() => {
                        if (
                          confirm(
                            `Remove “${name}” from this program? Cross-project dependencies may break.`,
                          )
                        ) {
                          removeProject({ programId, projectId: pid });
                        }
                      }}
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {admin && (
          <>
            <hr className="my-6 border-gray-100" />
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add project</h3>
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <select
                  value={pickId}
                  onChange={(e) => setPickId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white"
                >
                  <option value="">
                    {addable.length === 0 ? 'No projects left to add' : 'Choose a project…'}
                  </option>
                  {addable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                disabled={!pickId || adding}
                loading={adding}
                onClick={() => {
                  if (!pickId) return;
                  addProject(
                    { programId, body: { projectId: pickId } },
                    { onSuccess: () => setPickId('') },
                  );
                }}
              >
                Add to program
              </Button>
            </div>
          </>
        )}

        {!admin && (
          <p className="text-xs text-gray-500 mt-4">
            Only workspace owners and admins can add or remove projects.
          </p>
        )}
      </div>

      <ScheduleProgramDashboard
        workspaceId={workspaceId}
        programId={programId}
        projectIds={projectIds}
        projectColorById={projectColorById}
      />
    </div>
  );
}
