import { BadRequestException } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import type { PrismaService } from '../common/prisma.service';
import type { GoalMetricDefinition } from '@vineroot/shared-types';

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function parseYmdLocal(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) throw new BadRequestException(`Invalid date (use YYYY-MM-DD): ${ymd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    throw new BadRequestException(`Invalid calendar date: ${ymd}`);
  }
  return dt;
}

function workspaceTaskBase(workspaceId: string): Prisma.TaskWhereInput {
  return {
    deletedAt: null,
    isTemplate: false,
    OR: [
      { workspaceId },
      {
        project: {
          deletedAt: null,
          workspaceLinks: { some: { workspaceId } },
        },
      },
    ],
  };
}

async function assertProjectInWorkspace(
  prisma: PrismaService,
  workspaceId: string,
  projectId: string,
): Promise<void> {
  const row = await prisma.projectWorkspace.findFirst({
    where: { workspaceId, projectId, project: { deletedAt: null } },
    select: { projectId: true },
  });
  if (!row) {
    throw new BadRequestException(`Project ${projectId} is not in this workspace`);
  }
}

/** Preset or explicit range → [from, to] inclusive end-of-day. */
export function resolveGoalMetricPeriod(def: {
  preset?: 'CURRENT_QUARTER' | 'CURRENT_MONTH' | 'CURRENT_YEAR' | 'RANGE';
  from?: string;
  to?: string;
}): { from: Date; to: Date } {
  const now = new Date();
  if (def.preset === 'CURRENT_QUARTER') {
    const q = Math.floor(now.getMonth() / 3);
    const startMonth = q * 3;
    const from = new Date(now.getFullYear(), startMonth, 1);
    const to = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999);
    return { from: startOfLocalDay(from), to };
  }
  if (def.preset === 'CURRENT_MONTH') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: startOfLocalDay(from), to };
  }
  if (def.preset === 'CURRENT_YEAR') {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { from: startOfLocalDay(from), to };
  }
  if (def.from && def.to) {
    const fromD = startOfLocalDay(parseYmdLocal(def.from));
    const toD = endOfLocalDay(parseYmdLocal(def.to));
    if (fromD.getTime() > toD.getTime()) {
      throw new BadRequestException('Period from must be before or equal to to');
    }
    return { from: fromD, to: toD };
  }
  throw new BadRequestException('Goal metric period requires preset or from/to');
}

export function parseGoalMetricDefinition(raw: unknown): GoalMetricDefinition | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind === 'TASK_COUNT') {
    const out: Extract<GoalMetricDefinition, { kind: 'TASK_COUNT' }> = { kind: 'TASK_COUNT' };
    if (typeof o.projectId === 'string' && o.projectId) out.projectId = o.projectId;
    if (Array.isArray(o.statuses)) {
      out.statuses = o.statuses.filter((x) => typeof x === 'string') as string[];
    }
    if (o.period && typeof o.period === 'object') {
      out.period = o.period as NonNullable<
        Extract<GoalMetricDefinition, { kind: 'TASK_COUNT' }>['period']
      >;
    }
    return out;
  }
  if (kind === 'CUSTOM_FIELD_SUM') {
    if (typeof o.fieldId !== 'string' || !o.fieldId) return null;
    return {
      kind: 'CUSTOM_FIELD_SUM',
      fieldId: o.fieldId,
      aggregate: 'sum',
      ...(typeof o.projectId === 'string' && o.projectId ? { projectId: o.projectId } : {}),
    };
  }
  if (kind === 'EPIC_CHILDREN_PERCENT') {
    if (typeof o.epicTaskId !== 'string' || !o.epicTaskId) return null;
    return { kind: 'EPIC_CHILDREN_PERCENT', epicTaskId: o.epicTaskId };
  }
  return null;
}

export async function computeGoalMetricValue(
  prisma: PrismaService,
  workspaceId: string,
  definition: GoalMetricDefinition,
): Promise<{ value: number } | { error: string }> {
  try {
    switch (definition.kind) {
      case 'TASK_COUNT':
        return await computeTaskCount(prisma, workspaceId, definition);
      case 'CUSTOM_FIELD_SUM':
        return await computeCustomFieldSum(prisma, workspaceId, definition);
      case 'EPIC_CHILDREN_PERCENT':
        return await computeEpicChildrenPercent(prisma, workspaceId, definition);
      default:
        return { error: 'Unknown metric kind' };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

async function computeTaskCount(
  prisma: PrismaService,
  workspaceId: string,
  def: Extract<GoalMetricDefinition, { kind: 'TASK_COUNT' }>,
): Promise<{ value: number } | { error: string }> {
  const and: Prisma.TaskWhereInput[] = [workspaceTaskBase(workspaceId)];
  if (def.projectId) {
    await assertProjectInWorkspace(prisma, workspaceId, def.projectId);
    and.push({ projectId: def.projectId });
  }
  if (def.statuses?.length) {
    for (const s of def.statuses) {
      if (!Object.values(TaskStatus).includes(s as TaskStatus)) {
        return { error: `Invalid status in definition: ${s}` };
      }
    }
    and.push({ status: { in: def.statuses as TaskStatus[] } });
  }
  if (def.period) {
    const { from, to } = resolveGoalMetricPeriod(def.period);
    const st = def.statuses ?? [];
    const completionWindow =
      st.length === 0 || (st.length === 1 && st[0] === 'DONE');
    if (completionWindow) {
      if (st.length === 0) {
        and.push({ status: TaskStatus.DONE });
      }
      and.push({ completedAt: { gte: from, lte: to } });
    } else {
      and.push({ createdAt: { gte: from, lte: to } });
    }
  }
  const n = await prisma.task.count({ where: { AND: and } });
  return { value: n };
}

async function computeCustomFieldSum(
  prisma: PrismaService,
  workspaceId: string,
  def: Extract<GoalMetricDefinition, { kind: 'CUSTOM_FIELD_SUM' }>,
): Promise<{ value: number } | { error: string }> {
  const field = await prisma.customFieldDefinition.findFirst({
    where: { id: def.fieldId, workspaceId },
    select: { id: true, type: true, computedKind: true },
  });
  if (!field) return { error: 'Custom field not found in workspace' };
  if (field.computedKind !== 'NONE') {
    return { error: 'Cannot sum a computed custom field' };
  }
  if (field.type !== 'NUMBER') {
    return { error: 'CUSTOM_FIELD_SUM requires a NUMBER field' };
  }
  if (def.projectId) {
    await assertProjectInWorkspace(prisma, workspaceId, def.projectId);
  }
  const taskWhere: Prisma.TaskWhereInput = {
    ...workspaceTaskBase(workspaceId),
    ...(def.projectId ? { projectId: def.projectId } : {}),
  };
  const rows = await prisma.customFieldValue.findMany({
    where: {
      fieldId: def.fieldId,
      task: taskWhere,
    },
    select: { value: true },
  });
  let sum = 0;
  for (const r of rows) {
    const v = r.value;
    if (typeof v === 'number' && Number.isFinite(v)) sum += v;
    else if (typeof v === 'string' && v.trim() !== '') {
      const n = parseFloat(v);
      if (Number.isFinite(n)) sum += n;
    }
  }
  return { value: sum };
}

async function computeEpicChildrenPercent(
  prisma: PrismaService,
  workspaceId: string,
  def: Extract<GoalMetricDefinition, { kind: 'EPIC_CHILDREN_PERCENT' }>,
): Promise<{ value: number } | { error: string }> {
  const epic = await prisma.task.findFirst({
    where: {
      id: def.epicTaskId,
      deletedAt: null,
      project: { workspaceLinks: { some: { workspaceId } }, deletedAt: null },
    },
    select: { id: true, projectId: true },
  });
  if (!epic?.projectId) {
    return { error: 'Epic task not found in workspace' };
  }
  const tasks = await prisma.task.findMany({
    where: { projectId: epic.projectId, deletedAt: null, isTemplate: false },
    select: {
      id: true,
      parentTaskId: true,
      epicTaskId: true,
      status: true,
    },
  });
  const children = new Map<string, string[]>();
  for (const t of tasks) {
    if (t.parentTaskId) {
      const c = children.get(t.parentTaskId) ?? [];
      c.push(t.id);
      children.set(t.parentTaskId, c);
    }
  }
  function collectDescendants(rootId: string): Set<string> {
    const out = new Set<string>();
    const stack = [...(children.get(rootId) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (out.has(id)) continue;
      out.add(id);
      for (const c of children.get(id) ?? []) stack.push(c);
    }
    return out;
  }
  function collectEpicLinked(epicId: string, treeDesc: Set<string>): Set<string> {
    const all = new Set(treeDesc);
    for (const t of tasks) {
      if (t.epicTaskId === epicId) all.add(t.id);
    }
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of tasks) {
        if (all.has(t.id)) continue;
        if (t.epicTaskId && all.has(t.epicTaskId)) {
          all.add(t.id);
          grew = true;
        }
      }
    }
    return all;
  }
  const desc = collectEpicLinked(epic.id, collectDescendants(epic.id));
  if (desc.size === 0) return { value: 0 };
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let done = 0;
  for (const id of desc) {
    if (byId.get(id)?.status === TaskStatus.DONE) done += 1;
  }
  return { value: Math.round((done / desc.size) * 1000) / 10 };
}
