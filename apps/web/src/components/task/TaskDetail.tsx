import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, MoreVertical, Loader2, Copy } from 'lucide-react';
import {
  Task,
  TaskActivityLog,
  TaskPriority,
  TaskWorkItemType,
  User,
  Sprint,
  Comment,
} from '../../types';
import { Badge, Avatar, Button } from '../ui';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  useUpdateTask,
  useAssignTask,
  useRemoveAssignee,
  useTask,
  useTasks,
  useCreateTask,
  useAddTaskDependency,
  useRemoveTaskDependency,
  useAddTaskAttachment,
  useDeleteTaskAttachment,
  useUploadTaskAttachment,
  useSetTaskCustomFieldValue,
  useDuplicateTask,
} from '../../hooks/useTasks';
import { useCreateSprint, useProject } from '../../hooks/useProjects';
import { listEpicTasks } from '../../lib/filterSectionsByEpic';
import {
  useWorkspaceCustomFields,
  useProjectCustomFields,
  useAddProjectCustomField,
} from '../../hooks/useCustomFields';
import { useWorkspaces } from '../../hooks/useWorkspaces';
import { useTaskComments, useCreateComment } from '../../hooks/useComments';
import { useTaskAuditLogs } from '../../hooks/useAuditLogs';
import { useUIStore } from '../../stores/ui.store';
import { formatDistanceToNow } from 'date-fns';
import {
  ActorTier,
  TaskDomain,
  TaskComplexity,
  ReviewGate,
} from '@vineroot/shared-types';
import { fieldValueToDisplay } from '../../lib/taskDetailFieldValue';
import { openTaskAttachment } from '../../lib/openTaskAttachment';
import { extractMentionIdsFromBody } from '../../lib/commentMentions';

const WORK_ITEM_OPTIONS: TaskWorkItemType[] = [
  'TASK',
  'STORY',
  'BUG',
  'EPIC',
  'CHORE',
  'SPIKE',
];

interface TaskDetailProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  /** Project workspaces — used to offer workspace members as assignees */
  workspaceIds?: string[];
  /** Sprints on the current project (for assignment). */
  sprints?: Sprint[];
}

const PRIORITY_OPTIONS: TaskPriority[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function toDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const actorTierValues = Object.values(ActorTier);
const domainValues = Object.values(TaskDomain);
const complexityValues = Object.values(TaskComplexity);
const reviewGateValues = Object.values(ReviewGate);

function renderCommentBody(
  body: string,
  resolveName: (userId: string) => string | undefined,
): ReactNode {
  const parts: ReactNode[] = [];
  let key = 0;
  let last = 0;
  for (const m of body.matchAll(/@([a-z0-9]{20,36})/gi)) {
    if (m.index! > last) {
      parts.push(
        <span key={`t-${key++}`} className="whitespace-pre-wrap">
          {body.slice(last, m.index)}
        </span>,
      );
    }
    const id = m[1];
    const label = resolveName(id) ?? id.slice(0, 8);
    parts.push(
      <span key={`m-${key++}`} className="text-brand-600 font-medium">
        @{label}
      </span>,
    );
    last = m.index! + m[0].length;
  }
  if (last < body.length) {
    parts.push(
      <span key={`t-${key++}`} className="whitespace-pre-wrap">
        {body.slice(last)}
      </span>,
    );
  }
  return parts.length ? <>{parts}</> : <span className="whitespace-pre-wrap">{body}</span>;
}

function TaskCommentNode({
  c,
  byParent,
  resolveMentionName,
  onReply,
}: {
  c: Comment;
  byParent: Map<string, Comment[]>;
  resolveMentionName: (userId: string) => string | undefined;
  onReply: (id: string) => void;
}) {
  const replies = byParent.get(c.id) ?? [];
  return (
    <li className="text-sm">
      <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
        <div className="flex justify-between items-start gap-2 text-xs text-gray-500 mb-1">
          <span className="font-medium text-gray-700">
            {c.author?.displayName ?? c.authorId}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
            <button
              type="button"
              className="text-brand-600 hover:text-brand-700 font-medium"
              onClick={() => onReply(c.id)}
            >
              Reply
            </button>
          </div>
        </div>
        <div className="text-gray-800">{renderCommentBody(c.body, resolveMentionName)}</div>
      </div>
      {replies.length > 0 && (
        <ul className="ml-4 pl-3 border-l-2 border-gray-200 space-y-2 mt-2">
          {replies.map((r) => (
            <TaskCommentNode
              key={r.id}
              c={r}
              byParent={byParent}
              resolveMentionName={resolveMentionName}
              onReply={onReply}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const RECURRENCE_PRESETS: { value: string; label: string }[] = [
  { value: '', label: 'Does not repeat' },
  { value: 'FREQ=DAILY;INTERVAL=1', label: 'Daily' },
  { value: 'FREQ=WEEKLY;INTERVAL=1', label: 'Weekly' },
  { value: 'FREQ=MONTHLY;INTERVAL=1', label: 'Monthly' },
];

function SubtaskTree({
  nodes,
  depth,
  onSelect,
}: {
  nodes: Task[];
  depth: number;
  onSelect: (id: string) => void;
}) {
  if (!nodes?.length) return null;
  return (
    <ul
      className={
        depth > 0
          ? 'ml-3 border-l border-gray-200 pl-3 mt-2 space-y-2'
          : 'space-y-2'
      }
    >
      {nodes.map((st) => (
        <li key={st.id}>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onSelect(st.id)}
              className="text-sm text-gray-900 hover:text-brand-600 text-left font-medium"
            >
              {st.title}
            </button>
            <Badge type="status" value={st.status} size="sm" />
          </div>
          <SubtaskTree nodes={st.subtasks ?? []} depth={depth + 1} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

export function TaskDetail({
  task: taskProp,
  isOpen,
  onClose,
  workspaceIds,
  sprints = [],
}: TaskDetailProps) {
  const openTask = useUIStore((s) => s.openTask);
  const { data: taskData, isFetching: detailLoading } = useTask(taskProp.id, {
    enabled: isOpen,
    placeholderData: taskProp,
  });
  const task = taskData ?? taskProp;
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [actorTier, setActorTier] = useState<ActorTier>(task.actorTier as ActorTier);
  const [domain, setDomain] = useState<TaskDomain>(task.domain as TaskDomain);
  const [complexity, setComplexity] = useState<TaskComplexity>(
    task.complexity as TaskComplexity,
  );
  const [reviewGate, setReviewGate] = useState<ReviewGate>(task.reviewGate as ReviewGate);
  const [phase, setPhase] = useState(task.phase != null ? String(task.phase) : '');
  const [parallelGroup, setParallelGroup] = useState(task.parallelGroup || '');
  const [agentContextStr, setAgentContextStr] = useState(
    () => JSON.stringify(task.agentContext ?? {}, null, 2),
  );
  const [agentOutputStr, setAgentOutputStr] = useState(
    () => JSON.stringify(task.agentOutput ?? {}, null, 2),
  );
  const [agentJsonError, setAgentJsonError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [mentionSelectKey, setMentionSelectKey] = useState(0);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [attachFilename, setAttachFilename] = useState('');
  const [attachUrl, setAttachUrl] = useState('');
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintStart, setNewSprintStart] = useState('');
  const [newSprintEnd, setNewSprintEnd] = useState('');

  const { mutate: updateTask, isPending } = useUpdateTask();
  const { mutate: assignUser, isPending: assigning } = useAssignTask();
  const { mutate: unassignUser, isPending: unassigning } = useRemoveAssignee();
  const { mutate: createTask, isPending: creatingSubtask } = useCreateTask();
  const { mutate: addDependency, isPending: addingDep } = useAddTaskDependency();
  const { mutate: removeDependency, isPending: removingDep } = useRemoveTaskDependency();
  const { mutate: addAttachment, isPending: addingAttachment } = useAddTaskAttachment();
  const { mutate: deleteAttachment, isPending: deletingAttachment } = useDeleteTaskAttachment();
  const { mutate: uploadAttachment, isPending: uploadingAttachment } = useUploadTaskAttachment();
  const { mutate: setCustomFieldValue } = useSetTaskCustomFieldValue();
  const { mutate: duplicateTask, isPending: duplicating } = useDuplicateTask();
  const { mutate: createSprint, isPending: creatingSprint } = useCreateSprint(task.projectId);
  const { mutate: addProjectCustomField, isPending: addingProjectField } =
    useAddProjectCustomField();
  const { data: workspaces } = useWorkspaces();
  const { data: projectTasks = [] } = useTasks(isOpen ? task.projectId : undefined);
  const { data: projectForEpics } = useProject(
    isOpen && task.projectId ? task.projectId : '',
  );
  const epicPickerOptions = useMemo(() => {
    const sections = projectForEpics?.sections;
    if (!sections?.length) return [];
    return listEpicTasks(sections).filter((e) => e.id !== task.id);
  }, [projectForEpics?.sections, task.id]);
  const epicLinkOrphan =
    !!task.epicTaskId && !epicPickerOptions.some((e) => e.id === task.epicTaskId);
  const primaryWorkspaceId = workspaceIds?.[0];
  const { data: workspaceFieldDefs = [] } = useWorkspaceCustomFields(primaryWorkspaceId);
  const { data: projectFieldDefs = [] } = useProjectCustomFields(
    isOpen && task.projectId ? task.projectId : undefined,
  );
  const fieldDefinitions = task.projectId ? projectFieldDefs : workspaceFieldDefs;
  const fieldsAvailableToAdd = useMemo(() => {
    if (!task.projectId) return [];
    const onProject = new Set(projectFieldDefs.map((f) => f.id));
    return workspaceFieldDefs.filter((f) => !onProject.has(f.id));
  }, [task.projectId, projectFieldDefs, workspaceFieldDefs]);

  const memberDirectory = useMemo(() => {
    const map = new Map<string, User>();
    if (!workspaceIds?.length || !workspaces?.length) return map;
    for (const wid of workspaceIds) {
      const ws = workspaces.find((w) => w.id === wid);
      ws?.members?.forEach((m) => map.set(m.userId, m.user));
    }
    return map;
  }, [workspaceIds, workspaces]);

  const assignableUsers = useMemo(() => {
    const taken = new Set((task.assignees ?? []).map((a) => a.userId));
    return [...memberDirectory.values()].filter((u) => !taken.has(u.id));
  }, [memberDirectory, task.assignees]);

  const resolveMentionName = useCallback(
    (userId: string) => memberDirectory.get(userId)?.displayName,
    [memberDirectory],
  );

  const { data: comments, isLoading: commentsLoading } = useTaskComments(
    isOpen ? task.id : undefined,
  );
  const { mutate: createComment, isPending: commentPosting } = useCreateComment(
    isOpen ? task.id : undefined,
  );

  const { commentRoots, commentByParent } = useMemo(() => {
    const list = comments ?? [];
    const byParent = new Map<string | null, Comment[]>();
    for (const c of list) {
      const p = c.parentCommentId ?? null;
      const arr = byParent.get(p) ?? [];
      arr.push(c);
      byParent.set(p, arr);
    }
    for (const arr of byParent.values()) {
      arr.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    const roots = byParent.get(null) ?? [];
    const withStringKeys = new Map<string, Comment[]>();
    for (const [k, v] of byParent) {
      if (k !== null) withStringKeys.set(k, v);
    }
    return { commentRoots: roots, commentByParent: withStringKeys };
  }, [comments]);

  const replyPreviewName = useMemo(() => {
    if (!replyToId || !comments?.length) return null;
    const c = comments.find((x) => x.id === replyToId);
    return c?.author?.displayName ?? 'Comment';
  }, [replyToId, comments]);

  const insertMention = useCallback((userId: string) => {
    const token = `@${userId} `;
    const el = commentTextareaRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      setCommentDraft((prev) => prev.slice(0, start) + token + prev.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setCommentDraft((d) => `${d}${token}`);
    }
  }, []);
  const { data: auditRows } = useTaskAuditLogs(isOpen ? task.id : undefined);

  const storyTimeline = useMemo(() => {
    type Row =
      | { kind: 'activity'; at: number; log: TaskActivityLog }
      | { kind: 'audit'; at: number; row: import('../../hooks/useAuditLogs').AuditLogRow };
    const activity = (task.activityLogs ?? []).map((log) => ({
      kind: 'activity' as const,
      at: new Date(log.createdAt).getTime(),
      log,
    }));
    const audit = (auditRows ?? []).map((row) => ({
      kind: 'audit' as const,
      at: new Date(row.createdAt).getTime(),
      row,
    }));
    return [...activity, ...audit].sort((a, b) => b.at - a.at);
  }, [task.activityLogs, auditRows]);

  const waitingBlockingIds = useMemo(
    () => new Set((task.waitingOn ?? []).map((d) => d.blockingId)),
    [task.waitingOn],
  );

  const dependencyCandidates = useMemo(() => {
    if (!task.projectId) return [];
    return projectTasks.filter((t) => t.id !== task.id && !waitingBlockingIds.has(t.id));
  }, [projectTasks, task.id, task.projectId, waitingBlockingIds]);

  useEffect(() => {
    setEditTitle(task.title);
    setDescription(task.description || '');
    setActorTier(task.actorTier as ActorTier);
    setDomain(task.domain as TaskDomain);
    setComplexity(task.complexity as TaskComplexity);
    setReviewGate(task.reviewGate as ReviewGate);
    setPhase(task.phase != null ? String(task.phase) : '');
    setParallelGroup(task.parallelGroup || '');
    setAgentContextStr(JSON.stringify(task.agentContext ?? {}, null, 2));
    setAgentOutputStr(JSON.stringify(task.agentOutput ?? {}, null, 2));
    setAgentJsonError(null);
  }, [task]);

  const handleSaveTitle = () => {
    if (editTitle.trim()) {
      updateTask({ taskId: task.id, title: editTitle }, { onSuccess: () => setEditMode(false) });
    }
  };

  const saveDescription = useCallback(() => {
    const next = description.trim();
    if (next === (task.description || '')) return;
    updateTask({ taskId: task.id, description: next || null });
  }, [description, task.description, task.id, updateTask]);

  const saveAgentSettings = () => {
    let agentContext: Record<string, unknown> | undefined;
    let agentOutput: Record<string, unknown> | null | undefined;
    try {
      agentContext =
        agentContextStr.trim() === '' ? {} : (JSON.parse(agentContextStr) as Record<string, unknown>);
    } catch {
      setAgentJsonError('Agent context is not valid JSON');
      return;
    }
    try {
      if (agentOutputStr.trim() === '') {
        agentOutput = null;
      } else {
        agentOutput = JSON.parse(agentOutputStr) as Record<string, unknown>;
      }
    } catch {
      setAgentJsonError('Agent output is not valid JSON');
      return;
    }
    setAgentJsonError(null);
    const phaseNum = phase.trim() === '' ? null : parseInt(phase, 10);
    updateTask({
      taskId: task.id,
      actorTier,
      domain,
      complexity,
      reviewGate,
      phase: Number.isNaN(phaseNum as number) ? null : phaseNum,
      parallelGroup: parallelGroup.trim() || null,
      agentContext,
      agentOutput,
    });
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const body = commentDraft.trim();
    if (!body) return;
    createComment(
      {
        body,
        parentCommentId: replyToId ?? undefined,
        mentionedUserIds: extractMentionIdsFromBody(body),
      },
      {
        onSuccess: () => {
          setCommentDraft('');
          setReplyToId(null);
        },
      },
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-40"
          />
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Task Details</h2>
                {detailLoading && (
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" aria-hidden />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ExternalLink className="w-5 h-5 text-gray-600" />
                </button>
                <button type="button" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
                <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {editMode ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setEditMode(false);
                  }}
                  className="w-full text-xl font-bold border border-brand-500 rounded-lg px-3 py-2 focus:outline-none"
                />
              ) : (
                <h1
                  onClick={() => setEditMode(true)}
                  className="text-2xl font-bold text-gray-900 cursor-text hover:text-gray-600"
                >
                  {task.title}
                </h1>
              )}

              <Badge type="status" value={task.status} size="md" />

              <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                    Due date
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                      value={toDateInputValue(task.dueDate)}
                      onChange={(e) => {
                        const iso = fromDateInputValue(e.target.value);
                        updateTask({
                          taskId: task.id,
                          dueDate: iso === null ? null : iso,
                        });
                      }}
                    />
                    {task.dueDate && (
                      <button
                        type="button"
                        onClick={() => updateTask({ taskId: task.id, dueDate: null })}
                        className="text-xs text-gray-600 hover:text-red-600 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="task-detail-priority"
                    className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5"
                  >
                    Priority
                  </label>
                  <select
                    id="task-detail-priority"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
                    value={task.priority}
                    onChange={(e) =>
                      updateTask({
                        taskId: task.id,
                        priority: e.target.value as TaskPriority,
                      })
                    }
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p === 'NONE' ? 'None' : p.charAt(0) + p.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                    Assignees
                  </label>
                  <div className="space-y-2">
                    {(task.assignees ?? []).map((assignee) => (
                      <div
                        key={assignee.id}
                        className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={assignee.user.displayName} size="sm" />
                          <span className="text-sm text-gray-900 truncate">
                            {assignee.user.displayName}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={unassigning}
                          onClick={() =>
                            unassignUser({ taskId: task.id, userId: assignee.userId })
                          }
                          className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {assignableUsers.length > 0 && (
                      <select
                        className="w-full text-sm border border-dashed border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-600"
                        disabled={assigning}
                        defaultValue=""
                        onChange={(e) => {
                          const uid = e.target.value;
                          if (!uid) return;
                          assignUser({ taskId: task.id, userId: uid });
                          e.target.value = '';
                        }}
                      >
                        <option value="">
                          {assigning ? 'Adding…' : '+ Add assignee'}
                        </option>
                        {assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName}
                          </option>
                        ))}
                      </select>
                    )}
                    {assignableUsers.length === 0 &&
                      (!task.assignees || task.assignees.length === 0) && (
                        <p className="text-xs text-gray-500">
                          No workspace members available. Open a project linked to a workspace with
                          teammates to assign tasks.
                        </p>
                      )}
                  </div>
                </div>
              </div>

              {task.projectId && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-800">Planning</h3>
                  <div>
                    <label
                      htmlFor="task-detail-work-type"
                      className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5"
                    >
                      Work item type
                    </label>
                    <select
                      id="task-detail-work-type"
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
                      value={task.workItemType ?? 'TASK'}
                      onChange={(e) =>
                        updateTask({
                          taskId: task.id,
                          workItemType: e.target.value as TaskWorkItemType,
                        })
                      }
                    >
                      {WORK_ITEM_OPTIONS.map((w) => (
                        <option key={w} value={w}>
                          {w.charAt(0) + w.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="task-detail-points"
                      className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5"
                    >
                      Story points
                    </label>
                    <input
                      id="task-detail-points"
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="—"
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
                      value={task.storyPoints ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateTask({
                          taskId: task.id,
                          storyPoints: raw === '' ? null : Number(raw),
                        });
                      }}
                    />
                  </div>
                  {task.workItemType !== 'EPIC' ? (
                    <div>
                      <label
                        htmlFor="task-detail-epic-link"
                        className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5"
                      >
                        Epic
                      </label>
                      <select
                        id="task-detail-epic-link"
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
                        value={task.epicTaskId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateTask({
                            taskId: task.id,
                            epicTaskId: v === '' ? null : v,
                          });
                        }}
                      >
                        <option value="">None</option>
                        {epicLinkOrphan && task.epicTaskId && (
                          <option value={task.epicTaskId}>
                            Linked epic (not in project tree)
                          </option>
                        )}
                        {epicPickerOptions.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.title}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Link this work to an epic without nesting it under that task.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Epic work items are not linked to another epic.
                    </p>
                  )}
                  <div>
                    <label
                      htmlFor="task-detail-sprint"
                      className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5"
                    >
                      Sprint
                    </label>
                    <select
                      id="task-detail-sprint"
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
                      value={task.sprintId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateTask({
                          taskId: task.id,
                          sprintId: v === '' ? null : v,
                        });
                      }}
                    >
                      <option value="">Backlog (no sprint)</option>
                      {sprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!task.sprintId && (
                    <div>
                      <label
                        htmlFor="task-detail-backlog-rank"
                        className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5"
                      >
                        Backlog rank
                      </label>
                      <input
                        id="task-detail-backlog-rank"
                        type="number"
                        step={1}
                        placeholder="—"
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
                        value={task.backlogRank ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            updateTask({ taskId: task.id, backlogRank: null });
                            return;
                          }
                          const n = parseInt(raw, 10);
                          if (!Number.isFinite(n)) return;
                          updateTask({ taskId: task.id, backlogRank: n });
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Lower numbers list first on the Backlog tab (unscheduled tasks only).
                      </p>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      checked={task.isMilestone ?? false}
                      onChange={(e) =>
                        updateTask({
                          taskId: task.id,
                          isMilestone: e.target.checked,
                        })
                      }
                    />
                    Milestone (timeline diamond)
                  </label>
                  <div className="pt-1 border-t border-gray-100 space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      New sprint
                    </p>
                    <input
                      type="text"
                      placeholder="Sprint name"
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                      value={newSprintName}
                      onChange={(e) => setNewSprintName(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                        value={newSprintStart}
                        onChange={(e) => setNewSprintStart(e.target.value)}
                      />
                      <input
                        type="date"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                        value={newSprintEnd}
                        onChange={(e) => setNewSprintEnd(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        creatingSprint ||
                        !newSprintName.trim() ||
                        !newSprintStart ||
                        !newSprintEnd
                      }
                      onClick={() => {
                        const startIso = fromDateInputValue(newSprintStart);
                        const endIso = fromDateInputValue(newSprintEnd);
                        if (!startIso || !endIso) return;
                        createSprint(
                          {
                            name: newSprintName.trim(),
                            startDate: startIso,
                            endDate: endIso,
                          },
                          {
                            onSuccess: (sp) => {
                              setNewSprintName('');
                              setNewSprintStart('');
                              setNewSprintEnd('');
                              updateTask({ taskId: task.id, sprintId: sp.id });
                            },
                          },
                        );
                      }}
                    >
                      {creatingSprint ? 'Creating…' : 'Create & assign'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-800">Repeat & template</h3>
                <div>
                  <label
                    htmlFor="task-detail-repeat"
                    className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5"
                  >
                    Repeat
                  </label>
                  <select
                    id="task-detail-repeat"
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
                    value={
                      RECURRENCE_PRESETS.some((p) => p.value === (task.recurrenceRule || ''))
                        ? task.recurrenceRule || ''
                        : task.recurrenceRule
                          ? '__custom__'
                          : ''
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__custom__') return;
                      updateTask({
                        taskId: task.id,
                        recurrenceRule: v ? v : null,
                      });
                    }}
                  >
                    {RECURRENCE_PRESETS.map((p) => (
                      <option key={p.value || 'none'} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                    {task.recurrenceRule &&
                      !RECURRENCE_PRESETS.some((p) => p.value === task.recurrenceRule) && (
                        <option value="__custom__">Custom (edit via API)</option>
                      )}
                  </select>
                  {task.recurrenceRule &&
                    !RECURRENCE_PRESETS.some((p) => p.value === task.recurrenceRule) && (
                      <p className="text-xs text-gray-500 mt-1 font-mono break-all">
                        {task.recurrenceRule}
                      </p>
                    )}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5">
                    Repeat until
                  </label>
                  <input
                    type="date"
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-full"
                    value={toDateInputValue(task.recurrenceUntil)}
                    onChange={(e) => {
                      const iso = fromDateInputValue(e.target.value);
                      updateTask({
                        taskId: task.id,
                        recurrenceUntil: iso === null ? null : iso,
                      });
                    }}
                  />
                  {task.recurrenceUntil && (
                    <button
                      type="button"
                      onClick={() =>
                        updateTask({ taskId: task.id, recurrenceUntil: null })
                      }
                      className="text-xs text-gray-600 hover:text-red-600 underline mt-1"
                    >
                      Clear end date
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    checked={Boolean(task.isTemplate)}
                    onChange={(e) =>
                      updateTask({ taskId: task.id, isTemplate: e.target.checked })
                    }
                  />
                  Task template (hidden from list/board)
                </label>
                {task.projectId && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Copy className="w-4 h-4" />}
                    disabled={duplicating}
                    onClick={() =>
                      duplicateTask({
                        taskId: task.id,
                        projectId: task.projectId,
                        sectionId: task.sectionId,
                      })
                    }
                  >
                    {duplicating ? 'Duplicating…' : 'Duplicate into project'}
                  </Button>
                )}
              </div>

              {task.projectId && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-800">Subtasks</h3>
                  {task.subtasks && task.subtasks.length > 0 ? (
                    <SubtaskTree nodes={task.subtasks} depth={0} onSelect={openTask} />
                  ) : (
                    <p className="text-xs text-gray-500">No subtasks yet.</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                      placeholder="New subtask title…"
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={creatingSubtask || !subtaskTitle.trim()}
                      onClick={() => {
                        const title = subtaskTitle.trim();
                        if (!title || !task.projectId) return;
                        createTask(
                          {
                            projectId: task.projectId,
                            sectionId: task.sectionId,
                            parentTaskId: task.id,
                            title,
                          },
                          {
                            onSuccess: () => setSubtaskTitle(''),
                          },
                        );
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {task.projectId && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-800">Dependencies</h3>
                  <p className="text-xs text-gray-500">
                    This task is waiting on the following tasks to finish first.
                  </p>
                  <ul className="space-y-2">
                    {(task.waitingOn ?? []).map((dep) => (
                      <li
                        key={dep.id}
                        className="flex items-center justify-between gap-2 text-sm border border-gray-100 rounded-lg px-2 py-1.5 bg-gray-50"
                      >
                        <button
                          type="button"
                          onClick={() => dep.blockingTask && openTask(dep.blockingTask.id)}
                          className="text-left text-gray-900 hover:text-brand-600 font-medium truncate"
                        >
                          {dep.blockingTask?.title ?? dep.blockingId}
                        </button>
                        <button
                          type="button"
                          disabled={removingDep}
                          onClick={() =>
                            removeDependency({ taskId: task.id, blockingTaskId: dep.blockingId })
                          }
                          className="text-xs text-gray-500 hover:text-red-600 shrink-0"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  {dependencyCandidates.length > 0 ? (
                    <select
                      key={(task.waitingOn ?? [])
                        .map((d) => d.blockingId)
                        .sort()
                        .join(',')}
                      className="w-full text-sm border border-dashed border-gray-300 rounded-lg px-2 py-2 bg-white text-gray-600"
                      disabled={addingDep}
                      defaultValue=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        addDependency({ taskId: task.id, blockingTaskId: id });
                        e.target.value = '';
                      }}
                    >
                      <option value="">{addingDep ? 'Adding…' : '+ Add dependency (waiting on…)'}</option>
                      {dependencyCandidates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-gray-500">
                      No other tasks in this project to link, or all are already linked.
                    </p>
                  )}
                  {(task.blockingTasks ?? []).length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-600 mb-1">Blocking</p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {(task.blockingTasks ?? []).map((dep) => (
                          <li key={dep.id}>
                            <button
                              type="button"
                              onClick={() => dep.dependentTask && openTask(dep.dependentTask.id)}
                              className="hover:text-brand-600 text-left"
                            >
                              {dep.dependentTask?.title ?? dep.dependentId} depends on this task
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {((task.projectId && isOpen) ||
                (!!primaryWorkspaceId && fieldDefinitions.length > 0)) && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-800">Custom fields</h3>
                  {task.projectId && fieldDefinitions.length === 0 && (
                    <p className="text-xs text-gray-500">
                      No custom fields on this project yet. Add one from your workspace definitions
                      below.
                    </p>
                  )}
                  <div className="space-y-3">
                    {fieldDefinitions.map((def) => {
                      const existing = task.customFields?.find((v) => v.fieldId === def.id);
                      const display = fieldValueToDisplay(existing?.value);
                      const wsForApi = def.workspaceId || primaryWorkspaceId;
                      if (!wsForApi) return null;
                      return (
                        <div key={def.id}>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                            {def.name}
                            {def.isRequired && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                          {def.type === 'TEXT' || def.type === 'URL' || def.type === 'PERSON' ? (
                            <input
                              type={def.type === 'URL' ? 'url' : 'text'}
                              defaultValue={display}
                              key={`${task.id}-${def.id}-${display}`}
                              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                setCustomFieldValue({
                                  workspaceId: wsForApi,
                                  taskId: task.id,
                                  fieldId: def.id,
                                  value: { text: v },
                                });
                              }}
                            />
                          ) : def.type === 'NUMBER' ? (
                            <input
                              type="number"
                              defaultValue={display}
                              key={`${task.id}-${def.id}-num`}
                              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                              onBlur={(e) => {
                                const n = parseFloat(e.target.value);
                                setCustomFieldValue({
                                  workspaceId: wsForApi,
                                  taskId: task.id,
                                  fieldId: def.id,
                                  value: { value: Number.isNaN(n) ? null : n },
                                });
                              }}
                            />
                          ) : def.type === 'DATE' ? (
                            <input
                              type="date"
                              defaultValue={display ? display.slice(0, 10) : ''}
                              key={`${task.id}-${def.id}-date`}
                              className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                              onBlur={(e) => {
                                const v = e.target.value;
                                setCustomFieldValue({
                                  workspaceId: wsForApi,
                                  taskId: task.id,
                                  fieldId: def.id,
                                  value: { text: v ? new Date(`${v}T12:00:00`).toISOString() : '' },
                                });
                              }}
                            />
                          ) : def.type === 'CHECKBOX' ? (
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                defaultChecked={Boolean(existing?.value && (existing.value as { checked?: boolean }).checked)}
                                onChange={(e) => {
                                  setCustomFieldValue({
                                    workspaceId: wsForApi,
                                    taskId: task.id,
                                    fieldId: def.id,
                                    value: { checked: e.target.checked },
                                  });
                                }}
                              />
                              Yes
                            </label>
                          ) : (
                            <textarea
                              defaultValue={display}
                              key={`${task.id}-${def.id}-json`}
                              className="w-full text-xs font-mono border border-gray-200 rounded-lg px-2 py-1.5 h-16"
                              onBlur={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value || '{}') as Record<
                                    string,
                                    unknown
                                  >;
                                  setCustomFieldValue({
                                    workspaceId: wsForApi,
                                    taskId: task.id,
                                    fieldId: def.id,
                                    value: parsed,
                                  });
                                } catch {
                                  /* ignore invalid JSON */
                                }
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {task.projectId && fieldsAvailableToAdd.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Add field to project
                      </label>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                        disabled={addingProjectField}
                        defaultValue=""
                        onChange={(e) => {
                          const fieldId = e.target.value;
                          if (!fieldId || !task.projectId) return;
                          addProjectCustomField({ projectId: task.projectId, fieldId });
                          e.target.value = '';
                        }}
                      >
                        <option value="">
                          {addingProjectField ? 'Adding…' : 'Choose a workspace field…'}
                        </option>
                        {fieldsAvailableToAdd.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-800">Attachments</h3>
                <ul className="space-y-2">
                  {(task.attachments ?? []).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 text-sm border border-gray-100 rounded-lg px-2 py-1.5 bg-gray-50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          openTaskAttachment({
                            id: a.id,
                            url: a.url,
                            filename: a.filename,
                          }).catch(() => {
                            /* optional: toast */
                          });
                        }}
                        className="text-brand-600 hover:underline truncate text-left"
                      >
                        {a.filename}
                      </button>
                      <button
                        type="button"
                        disabled={deletingAttachment}
                        onClick={() => deleteAttachment({ taskId: task.id, attachmentId: a.id })}
                        className="text-xs text-gray-500 hover:text-red-600 shrink-0"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                {(task.attachments ?? []).length === 0 && (
                  <p className="text-xs text-gray-500">No attachments yet.</p>
                )}
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-gray-500">Upload a file from your device (stored on the server for now).</p>
                  <input
                    type="file"
                    id={`task-upload-${task.id}`}
                    className="sr-only"
                    disabled={uploadingAttachment}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      uploadAttachment({ taskId: task.id, file: f });
                      e.target.value = '';
                    }}
                  />
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={uploadingAttachment}
                      onClick={() =>
                        document.getElementById(`task-upload-${task.id}`)?.click()
                      }
                    >
                      {uploadingAttachment ? 'Uploading…' : 'Choose file'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                    Or add a link attachment (URL to a file or doc).
                  </p>
                  <input
                    type="text"
                    placeholder="File name"
                    value={attachFilename}
                    onChange={(e) => setAttachFilename(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                  />
                  <input
                    type="url"
                    placeholder="https://…"
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      addingAttachment || !attachFilename.trim() || !attachUrl.trim()
                    }
                    onClick={() => {
                      const filename = attachFilename.trim();
                      const url = attachUrl.trim();
                      if (!filename || !url) return;
                      addAttachment(
                        {
                          taskId: task.id,
                          filename,
                          url,
                          mimeType: 'application/octet-stream',
                          sizeBytes: 0,
                        },
                        {
                          onSuccess: () => {
                            setAttachFilename('');
                            setAttachUrl('');
                          },
                        },
                      );
                    }}
                  >
                    Attach link
                  </Button>
                </div>
              </div>

              {storyTimeline.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Activity &amp; audit
                  </h3>
                  <ul className="space-y-3 text-sm max-h-72 overflow-y-auto pr-1">
                    {storyTimeline.map((item) =>
                      item.kind === 'activity' ? (
                        <li
                          key={`a-${item.log.id}`}
                          className="border-l-2 border-brand-200 pl-3"
                        >
                          <div className="text-gray-800">{item.log.description}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span className="font-medium text-gray-600">
                              {item.log.actor?.displayName ?? 'Someone'}
                            </span>
                            <span className="mx-1">·</span>
                            {formatDistanceToNow(new Date(item.log.createdAt), {
                              addSuffix: true,
                            })}
                            <span className="mx-1 text-gray-400">·</span>
                            <span className="text-gray-400">{item.log.eventType}</span>
                          </div>
                        </li>
                      ) : (
                        <li
                          key={`u-${item.row.id}`}
                          className="border-l-2 border-gray-300 pl-3"
                        >
                          <div className="text-gray-800">{item.row.description}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span className="text-gray-500">System / agent</span>
                            <span className="mx-1">·</span>
                            {formatDistanceToNow(new Date(item.row.createdAt), {
                              addSuffix: true,
                            })}
                            <span className="mx-1 text-gray-400">·</span>
                            <span className="text-gray-400">{item.row.eventType}</span>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Description</h3>
                <textarea
                  placeholder="Add a description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={saveDescription}
                  className="w-full h-28 p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium text-purple-900">Agent settings (ModelT)</h3>
                <div className="grid gap-3 text-sm">
                  <div>
                    <label className="text-purple-700 font-medium block mb-1">Actor tier</label>
                    <select
                      value={actorTier}
                      onChange={(e) => setActorTier(e.target.value as ActorTier)}
                      className="w-full px-2 py-1.5 border border-purple-200 rounded text-gray-900 bg-white"
                    >
                      {actorTierValues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-700 font-medium block mb-1">Domain</label>
                    <select
                      value={domain}
                      onChange={(e) => setDomain(e.target.value as TaskDomain)}
                      className="w-full px-2 py-1.5 border border-purple-200 rounded text-gray-900 bg-white"
                    >
                      {domainValues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-700 font-medium block mb-1">Complexity</label>
                    <select
                      value={complexity}
                      onChange={(e) => setComplexity(e.target.value as TaskComplexity)}
                      className="w-full px-2 py-1.5 border border-purple-200 rounded text-gray-900 bg-white"
                    >
                      {complexityValues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-700 font-medium block mb-1">Review gate</label>
                    <select
                      value={reviewGate}
                      onChange={(e) => setReviewGate(e.target.value as ReviewGate)}
                      className="w-full px-2 py-1.5 border border-purple-200 rounded text-gray-900 bg-white"
                    >
                      {reviewGateValues.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-purple-700 font-medium block mb-1">Phase (0–8)</label>
                    <input
                      value={phase}
                      onChange={(e) => setPhase(e.target.value)}
                      placeholder="optional"
                      className="w-full px-2 py-1.5 border border-purple-200 rounded text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-purple-700 font-medium block mb-1">Parallel group</label>
                    <input
                      value={parallelGroup}
                      onChange={(e) => setParallelGroup(e.target.value)}
                      placeholder="Group id for concurrent work"
                      className="w-full px-2 py-1.5 border border-purple-200 rounded text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-purple-700 font-medium block mb-1">Agent context (JSON)</label>
                    <textarea
                      value={agentContextStr}
                      onChange={(e) => setAgentContextStr(e.target.value)}
                      className="w-full h-24 font-mono text-xs px-2 py-1.5 border border-purple-200 rounded text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-purple-700 font-medium block mb-1">Agent output (JSON)</label>
                    <textarea
                      value={agentOutputStr}
                      onChange={(e) => setAgentOutputStr(e.target.value)}
                      className="w-full h-24 font-mono text-xs px-2 py-1.5 border border-purple-200 rounded text-gray-900 bg-white"
                    />
                  </div>
                </div>
                {agentJsonError && (
                  <p className="text-sm text-red-600">{agentJsonError}</p>
                )}
                <Button type="button" onClick={saveAgentSettings} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Saving…
                    </>
                  ) : (
                    'Save agent settings'
                  )}
                </Button>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Comments</h3>
                {commentsLoading ? (
                  <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                ) : (
                  <ul className="space-y-4 mb-4">
                    {commentRoots.map((root) => (
                      <TaskCommentNode
                        key={root.id}
                        c={root}
                        byParent={commentByParent}
                        resolveMentionName={resolveMentionName}
                        onReply={setReplyToId}
                      />
                    ))}
                  </ul>
                )}
                {replyToId && (
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-600 mb-2 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                    <span>
                      Replying to <span className="font-medium">{replyPreviewName}</span>
                    </span>
                    <button
                      type="button"
                      className="text-brand-700 font-medium hover:underline"
                      onClick={() => setReplyToId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <form onSubmit={submitComment} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      key={mentionSelectKey}
                      className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 max-w-[200px]"
                      defaultValue=""
                      aria-label="Insert mention"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) {
                          insertMention(v);
                          setMentionSelectKey((k) => k + 1);
                        }
                      }}
                    >
                      <option value="">Mention…</option>
                      {[...memberDirectory.values()].map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-500">
                      Inserts <code className="text-gray-600">@userId</code> — shown as @name
                    </span>
                  </div>
                  <textarea
                    ref={commentTextareaRef}
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="Add a comment… Use Mention to notify someone."
                    className="w-full h-20 p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <Button type="submit" size="sm" disabled={commentPosting || !commentDraft.trim()}>
                    {replyToId ? 'Reply' : 'Comment'}
                  </Button>
                </form>
              </div>

              {auditRows && auditRows.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Audit trail</h3>
                  <ul className="space-y-2 text-xs text-gray-600 max-h-48 overflow-y-auto">
                    {auditRows.map((row) => (
                      <li key={row.id} className="border-l-2 border-purple-200 pl-2">
                        <span className="font-medium text-gray-800">{row.eventType}</span>
                        <span className="text-gray-400 mx-1">·</span>
                        {row.description}
                        <div className="text-gray-400">
                          {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
