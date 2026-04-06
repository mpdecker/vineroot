import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import type { WorkspaceReportingSummaryDto } from '@vineroot/shared-types';

const TERMINAL: TaskStatus[] = [TaskStatus.DONE, TaskStatus.CANCELLED];

@Injectable()
export class ReportingService {
  constructor(private prisma: PrismaService) {}

  async workspaceSummary(workspaceId: string): Promise<WorkspaceReportingSummaryDto> {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    since.setHours(0, 0, 0, 0);

    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        OR: [
          { workspaceId },
          {
            project: {
              workspaceLinks: { some: { workspaceId } },
            },
          },
        ],
      },
      include: {
        assignees: {
          include: {
            user: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    const tasksByStatus: Record<string, number> = {};
    let openTaskCount = 0;
    let completedLast30Days = 0;
    let createdLast30Days = 0;
    const workloadMap = new Map<string, { displayName: string; openTaskCount: number }>();

    for (const t of tasks) {
      tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1;
      if (!TERMINAL.includes(t.status)) {
        openTaskCount += 1;
        for (const a of t.assignees) {
          const uid = a.userId;
          const existing = workloadMap.get(uid);
          if (existing) {
            existing.openTaskCount += 1;
          } else {
            workloadMap.set(uid, {
              displayName: a.user.displayName,
              openTaskCount: 1,
            });
          }
        }
      }
      if (t.completedAt && t.completedAt >= since) {
        completedLast30Days += 1;
      }
      if (t.createdAt >= since) {
        createdLast30Days += 1;
      }
    }

    const workload = [...workloadMap.entries()]
      .map(([userId, v]) => ({
        userId,
        displayName: v.displayName,
        openTaskCount: v.openTaskCount,
      }))
      .sort((a, b) => b.openTaskCount - a.openTaskCount);

    return {
      workspaceId,
      tasksByStatus,
      openTaskCount,
      completedLast30Days,
      createdLast30Days,
      workload,
    };
  }
}
