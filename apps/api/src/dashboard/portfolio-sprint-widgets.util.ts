import { TaskStatus } from '@prisma/client';
import type { PrismaService } from '../common/prisma.service';
import type {
  PortfolioActiveSprintRowDto,
  PortfolioActiveSprintsResolvedDto,
  PortfolioSprintVelocityResolvedDto,
  PortfolioVelocityProjectSliceDto,
} from '@vineroot/shared-types';
import { endOfCalendarDay, startOfCalendarDay } from '../project/project-sprint-metrics.util';

type PrismaLike = Pick<PrismaService, 'portfolio' | 'project' | 'sprint' | 'task'>;

async function projectNamesInWorkspace(
  prisma: PrismaLike,
  workspaceId: string,
  projectIds: string[],
): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();
  const rows = await prisma.project.findMany({
    where: {
      id: { in: projectIds },
      deletedAt: null,
      workspaceLinks: { some: { workspaceId } },
    },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * Per project: prefer ACTIVE sprint, else earliest PLANNED by startDate; aggregate task/point progress.
 */
export async function resolvePortfolioActiveSprints(
  prisma: PrismaLike,
  workspaceId: string,
  portfolioId: string,
): Promise<PortfolioActiveSprintsResolvedDto | { error: string }> {
  const pf = await prisma.portfolio.findFirst({
    where: { id: portfolioId, workspaceId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!pf) return { error: 'Portfolio not found in workspace' };

  const uniqueIds = [...new Set(pf.items.map((i) => i.projectId))];
  const nameById = await projectNamesInWorkspace(prisma, workspaceId, uniqueIds);

  const rows: PortfolioActiveSprintRowDto[] = [];

  for (const item of pf.items) {
    const projectName = nameById.get(item.projectId);
    if (!projectName) continue;

    const sprints = await prisma.sprint.findMany({
      where: { projectId: item.projectId },
      orderBy: { startDate: 'desc' },
    });

    const focus =
      sprints.find((s) => s.state === 'ACTIVE') ??
      [...sprints]
        .filter((s) => s.state === 'PLANNED')
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] ??
      null;

    if (!focus) {
      rows.push({
        projectId: item.projectId,
        projectName,
        sprintId: null,
        sprintName: null,
        sprintState: null,
        startDate: null,
        endDate: null,
        totalTasks: 0,
        doneTasks: 0,
        totalStoryPoints: 0,
        doneStoryPoints: 0,
      });
      continue;
    }

    const tasks = await prisma.task.findMany({
      where: {
        projectId: item.projectId,
        sprintId: focus.id,
        deletedAt: null,
        isTemplate: false,
      },
      select: { status: true, storyPoints: true },
    });

    let totalTasks = 0;
    let doneTasks = 0;
    let totalStoryPoints = 0;
    let doneStoryPoints = 0;
    for (const t of tasks) {
      totalTasks += 1;
      const p = t.storyPoints ?? 0;
      totalStoryPoints += p;
      if (t.status === TaskStatus.DONE) {
        doneTasks += 1;
        doneStoryPoints += p;
      }
    }

    rows.push({
      projectId: item.projectId,
      projectName,
      sprintId: focus.id,
      sprintName: focus.name,
      sprintState: focus.state,
      startDate: focus.startDate.toISOString().slice(0, 10),
      endDate: focus.endDate.toISOString().slice(0, 10),
      totalTasks,
      doneTasks,
      totalStoryPoints: Math.round(totalStoryPoints * 100) / 100,
      doneStoryPoints: Math.round(doneStoryPoints * 100) / 100,
    });
  }

  return {
    portfolioId: pf.id,
    portfolioName: pf.name,
    rows,
  };
}

/** Rolling velocity (same rules as per-project velocity) across portfolio projects. */
export async function resolvePortfolioSprintVelocity(
  prisma: PrismaLike,
  workspaceId: string,
  portfolioId: string,
  takeRaw: number,
): Promise<PortfolioSprintVelocityResolvedDto | { error: string }> {
  const pf = await prisma.portfolio.findFirst({
    where: { id: portfolioId, workspaceId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!pf) return { error: 'Portfolio not found in workspace' };

  const n = Math.min(12, Math.max(1, takeRaw));
  const uniqueIds = [...new Set(pf.items.map((i) => i.projectId))];
  const nameById = await projectNamesInWorkspace(prisma, workspaceId, uniqueIds);

  const projects: PortfolioVelocityProjectSliceDto[] = [];

  for (const item of pf.items) {
    const projectName = nameById.get(item.projectId);
    if (!projectName) continue;

    const sprints = await prisma.sprint.findMany({
      where: { projectId: item.projectId },
      orderBy: { endDate: 'desc' },
      take: n,
    });

    if (sprints.length === 0) {
      projects.push({
        projectId: item.projectId,
        projectName,
        averageCompletedPoints: 0,
        lastSprintName: null,
        lastSprintCompletedPoints: 0,
      });
      continue;
    }

    const sprintIds = sprints.map((s) => s.id);
    const doneTasks = await prisma.task.findMany({
      where: {
        projectId: item.projectId,
        sprintId: { in: sprintIds },
        deletedAt: null,
        isTemplate: false,
        status: TaskStatus.DONE,
      },
      select: { sprintId: true, storyPoints: true, completedAt: true, updatedAt: true },
    });

    const pointsPerSprint = sprints.map((sp) => {
      const rangeStart = startOfCalendarDay(sp.startDate).getTime();
      const rangeEnd = endOfCalendarDay(sp.endDate).getTime();
      let completedPoints = 0;
      for (const t of doneTasks) {
        if (t.sprintId !== sp.id) continue;
        const at = (t.completedAt ?? t.updatedAt).getTime();
        if (at < rangeStart || at > rangeEnd) continue;
        completedPoints += t.storyPoints ?? 0;
      }
      return Math.round(completedPoints * 100) / 100;
    });

    const averageCompletedPoints =
      pointsPerSprint.length === 0
        ? 0
        : Math.round(
            (pointsPerSprint.reduce((s, b) => s + b, 0) / pointsPerSprint.length) * 100,
          ) / 100;

    const lastSprint = sprints[0];
    projects.push({
      projectId: item.projectId,
      projectName,
      averageCompletedPoints,
      lastSprintName: lastSprint.name,
      lastSprintCompletedPoints: pointsPerSprint[0] ?? 0,
    });
  }

  return {
    portfolioId: pf.id,
    portfolioName: pf.name,
    take: n,
    projects,
  };
}
