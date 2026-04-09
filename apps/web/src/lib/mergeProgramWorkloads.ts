import type {
  ProjectWorkloadCellDto,
  ProjectWorkloadDto,
} from '@vineroot/shared-types';

export type MergedProgramWorkloadRow = {
  userId: string;
  displayName: string;
  weeks: ProjectWorkloadCellDto[];
  unscheduled: ProjectWorkloadCellDto;
  outOfRange: ProjectWorkloadCellDto;
};

function emptyCell(): ProjectWorkloadCellDto {
  return { taskCount: 0, storyPoints: 0, allocationPercent: 0 };
}

/**
 * Sums workload grids across projects for the same week column keys (same `weeks` / `from` query).
 * Returns null if inputs are empty or week columns do not align.
 */
export function mergeProgramWorkloads(
  workloads: ProjectWorkloadDto[],
): {
  weekStarts: string[];
  from: string;
  to: string;
  rows: MergedProgramWorkloadRow[];
} | null {
  if (workloads.length === 0) return null;
  const ref = workloads[0];
  const weekStarts = ref.weekStarts;
  const n = weekStarts.length;
  for (const w of workloads) {
    if (w.weekStarts.length !== n) return null;
    for (let i = 0; i < n; i++) {
      if (w.weekStarts[i] !== weekStarts[i]) return null;
    }
  }

  const byUser = new Map<string, MergedProgramWorkloadRow>();

  for (const w of workloads) {
    for (const row of w.rows) {
      let m = byUser.get(row.userId);
      if (!m) {
        m = {
          userId: row.userId,
          displayName: row.displayName,
          weeks: Array.from({ length: n }, () => emptyCell()),
          unscheduled: emptyCell(),
          outOfRange: emptyCell(),
        };
        byUser.set(row.userId, m);
      }
      for (let i = 0; i < n; i++) {
        m.weeks[i].taskCount += row.weeks[i].taskCount;
        m.weeks[i].storyPoints += row.weeks[i].storyPoints;
        m.weeks[i].allocationPercent += row.weeks[i].allocationPercent;
      }
      m.unscheduled.taskCount += row.unscheduled.taskCount;
      m.unscheduled.storyPoints += row.unscheduled.storyPoints;
      m.unscheduled.allocationPercent += row.unscheduled.allocationPercent;
      m.outOfRange.taskCount += row.outOfRange.taskCount;
      m.outOfRange.storyPoints += row.outOfRange.storyPoints;
      m.outOfRange.allocationPercent += row.outOfRange.allocationPercent;
    }
  }

  return {
    weekStarts,
    from: ref.from,
    to: ref.to,
    rows: Array.from(byUser.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    ),
  };
}
