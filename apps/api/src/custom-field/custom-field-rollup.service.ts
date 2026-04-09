import { Injectable } from '@nestjs/common';
import {
  CustomFieldComputedKind,
  CustomFieldRollupAggregation,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

type TaskTreeNode = {
  id: string;
  parentTaskId: string | null;
  customFieldValues?: Array<{
    fieldId: string;
    value: unknown;
    field?: {
      id: string;
      computedKind: CustomFieldComputedKind;
      rollupSourceFieldId: string | null;
      rollupAggregation: CustomFieldRollupAggregation | null;
      type: string;
      name: string;
      workspaceId: string;
      options: unknown;
      isRequired: boolean;
      description: string | null;
      defaultValue: unknown;
      createdAt: Date;
    };
  }>;
  subtasks?: TaskTreeNode[];
};

function flattenTaskTree(nodes: TaskTreeNode[]): TaskTreeNode[] {
  const out: TaskTreeNode[] = [];
  const walk = (t: TaskTreeNode) => {
    out.push(t);
    for (const st of t.subtasks || []) walk(st);
  };
  for (const n of nodes) walk(n);
  return out;
}

function extractNumberFromCfJson(value: unknown): number | null {
  if (value == null || typeof value !== 'object') return null;
  const v = (value as { value?: unknown }).value;
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function aggregate(
  agg: CustomFieldRollupAggregation,
  numbers: number[],
): number | null {
  if (agg === CustomFieldRollupAggregation.COUNT) {
    return numbers.length;
  }
  if (numbers.length === 0) return null;
  switch (agg) {
    case CustomFieldRollupAggregation.SUM:
      return numbers.reduce((a, b) => a + b, 0);
    case CustomFieldRollupAggregation.AVG: {
      const s = numbers.reduce((a, b) => a + b, 0);
      return s / numbers.length;
    }
    case CustomFieldRollupAggregation.MIN:
      return Math.min(...numbers);
    case CustomFieldRollupAggregation.MAX:
      return Math.max(...numbers);
    default:
      return null;
  }
}

@Injectable()
export class CustomFieldRollupService {
  constructor(private prisma: PrismaService) {}

  /**
   * Mutates each task's `customFieldValues` in a loaded project tree (sections → root tasks → subtasks)
   * by appending synthetic rows for SUBTASK_ROLLUP_NUMBER definitions linked to the project.
   */
  async mergeRollupsIntoProjectTree(projectId: string, project: unknown): Promise<void> {
    const p = project as {
      sections?: Array<{ tasks?: TaskTreeNode[] }>;
    };
    if (!p?.sections?.length) return;

    const links = await this.prisma.projectCustomField.findMany({
      where: { projectId },
      include: { field: true },
    });
    const rollupDefs = links
      .map((l) => l.field)
      .filter(
        (f) =>
          f.computedKind === CustomFieldComputedKind.SUBTASK_ROLLUP_NUMBER &&
          f.rollupSourceFieldId &&
          f.rollupAggregation,
      );
    if (rollupDefs.length === 0) return;

    const rootTasks: TaskTreeNode[] = [];
    for (const s of p.sections) {
      for (const t of s.tasks || []) rootTasks.push(t);
    }
    const flat = flattenTaskTree(rootTasks);
    if (flat.length === 0) return;

    const taskIds = flat.map((t) => t.id);
    const sourceIds = [
      ...new Set(rollupDefs.map((d) => d.rollupSourceFieldId!)),
    ];

    const valueRows = await this.prisma.customFieldValue.findMany({
      where: {
        taskId: { in: taskIds },
        fieldId: { in: sourceIds },
      },
      select: { taskId: true, fieldId: true, value: true },
    });
    const valueMap = new Map<string, number | null>();
    for (const r of valueRows) {
      valueMap.set(`${r.taskId}\0${r.fieldId}`, extractNumberFromCfJson(r.value));
    }

    const childrenByParent = new Map<string, string[]>();
    for (const t of flat) {
      if (t.parentTaskId) {
        const list = childrenByParent.get(t.parentTaskId) ?? [];
        list.push(t.id);
        childrenByParent.set(t.parentTaskId, list);
      }
    }

    const descendantIds = (rootId: string): string[] => {
      const out: string[] = [];
      const stack = [...(childrenByParent.get(rootId) ?? [])];
      while (stack.length) {
        const id = stack.pop()!;
        out.push(id);
        const kids = childrenByParent.get(id);
        if (kids) for (const k of kids) stack.push(k);
      }
      return out;
    };

    for (const task of flat) {
      const desc = descendantIds(task.id);
      for (const def of rollupDefs) {
        const srcId = def.rollupSourceFieldId!;
        const nums: number[] = [];
        for (const tid of desc) {
          const n = valueMap.get(`${tid}\0${srcId}`);
          if (n !== undefined && n !== null) nums.push(n);
        }
        const agg = def.rollupAggregation!;
        const raw = aggregate(agg, nums);
        const synthetic = {
          id: `rollup:${task.id}:${def.id}`,
          taskId: task.id,
          fieldId: def.id,
          value: raw === null ? { value: null as unknown as number } : { value: raw },
          field: def,
        };
        if (!task.customFieldValues) task.customFieldValues = [];
        task.customFieldValues.push(synthetic);
      }
    }
  }

  /**
   * Task detail: append rollup rows for the root task and every nested subtask in the loaded tree,
   * using the full project hierarchy for descendant traversal.
   */
  async mergeRollupsForTaskDetailTree(
    root: TaskTreeNode & { projectId: string | null },
  ): Promise<void> {
    if (!root.projectId) return;

    const links = await this.prisma.projectCustomField.findMany({
      where: { projectId: root.projectId },
      include: { field: true },
    });
    const rollupDefs = links
      .map((l) => l.field)
      .filter(
        (f) =>
          f.computedKind === CustomFieldComputedKind.SUBTASK_ROLLUP_NUMBER &&
          f.rollupSourceFieldId &&
          f.rollupAggregation,
      );
    if (rollupDefs.length === 0) return;

    const flat = flattenTaskTree([root]);
    if (flat.length === 0) return;

    const projTasks = await this.prisma.task.findMany({
      where: { projectId: root.projectId, deletedAt: null },
      select: { id: true, parentTaskId: true },
    });
    if (projTasks.length === 0) return;

    const taskIds = projTasks.map((t) => t.id);
    const sourceIds = [
      ...new Set(rollupDefs.map((d) => d.rollupSourceFieldId!)),
    ];
    const valueRows = await this.prisma.customFieldValue.findMany({
      where: {
        taskId: { in: taskIds },
        fieldId: { in: sourceIds },
      },
      select: { taskId: true, fieldId: true, value: true },
    });
    const valueMap = new Map<string, number | null>();
    for (const r of valueRows) {
      valueMap.set(`${r.taskId}\0${r.fieldId}`, extractNumberFromCfJson(r.value));
    }

    const childrenByParent = new Map<string, string[]>();
    for (const t of projTasks) {
      if (t.parentTaskId) {
        const list = childrenByParent.get(t.parentTaskId) ?? [];
        list.push(t.id);
        childrenByParent.set(t.parentTaskId, list);
      }
    }

    const descendantIds = (rootId: string): string[] => {
      const out: string[] = [];
      const stack = [...(childrenByParent.get(rootId) ?? [])];
      while (stack.length) {
        const id = stack.pop()!;
        out.push(id);
        const kids = childrenByParent.get(id);
        if (kids) for (const k of kids) stack.push(k);
      }
      return out;
    };

    for (const task of flat) {
      const desc = descendantIds(task.id);
      for (const def of rollupDefs) {
        const srcId = def.rollupSourceFieldId!;
        const nums: number[] = [];
        for (const tid of desc) {
          const n = valueMap.get(`${tid}\0${srcId}`);
          if (n !== undefined && n !== null) nums.push(n);
        }
        const agg = def.rollupAggregation!;
        const raw = aggregate(agg, nums);
        const synthetic = {
          id: `rollup:${task.id}:${def.id}`,
          taskId: task.id,
          fieldId: def.id,
          value: raw === null ? { value: null as unknown as number } : { value: raw },
          field: def,
        };
        if (!task.customFieldValues) task.customFieldValues = [];
        task.customFieldValues.push(synthetic);
      }
    }
  }
}
