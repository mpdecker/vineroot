import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async listForTask(taskId: string, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            workspaceLinks: { orderBy: { joinedAt: 'asc' }, take: 1 },
          },
        },
      },
    });

    if (!task || task.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    const workspaceId =
      task.workspaceId ||
      task.project?.workspaceLinks?.[0]?.workspaceId;
    if (!workspaceId) {
      throw new NotFoundException('Task has no workspace context');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
    if (!membership) {
      throw new ForbiddenException('No access to this task');
    }

    return this.prisma.auditLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listForWorkspace(workspaceId: string) {
    return this.prisma.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
