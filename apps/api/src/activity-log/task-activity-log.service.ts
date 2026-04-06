import { Injectable } from '@nestjs/common';
import { AuditEventType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TaskActivityLogService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    actorId: string;
    /** Omit or null for project-level rows (no task). */
    taskId?: string | null;
    projectId?: string | null;
    eventType: AuditEventType;
    description: string;
    oldValue?: unknown;
    newValue?: unknown;
  }): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        taskId: params.taskId ?? null,
        projectId: params.projectId ?? undefined,
        actorId: params.actorId,
        eventType: params.eventType,
        description: params.description,
        ...(params.oldValue !== undefined && {
          oldValue: params.oldValue as Prisma.InputJsonValue,
        }),
        ...(params.newValue !== undefined && {
          newValue: params.newValue as Prisma.InputJsonValue,
        }),
      },
    });
  }
}
