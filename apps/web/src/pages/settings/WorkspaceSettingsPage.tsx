import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Layers, Loader2, Package, Users } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useAuthStore } from '../../stores/auth.store';
import {
  useWorkspace,
  useUpdateWorkspace,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
} from '../../hooks/useWorkspaces';
import {
  useWorkCalendars,
  useCreateWorkCalendar,
  useUpdateWorkCalendar,
  useDeleteWorkCalendar,
} from '../../hooks/useWorkCalendars';
import {
  useGenericResources,
  useCreateGenericResource,
  useUpdateGenericResource,
  useDeleteGenericResource,
} from '../../hooks/useGenericResources';
import {
  useSchedulePrograms,
  useCreateScheduleProgram,
  useAddProjectToScheduleProgram,
  useRemoveProjectFromScheduleProgram,
} from '../../hooks/useSchedulePrograms';
import { useProjects } from '../../hooks/useProjects';
import {
  ScheduleProgramPanel,
  ScheduleProgramToggle,
} from '../../components/workspace/ScheduleProgramPanel';
import { Button } from '../../components/ui';
import type { ProjectColor, WorkspaceMember, WorkspaceRole } from '../../types';
import type { GenericResourceDto } from '@vineroot/shared-types';

const ROLES: WorkspaceRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'];

function isWorkspaceAdmin(
  userId: string | undefined,
  members: { userId: string; role: string }[] | undefined,
): boolean {
  if (!userId || !members?.length) return false;
  const m = members.find((x) => x.userId === userId);
  return m?.role === 'OWNER' || m?.role === 'ADMIN';
}

export default function WorkspaceSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: 'general' | 'people' | 'calendars' | 'resources' | 'programs' =
    tabParam === 'people'
      ? 'people'
      : tabParam === 'calendars'
        ? 'calendars'
        : tabParam === 'resources'
          ? 'resources'
          : tabParam === 'programs'
            ? 'programs'
            : 'general';
  const { currentWorkspace } = useWorkspaceStore();
  const user = useAuthStore((s) => s.user);
  const wid = currentWorkspace?.id;

  const { data: workspace, isLoading, error } = useWorkspace(wid);
  const { mutate: saveWorkspace, isPending: saving } = useUpdateWorkspace();
  const { mutate: invite, isPending: inviting, error: inviteError } = useInviteMember(wid);
  const { mutate: removeMember, isPending: removing } = useRemoveMember(wid);
  const { mutate: updateRole, isPending: updatingRole } = useUpdateMemberRole(wid);

  const {
    data: workCalendars,
    isLoading: calendarsLoading,
    error: calendarsError,
  } = useWorkCalendars(wid);
  const { mutate: createCalendar, isPending: creatingCal } = useCreateWorkCalendar(wid);
  const { mutate: updateCalendar, isPending: updatingCal } = useUpdateWorkCalendar(wid);
  const { mutate: deleteCalendar, isPending: deletingCal } = useDeleteWorkCalendar(wid);

  const {
    data: genericResources,
    isLoading: resourcesLoading,
    error: resourcesError,
  } = useGenericResources(wid);
  const { mutate: createResource, isPending: creatingRes } = useCreateGenericResource(wid);
  const { mutate: updateResource, isPending: updatingRes } = useUpdateGenericResource(wid);
  const { mutate: deleteResource, isPending: deletingRes } = useDeleteGenericResource(wid);

  const { data: schedulePrograms, isLoading: programsLoading, error: programsError } =
    useSchedulePrograms(wid);
  const { data: workspaceProjects } = useProjects(wid ?? '');
  const programProjectColors = useMemo(() => {
    const m = new Map<string, ProjectColor>();
    for (const p of workspaceProjects ?? []) {
      m.set(p.id, p.color);
    }
    return m;
  }, [workspaceProjects]);
  const { mutate: createProgram, isPending: creatingProg } = useCreateScheduleProgram(wid);
  const { mutate: addProjectToProgram, isPending: addingProgProject } =
    useAddProjectToScheduleProgram(wid);
  const { mutate: removeProjectFromProgram, isPending: removingProgProject } =
    useRemoveProjectFromScheduleProgram(wid);

  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [newProgramName, setNewProgramName] = useState('');
  const [addProjectSelectByProgram, setAddProjectSelectByProgram] = useState<
    Record<string, string>
  >({});

  const [newCalName, setNewCalName] = useState('');
  const [newCalTz, setNewCalTz] = useState('UTC');
  const [newCalDefault, setNewCalDefault] = useState(false);
  const [editingCalId, setEditingCalId] = useState<string | null>(null);
  const [editCalName, setEditCalName] = useState('');
  const [editCalTz, setEditCalTz] = useState('');
  const [editCalDefault, setEditCalDefault] = useState(false);

  const [newGrName, setNewGrName] = useState('');
  const [newGrMax, setNewGrMax] = useState(100);
  const [newGrStdRate, setNewGrStdRate] = useState('');
  const [newGrWorkCalId, setNewGrWorkCalId] = useState('');
  const [editingGrId, setEditingGrId] = useState<string | null>(null);
  const [editGrName, setEditGrName] = useState('');
  const [editGrMax, setEditGrMax] = useState(100);
  const [editGrStdRate, setEditGrStdRate] = useState('');
  const [editGrWorkCalId, setEditGrWorkCalId] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('MEMBER');

  const ws = workspace ?? currentWorkspace;
  const members = ws?.members;

  const admin = useMemo(() => isWorkspaceAdmin(user?.id, members), [user?.id, members]);

  useEffect(() => {
    if (ws) {
      setName(ws.name);
      setDescription(ws.description ?? '');
    }
  }, [ws?.id, ws?.name, ws?.description]);

  if (!currentWorkspace) {
    return (
      <p className="text-gray-600">Select a workspace in the sidebar to manage its settings.</p>
    );
  }

  if (isLoading && !ws) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error || !ws) {
    return <p className="text-red-600">Could not load workspace.</p>;
  }

  const setTab = (t: 'general' | 'people' | 'calendars' | 'resources' | 'programs') => {
    if (t === 'general') setSearchParams({});
    else setSearchParams({ tab: t });
  };

  const beginEditResource = (r: GenericResourceDto) => {
    setEditingGrId(r.id);
    setEditGrName(r.name);
    setEditGrMax(r.maxUnitsPercent);
    setEditGrStdRate(
      r.standardRatePerHour != null ? String(r.standardRatePerHour) : '',
    );
    setEditGrWorkCalId(r.workCalendarId ?? '');
  };

  const cancelEditResource = () => {
    setEditingGrId(null);
  };

  const submitNewResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !newGrName.trim()) return;
    let std: number | undefined;
    if (newGrStdRate.trim() !== '') {
      const n = Number.parseFloat(newGrStdRate.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) return;
      std = n;
    }
    createResource(
      {
        name: newGrName.trim(),
        maxUnitsPercent: newGrMax,
        ...(std !== undefined ? { standardRatePerHour: std } : {}),
        ...(newGrWorkCalId.trim()
          ? { workCalendarId: newGrWorkCalId.trim() }
          : {}),
      },
      {
        onSuccess: () => {
          setNewGrName('');
          setNewGrMax(100);
          setNewGrStdRate('');
          setNewGrWorkCalId('');
        },
      },
    );
  };

  const submitEditResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !editingGrId || !editGrName.trim()) return;
    let ratePayload: number | null;
    if (editGrStdRate.trim() === '') {
      ratePayload = null;
    } else {
      const n = Number.parseFloat(editGrStdRate.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) return;
      ratePayload = n;
    }
    updateResource(
      {
        resourceId: editingGrId,
        body: {
          name: editGrName.trim(),
          maxUnitsPercent: editGrMax,
          standardRatePerHour: ratePayload,
          workCalendarId: editGrWorkCalId.trim() === '' ? null : editGrWorkCalId.trim(),
        },
      },
      { onSuccess: () => cancelEditResource() },
    );
  };

  const beginEditCalendar = (c: {
    id: string;
    name: string;
    timeZone: string;
    isDefault: boolean;
  }) => {
    setEditingCalId(c.id);
    setEditCalName(c.name);
    setEditCalTz(c.timeZone);
    setEditCalDefault(c.isDefault);
  };

  const cancelEditCalendar = () => {
    setEditingCalId(null);
  };

  const submitNewCalendar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !newCalName.trim()) return;
    createCalendar(
      {
        name: newCalName.trim(),
        timeZone: newCalTz.trim() || 'UTC',
        isDefault: newCalDefault,
      },
      {
        onSuccess: () => {
          setNewCalName('');
          setNewCalTz('UTC');
          setNewCalDefault(false);
        },
      },
    );
  };

  const submitEditCalendar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !editingCalId || !editCalName.trim()) return;
    updateCalendar(
      {
        calendarId: editingCalId,
        body: {
          name: editCalName.trim(),
          timeZone: editCalTz.trim() || 'UTC',
          isDefault: editCalDefault,
        },
      },
      { onSuccess: () => cancelEditCalendar() },
    );
  };

  const submitGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin) return;
    saveWorkspace({
      workspaceId: ws.id,
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !inviteEmail.trim()) return;
    invite(
      { email: inviteEmail.trim().toLowerCase(), role: inviteRole },
      {
        onSuccess: () => {
          setInviteEmail('');
        },
      },
    );
  };

  const inviteErr =
    inviteError && 'response' in inviteError
      ? (inviteError as { response?: { data?: { message?: string } } }).response?.data?.message
      : (inviteError as Error | null)?.message;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        <button
          type="button"
          onClick={() => setTab('general')}
          className={`px-3 py-2 text-sm font-medium rounded-t-lg ${
            tab === 'general'
              ? 'bg-white text-brand-700 border border-b-0 border-gray-200 -mb-px'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setTab('people')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg ${
            tab === 'people'
              ? 'bg-white text-brand-700 border border-b-0 border-gray-200 -mb-px'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4" />
          People
        </button>
        <button
          type="button"
          onClick={() => setTab('calendars')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg ${
            tab === 'calendars'
              ? 'bg-white text-brand-700 border border-b-0 border-gray-200 -mb-px'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Calendars
        </button>
        <button
          type="button"
          onClick={() => setTab('resources')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg ${
            tab === 'resources'
              ? 'bg-white text-brand-700 border border-b-0 border-gray-200 -mb-px'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Package className="w-4 h-4" />
          Resources
        </button>
        <button
          type="button"
          onClick={() => setTab('programs')}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg ${
            tab === 'programs'
              ? 'bg-white text-brand-700 border border-b-0 border-gray-200 -mb-px'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Programs
        </button>
      </div>

      {tab === 'general' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Workspace details</h2>
          <p className="text-sm text-gray-600 mb-4">Name and description for {ws.name}.</p>
          {!admin && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Only owners and admins can edit workspace details.
            </p>
          )}
          <form onSubmit={submitGeneral} className="max-w-lg space-y-4">
            <div>
              <label htmlFor="ws-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!admin}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
                required
              />
            </div>
            <div>
              <label htmlFor="ws-desc" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="ws-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!admin}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50"
              />
            </div>
            <Button type="submit" disabled={!admin || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </section>
      )}

      {tab === 'people' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Members</h2>
          <p className="text-sm text-gray-600 mb-4">
            Invite teammates by email (they must already have a Vineroot account).
          </p>

          {admin && (
            <form onSubmit={submitInvite} className="max-w-lg flex flex-col sm:flex-row gap-2 mb-8">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={inviting}>
                {inviting ? '…' : 'Invite'}
              </Button>
            </form>
          )}
          {inviteErr && <p className="text-sm text-red-600 mb-4">{String(inviteErr)}</p>}

          <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
            {(members ?? []).map((m: WorkspaceMember) => {
              const isSelf = m.userId === user?.id;
              const isOwner = m.role === 'OWNER';
              const canManage = admin && !isSelf && !isOwner;

              return (
                <li
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{m.user.displayName}</p>
                    <p className="text-sm text-gray-500 truncate">{m.user.email}</p>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        disabled={updatingRole}
                        onChange={(e) =>
                          updateRole({ userId: m.userId, role: e.target.value as WorkspaceRole })
                        }
                        className="text-sm rounded-lg border border-gray-200 px-2 py-1"
                      >
                        {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={removing}
                        onClick={() => {
                          if (confirm(`Remove ${m.user.displayName} from this workspace?`)) {
                            removeMember(m.userId);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-600">{m.role}</span>
                  )}
                </li>
              );
            })}
            {(!members || members.length === 0) && (
              <li className="px-4 py-6 text-sm text-gray-500">No members loaded.</li>
            )}
          </ul>

          {!admin && (
            <p className="text-sm text-gray-500 mt-4">
              Only owners and admins can invite or remove members.
            </p>
          )}
        </section>
      )}

      {tab === 'calendars' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Work calendars</h2>
          <p className="text-sm text-gray-600 mb-4">
            Weekly working patterns used for CPM lag and project scheduling. New projects inherit the
            workspace default when none is set on the project.
          </p>
          {!admin && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Only owners and admins can create or edit calendars.
            </p>
          )}
          {calendarsError && (
            <p className="text-sm text-red-600 mb-4">Could not load work calendars.</p>
          )}
          {calendarsLoading && !workCalendars ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white mb-6">
              {(workCalendars ?? []).map((c) => (
                <li key={c.id} className="px-4 py-3 space-y-3">
                  {editingCalId === c.id ? (
                    <form onSubmit={submitEditCalendar} className="space-y-3 max-w-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          value={editCalName}
                          onChange={(e) => setEditCalName(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Time zone (stored; CPM uses UTC dates today)
                        </label>
                        <input
                          value={editCalTz}
                          onChange={(e) => setEditCalTz(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={editCalDefault}
                          onChange={(e) => setEditCalDefault(e.target.checked)}
                        />
                        Workspace default calendar
                      </label>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={!admin || updatingCal}>
                          {updatingCal ? 'Saving…' : 'Save'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={cancelEditCalendar}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {c.name}
                          {c.isDefault && (
                            <span className="ml-2 text-xs font-normal text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">{c.timeZone}</p>
                      </div>
                      {admin && (
                        <div className="flex gap-2">
                          <Button type="button" variant="secondary" onClick={() => beginEditCalendar(c)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={deletingCal}
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete calendar “${c.name}”? Projects using it keep the link until changed.`,
                                )
                              ) {
                                deleteCalendar(c.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
              {(!workCalendars || workCalendars.length === 0) && (
                <li className="px-4 py-6 text-sm text-gray-500">No work calendars yet.</li>
              )}
            </ul>
          )}

          {admin && (
            <div className="max-w-lg border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">New calendar</h3>
              <form onSubmit={submitNewCalendar} className="space-y-3">
                <div>
                  <label htmlFor="new-cal-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    id="new-cal-name"
                    value={newCalName}
                    onChange={(e) => setNewCalName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                    placeholder="Standard week"
                  />
                </div>
                <div>
                  <label htmlFor="new-cal-tz" className="block text-sm font-medium text-gray-700 mb-1">
                    Time zone
                  </label>
                  <input
                    id="new-cal-tz"
                    value={newCalTz}
                    onChange={(e) => setNewCalTz(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={newCalDefault}
                    onChange={(e) => setNewCalDefault(e.target.checked)}
                  />
                  Set as workspace default
                </label>
                <Button type="submit" disabled={creatingCal || !newCalName.trim()}>
                  {creatingCal ? 'Creating…' : 'Create calendar'}
                </Button>
              </form>
            </div>
          )}
        </section>
      )}

      {tab === 'resources' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Generic resources</h2>
          <p className="text-sm text-gray-600 mb-4">
            Named capacity buckets (equipment, shared roles) for task assignments and overallocation.
            People use assignee units; generic resources use max units per workspace entry.
          </p>
          {!admin && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Only owners and admins can create or edit resources.
            </p>
          )}
          {resourcesError && (
            <p className="text-sm text-red-600 mb-4">Could not load generic resources.</p>
          )}
          {resourcesLoading && !genericResources ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white mb-6">
              {(genericResources ?? []).map((r) => (
                <li key={r.id} className="px-4 py-3 space-y-3">
                  {editingGrId === r.id ? (
                    <form onSubmit={submitEditResource} className="space-y-3 max-w-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          value={editGrName}
                          onChange={(e) => setEditGrName(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max units (%)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100000}
                          value={editGrMax}
                          onChange={(e) => setEditGrMax(Number(e.target.value))}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Standard rate (per hour, optional)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={editGrStdRate}
                          onChange={(e) => setEditGrStdRate(e.target.value)}
                          placeholder="Clear to remove"
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`edit-gr-cal-${editingGrId}`}
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Resource work calendar (optional)
                        </label>
                        <select
                          id={`edit-gr-cal-${editingGrId}`}
                          value={editGrWorkCalId}
                          onChange={(e) => setEditGrWorkCalId(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">None (use project minutes only)</option>
                          {(workCalendars ?? []).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Overload uses the minimum of project and resource working minutes per day.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={!admin || updatingRes}>
                          {updatingRes ? 'Saving…' : 'Save'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={cancelEditResource}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{r.name}</p>
                        <p className="text-sm text-gray-500">
                          Max {r.maxUnitsPercent}% units
                          {r.standardRatePerHour != null
                            ? ` · ${r.standardRatePerHour}/h`
                            : ''}
                          {r.workCalendarId
                            ? ` · calendar: ${
                                workCalendars?.find((c) => c.id === r.workCalendarId)?.name ??
                                r.workCalendarId
                              }`
                            : ''}
                        </p>
                      </div>
                      {admin && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => beginEditResource(r)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={deletingRes}
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete resource “${r.name}”? Task assignments must be removed first.`,
                                )
                              ) {
                                deleteResource(r.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
              {(!genericResources || genericResources.length === 0) && (
                <li className="px-4 py-6 text-sm text-gray-500">No generic resources yet.</li>
              )}
            </ul>
          )}

          {admin && (
            <div className="max-w-lg border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">New resource</h3>
              <form onSubmit={submitNewResource} className="space-y-3">
                <div>
                  <label htmlFor="new-gr-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    id="new-gr-name"
                    value={newGrName}
                    onChange={(e) => setNewGrName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                    placeholder="Excavator, QA bench…"
                  />
                </div>
                <div>
                  <label htmlFor="new-gr-max" className="block text-sm font-medium text-gray-700 mb-1">
                    Max units (%)
                  </label>
                  <input
                    id="new-gr-max"
                    type="number"
                    min={1}
                    max={100000}
                    value={newGrMax}
                    onChange={(e) => setNewGrMax(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="new-gr-rate" className="block text-sm font-medium text-gray-700 mb-1">
                    Standard rate (per hour, optional)
                  </label>
                  <input
                    id="new-gr-rate"
                    type="number"
                    min={0}
                    step={0.01}
                    value={newGrStdRate}
                    onChange={(e) => setNewGrStdRate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="new-gr-cal" className="block text-sm font-medium text-gray-700 mb-1">
                    Resource work calendar (optional)
                  </label>
                  <select
                    id="new-gr-cal"
                    value={newGrWorkCalId}
                    onChange={(e) => setNewGrWorkCalId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">None (use project minutes only)</option>
                    {(workCalendars ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" disabled={creatingRes || !newGrName.trim()}>
                  {creatingRes ? 'Creating…' : 'Create resource'}
                </Button>
              </form>
            </div>
          )}
        </section>
      )}

      {tab === 'programs' && wid && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Schedule programs</h2>
          <p className="text-sm text-gray-600 mb-4">
            Link multiple projects into a program to allow{' '}
            <strong>cross-project dependencies</strong> and a merged CPM schedule. Workspace{' '}
            <strong>generic resources</strong> are shared across all projects. Open the{' '}
            <Link to="/programs" className="text-brand-600 font-medium hover:underline">
              Programs hub
            </Link>{' '}
            for the full command center (KPIs, timeline strip, capacity). Inline analytics below are
            the same views in compact form.
          </p>
          {!admin && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Only owners and admins can create programs or change membership.
            </p>
          )}
          {programsError && (
            <p className="text-sm text-red-600 mb-4">Could not load schedule programs.</p>
          )}
          {programsLoading && !schedulePrograms ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white mb-6">
              {(schedulePrograms ?? []).map((prog) => {
                const pids = prog.projectIds ?? [];
                const expanded = expandedProgramId === prog.id;
                const availableToAdd =
                  workspaceProjects?.filter((p) => !pids.includes(p.id)) ?? [];
                const selectVal = addProjectSelectByProgram[prog.id] ?? '';

                return (
                  <li key={prog.id} className="px-4 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{prog.name}</p>
                        <p className="text-sm text-gray-500">
                          {pids.length} project{pids.length === 1 ? '' : 's'} linked
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/programs/${prog.id}?ws=${encodeURIComponent(wid)}`}
                          className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          Command center
                        </Link>
                        <ScheduleProgramToggle
                          expanded={expanded}
                          onToggle={() =>
                            setExpandedProgramId(expanded ? null : prog.id)
                          }
                        />
                      </div>
                    </div>

                    {admin && (
                      <div className="mt-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <select
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm flex-1 max-w-md"
                          value={selectVal}
                          onChange={(e) =>
                            setAddProjectSelectByProgram((m) => ({
                              ...m,
                              [prog.id]: e.target.value,
                            }))
                          }
                          disabled={availableToAdd.length === 0 || addingProgProject}
                        >
                          <option value="">
                            {availableToAdd.length === 0
                              ? 'No more projects to add'
                              : 'Add a project…'}
                          </option>
                          {availableToAdd.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          disabled={
                            !selectVal ||
                            addingProgProject ||
                            availableToAdd.length === 0
                          }
                          onClick={() => {
                            if (!selectVal) return;
                            addProjectToProgram(
                              { programId: prog.id, body: { projectId: selectVal } },
                              {
                                onSuccess: () =>
                                  setAddProjectSelectByProgram((m) => ({
                                    ...m,
                                    [prog.id]: '',
                                  })),
                              },
                            );
                          }}
                        >
                          {addingProgProject ? 'Adding…' : 'Add to program'}
                        </Button>
                      </div>
                    )}

                    {pids.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {pids.map((pid) => {
                          const name =
                            workspaceProjects?.find((x) => x.id === pid)?.name ?? pid;
                          return (
                            <li
                              key={pid}
                              className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-800 rounded-full px-2 py-1"
                            >
                              <span>{name}</span>
                              {admin && (
                                <button
                                  type="button"
                                  className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                                  disabled={removingProgProject}
                                  title="Remove from program"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `Remove “${name}” from this program? Cross-project links involving this project may break.`,
                                      )
                                    ) {
                                      removeProjectFromProgram({
                                        programId: prog.id,
                                        projectId: pid,
                                      });
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

                    <ScheduleProgramPanel
                      workspaceId={wid}
                      programId={prog.id}
                      active={expanded}
                      projectIds={pids}
                      projectColorById={programProjectColors}
                    />
                  </li>
                );
              })}
              {(!schedulePrograms || schedulePrograms.length === 0) && (
                <li className="px-4 py-6 text-sm text-gray-500">
                  No programs yet. Create one below to link projects.
                </li>
              )}
            </ul>
          )}

          {admin && (
            <div className="max-w-lg border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">New program</h3>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newProgramName.trim()) return;
                  createProgram(
                    { name: newProgramName.trim() },
                    {
                      onSuccess: () => setNewProgramName(''),
                    },
                  );
                }}
              >
                <div>
                  <label
                    htmlFor="new-program-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="new-program-name"
                    value={newProgramName}
                    onChange={(e) => setNewProgramName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
                    placeholder="FY26 roadmap, Master build…"
                  />
                </div>
                <Button type="submit" disabled={creatingProg || !newProgramName.trim()}>
                  {creatingProg ? 'Creating…' : 'Create program'}
                </Button>
              </form>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
