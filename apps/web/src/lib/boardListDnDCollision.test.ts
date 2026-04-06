import { describe, expect, it, vi, beforeEach } from 'vitest';

const pointerWithin = vi.fn();
const closestCorners = vi.fn();

vi.mock('@dnd-kit/core', () => ({
  pointerWithin: (...a: unknown[]) => pointerWithin(...a),
  closestCorners: (...a: unknown[]) => closestCorners(...a),
}));

import { preferTaskHitOverColumnCollision } from './boardListDnDCollision';

describe('preferTaskHitOverColumnCollision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to closestCorners when pointerWithin empty', () => {
    pointerWithin.mockReturnValue([]);
    closestCorners.mockReturnValue(['fallback']);
    const args = { droppableContainers: [] } as any;
    expect(preferTaskHitOverColumnCollision(args)).toEqual(['fallback']);
    expect(closestCorners).toHaveBeenCalledWith(args);
  });

  it('returns task hits when pointer hits a task droppable', () => {
    const taskHit = { id: 'task-1' };
    pointerWithin.mockReturnValue([taskHit]);
    closestCorners.mockReturnValue([taskHit]);
    const args = { droppableContainers: [{ id: 'task-1', data: { current: {} } }] } as any;
    expect(preferTaskHitOverColumnCollision(args)).toEqual([taskHit]);
  });
});
