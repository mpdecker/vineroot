import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import type { GoalMetricDefinition } from '@vineroot/shared-types';
import { computeGoalMetricValue } from './goal-metric-compute.util';

@Injectable()
export class GoalMetricComputeService {
  private readonly log = new Logger(GoalMetricComputeService.name);
  /** Coalesces overlapping cron ticks into one run. */
  private recomputeAllWorkspacesInFlight: Promise<void> | null = null;

  constructor(private prisma: PrismaService) {}

  /**
   * Recompute one metric from its definition; updates `current`, `lastComputedAt`, `lastError`.
   * On error, `lastError` is set and `current` is left unchanged.
   */
  async computeAndPersist(metricId: string): Promise<void> {
    const row = await this.prisma.goalMetric.findUnique({
      where: { id: metricId },
      include: { goal: { select: { workspaceId: true } } },
    });
    if (row?.definition == null) {
      return;
    }
    const def = row.definition as unknown as GoalMetricDefinition;
    const ws = row.goal.workspaceId;
    const result = await computeGoalMetricValue(this.prisma, ws, def);
    if ('error' in result) {
      await this.prisma.goalMetric.update({
        where: { id: metricId },
        data: {
          lastError: result.error,
          lastComputedAt: new Date(),
        },
      });
      return;
    }
    await this.prisma.goalMetric.update({
      where: { id: metricId },
      data: {
        current: result.value,
        lastError: null,
        lastComputedAt: new Date(),
      },
    });
  }

  /** Fire-and-forget: recompute all metrics that have a definition in the workspace. */
  scheduleRecomputeWorkspace(workspaceId: string): void {
    void this.recomputeAllComputedInWorkspace(workspaceId);
  }

  async recomputeAllComputedInWorkspace(workspaceId: string): Promise<void> {
    const metrics = await this.prisma.goalMetric.findMany({
      where: { goal: { workspaceId } },
      select: { id: true, definition: true },
    });
    for (const m of metrics) {
      if (m.definition != null) {
        await this.computeAndPersist(m.id);
      }
    }
  }

  /**
   * Batch recompute for every workspace (e.g. scheduled cron).
   * Concurrent calls share the same run so overlapping ticks do not stack DB load.
   */
  async recomputeAllWorkspaces(): Promise<void> {
    if (this.recomputeAllWorkspacesInFlight) {
      this.log.debug('recomputeAllWorkspaces: awaiting in-flight run');
      return this.recomputeAllWorkspacesInFlight;
    }
    this.recomputeAllWorkspacesInFlight = this.runRecomputeAllWorkspaces().finally(
      () => {
        this.recomputeAllWorkspacesInFlight = null;
      },
    );
    return this.recomputeAllWorkspacesInFlight;
  }

  private async runRecomputeAllWorkspaces(): Promise<void> {
    const workspaces = await this.prisma.workspace.findMany({
      select: { id: true },
    });
    for (const { id } of workspaces) {
      await this.recomputeAllComputedInWorkspace(id);
    }
  }

  async recomputeMetricInWorkspace(
    workspaceId: string,
    metricId: string,
  ): Promise<void> {
    const row = await this.prisma.goalMetric.findFirst({
      where: { id: metricId, goal: { workspaceId } },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Metric not found');
    }
    await this.computeAndPersist(metricId);
  }
}
