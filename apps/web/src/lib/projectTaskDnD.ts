import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import type { Section, Task } from '../types';
import { buildTaskMapFromSections, getDirectChildIds } from './projectTaskTree';

/** Matches API list/board nested include depth (root depth 0 … max 4). */
export const MAX_SUBTASK_DEPTH = 4;

export type ReorderTaskItem = {
  taskId: string;
  sortOrder: number;
  sectionId?: string;
  /** Omit = leave parent unchanged; `null` = top-level in column. */
  parentTaskId?: string | null;
};

/** Droppable id for a parent's direct-subtask list (`${SUBTASKS_DROP_PREFIX}${parentTaskId}`). */
export const SUBTASKS_DROP_PREFIX = 'subtasks:';

export function subtasksDropId(parentTaskId: string): string {
  return `${SUBTASKS_DROP_PREFIX}${parentTaskId}`;
}

/** Root task ids per section (sorted). */
export function buildColumnsMap(sections: Section[]): Record<string, string[]> {
  const m: Record<string, string[]> = {};
  for (const s of sections) {
    m[s.id] = [...(s.tasks ?? [])]
      .filter((t) => !t.parentTaskId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => t.id);
  }
  return m;
}

export function findSectionForTask(
  taskId: string,
  columns: Record<string, string[]>,
): string | null {
  for (const [sid, ids] of Object.entries(columns)) {
    if (ids.includes(taskId)) return sid;
  }
  return null;
}

/** Walk to the section root task (column list only contains roots). */
export function resolveRootAncestorId(taskId: string, taskMap: Map<string, Task>): string | null {
  const start = taskMap.get(taskId);
  if (!start) return null;
  let cur: Task = start;
  while (cur.parentTaskId) {
    const p = taskMap.get(cur.parentTaskId);
    if (!p) return null;
    cur = p;
  }
  return cur.id;
}

export function columnsToReorderItems(columns: Record<string, string[]>): ReorderTaskItem[] {
  const items: ReorderTaskItem[] = [];
  for (const [sectionId, ids] of Object.entries(columns)) {
    ids.forEach((taskId, sortOrder) => {
      items.push({ taskId, sortOrder, sectionId });
    });
  }
  return items;
}

function computeRootReorderFromDragEnd(
  event: DragEndEvent,
  sortedSections: Section[],
): ReorderTaskItem[] | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;

  const activeId = String(active.id);
  const overId = String(over.id);

  const taskMap = buildTaskMapFromSections(sortedSections);
  if (taskMap.get(activeId)?.parentTaskId) return null;

  const columns = buildColumnsMap(sortedSections);
  const sourceSection = findSectionForTask(activeId, columns);
  if (!sourceSection) return null;

  const overIsColumn = overId.startsWith('column:');

  let targetSection: string;
  let anchorRootId: string | null = null;
  let insertAfterAnchor = false;

  if (overIsColumn) {
    targetSection = overId.slice('column:'.length);
  } else if (overId.startsWith(SUBTASKS_DROP_PREFIX)) {
    const parentId = overId.slice(SUBTASKS_DROP_PREFIX.length);
    const ar = resolveRootAncestorId(parentId, taskMap);
    if (!ar) return null;
    const sec = findSectionForTask(ar, columns);
    if (!sec) return null;
    targetSection = sec;
    anchorRootId = ar;
    insertAfterAnchor = true;
  } else {
    const ar = resolveRootAncestorId(overId, taskMap);
    if (!ar) return null;
    const sec = findSectionForTask(ar, columns);
    if (!sec) return null;
    targetSection = sec;
    anchorRootId = ar;
    insertAfterAnchor = Boolean(taskMap.get(overId)?.parentTaskId);
  }

  const sourceList = [...columns[sourceSection]];
  const oldIndex = sourceList.indexOf(activeId);
  if (oldIndex < 0) return null;

  if (sourceSection === targetSection) {
    let newIndex: number;
    if (overIsColumn && overId === `column:${sourceSection}`) {
      newIndex = sourceList.length - 1;
    } else if (!overIsColumn && anchorRootId) {
      /** Index of anchor in the full list (same semantics as @dnd-kit arrayMove). */
      const ref = sourceList.indexOf(anchorRootId);
      if (ref < 0) return null;
      newIndex = insertAfterAnchor ? ref + 1 : ref;
    } else {
      return null;
    }
    if (newIndex < 0 || oldIndex === newIndex) return null;
    columns[sourceSection] = arrayMove(sourceList, oldIndex, newIndex);
  } else {
    const targetList = [...(columns[targetSection] ?? [])];
    const [moved] = sourceList.splice(oldIndex, 1);
    let insertAt: number;
    if (overIsColumn) {
      insertAt = targetList.length;
    } else if (anchorRootId) {
      const ref = targetList.indexOf(anchorRootId);
      if (ref < 0) insertAt = targetList.length;
      else insertAt = insertAfterAnchor ? ref + 1 : ref;
    } else {
      return null;
    }
    targetList.splice(insertAt, 0, moved);
    columns[sourceSection] = sourceList;
    columns[targetSection] = targetList;
  }

  return columnsToReorderItems(columns);
}

function depthFromRoot(taskId: string, taskMap: Map<string, Task>): number {
  let depth = 0;
  let cur: string | undefined = taskId;
  while (cur) {
    const p: string | undefined = taskMap.get(cur)?.parentTaskId;
    if (!p) break;
    depth++;
    cur = p;
  }
  return depth;
}

function subtreeHeight(taskId: string, sections: Section[]): number {
  const children = getDirectChildIds(sections, taskId);
  if (children.length === 0) return 1;
  return 1 + Math.max(...children.map((c) => subtreeHeight(c, sections)));
}

/** True if `taskId` is a strict descendant of `ancestorId`. */
function isUnderAncestor(taskId: string, ancestorId: string, taskMap: Map<string, Task>): boolean {
  let cur = taskMap.get(taskId);
  while (cur?.parentTaskId) {
    if (cur.parentTaskId === ancestorId) return true;
    cur = taskMap.get(cur.parentTaskId);
  }
  return false;
}

/** Reparent `activeId` under `newParentId` (last among direct children), or reorder within same parent to end. */
export function reorderItemsReparentUnderNewParent(
  activeId: string,
  newParentId: string,
  sections: Section[],
): ReorderTaskItem[] | null {
  const taskMap = buildTaskMapFromSections(sections);
  const active = taskMap.get(activeId);
  const newParent = taskMap.get(newParentId);
  if (!active?.parentTaskId || !newParent) return null;
  if (newParentId === activeId) return null;
  if (isUnderAncestor(newParentId, activeId, taskMap)) return null;

  const bottomDepth = depthFromRoot(newParentId, taskMap) + subtreeHeight(activeId, sections);
  if (bottomDepth > MAX_SUBTASK_DEPTH) return null;

  const sectionId = newParent.sectionId;
  if (!sectionId) return null;

  const items: ReorderTaskItem[] = [];
  const oldPid = active.parentTaskId;

  if (oldPid !== newParentId) {
    const oldSibs = getDirectChildIds(sections, oldPid).filter((id) => id !== activeId);
    oldSibs.forEach((id, i) => items.push({ taskId: id, sortOrder: i }));
  }

  const newSibs = getDirectChildIds(sections, newParentId).filter((id) => id !== activeId);
  newSibs.push(activeId);
  newSibs.forEach((id, i) => {
    if (id === activeId) {
      items.push({
        taskId: id,
        sortOrder: i,
        parentTaskId: newParentId,
        sectionId,
      });
    } else {
      items.push({ taskId: id, sortOrder: i });
    }
  });

  return items;
}

/** Promote nested task to a section root (end of column). */
export function reorderItemsForPromoteToRoot(
  activeId: string,
  targetSectionId: string,
  sections: Section[],
): ReorderTaskItem[] | null {
  const taskMap = buildTaskMapFromSections(sections);
  const active = taskMap.get(activeId);
  if (!active?.parentTaskId) return null;

  const oldParentId = active.parentTaskId;
  const items: ReorderTaskItem[] = [];

  const oldSiblings = getDirectChildIds(sections, oldParentId).filter((id) => id !== activeId);
  oldSiblings.forEach((id, i) => items.push({ taskId: id, sortOrder: i }));

  const columns = buildColumnsMap(sections);
  const targetRoots = [...(columns[targetSectionId] ?? [])];
  if (targetRoots.includes(activeId)) return null;
  targetRoots.push(activeId);
  targetRoots.forEach((id, i) => {
    const row: ReorderTaskItem = { taskId: id, sortOrder: i, sectionId: targetSectionId };
    if (id === activeId) row.parentTaskId = null;
    items.push(row);
  });

  return items;
}

function computeSubtaskReorderFromDragEnd(
  event: DragEndEvent,
  sortedSections: Section[],
): ReorderTaskItem[] | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;

  const activeId = String(active.id);
  const overId = String(over.id);

  const taskMap = buildTaskMapFromSections(sortedSections);
  const activeTask = taskMap.get(activeId);
  if (!activeTask?.parentTaskId) return null;

  const parentId = activeTask.parentTaskId;

  if (overId.startsWith('column:')) {
    const sec = overId.slice('column:'.length);
    return reorderItemsForPromoteToRoot(activeId, sec, sortedSections);
  }

  if (overId.startsWith(SUBTASKS_DROP_PREFIX)) {
    const p = overId.slice(SUBTASKS_DROP_PREFIX.length);
    if (p === parentId) {
      const siblings = [...getDirectChildIds(sortedSections, parentId)];
      const oldIndex = siblings.indexOf(activeId);
      if (oldIndex < 0) return null;
      const newIndex = siblings.length - 1;
      if (oldIndex === newIndex) return null;
      const newSiblings = arrayMove(siblings, oldIndex, newIndex);
      return newSiblings.map((taskId, sortOrder) => ({ taskId, sortOrder }));
    }
    return reorderItemsReparentUnderNewParent(activeId, p, sortedSections);
  }

  const overTask = taskMap.get(overId);
  if (overTask && overId !== activeId) {
    if (isUnderAncestor(overId, activeId, taskMap)) return null;

    if (overTask.parentTaskId === parentId) {
      const siblings = [...getDirectChildIds(sortedSections, parentId)];
      const oldIndex = siblings.indexOf(activeId);
      if (oldIndex < 0) return null;
      const newIndex = siblings.indexOf(overId);
      if (newIndex < 0 || oldIndex === newIndex) return null;
      const newSiblings = arrayMove(siblings, oldIndex, newIndex);
      return newSiblings.map((taskId, sortOrder) => ({ taskId, sortOrder }));
    }

    return reorderItemsReparentUnderNewParent(activeId, overId, sortedSections);
  }

  return null;
}

export function computeReorderItemsFromDragEnd(
  event: DragEndEvent,
  sortedSections: Section[],
): ReorderTaskItem[] | null {
  const { active, over } = event;
  if (!over) return null;

  const activeId = String(active.id);
  const activeTask = buildTaskMapFromSections(sortedSections).get(activeId);

  if (activeTask?.parentTaskId) {
    return computeSubtaskReorderFromDragEnd(event, sortedSections);
  }

  return computeRootReorderFromDragEnd(event, sortedSections);
}
