import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core';

type DroppableData = { type?: string; sectionId?: string };

function readDroppableData(container: { data?: { current?: DroppableData | null } } | undefined): DroppableData {
  return container?.data?.current ?? {};
}

/**
 * Kanban **board** and project **list** (same `DndContext` pattern: `column:sectionId` + sortable rows/cards).
 *
 * When the pointer is inside both a section wrapper (`column:…`) and a task row/card,
 * {@link pointerWithin} can favor the column — cross-section drops then append to the bottom.
 * Prefer task droppables; if only the column hits (e.g. gap between rows), snap to the closest
 * task in that section so insert order matches pointer position.
 */
export const preferTaskHitOverColumnCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length === 0) {
    return closestCorners(args);
  }

  const taskLike = pointerHits.filter((h) => !String(h.id).startsWith('column:'));
  if (taskLike.length > 0) {
    const allowed = new Set(taskLike.map((h) => String(h.id)));
    const filtered = args.droppableContainers.filter((c) => allowed.has(String(c.id)));
    if (filtered.length === 0) return taskLike;
    const ranked = closestCorners({ ...args, droppableContainers: filtered });
    return ranked.length > 0 ? ranked : taskLike;
  }

  const colHit = pointerHits[0];
  const colContainer = args.droppableContainers.find((c) => c.id === colHit.id);
  const sectionId = readDroppableData(colContainer).sectionId;
  if (typeof sectionId === 'string') {
    const inSection = args.droppableContainers.filter((c) => {
      const d = readDroppableData(c);
      return d.type === 'task' && d.sectionId === sectionId;
    });
    if (inSection.length > 0) {
      const ranked = closestCorners({ ...args, droppableContainers: inSection });
      if (ranked.length > 0) return ranked;
    }
  }

  return pointerHits;
};
