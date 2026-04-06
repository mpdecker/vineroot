import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { NotificationService } from '../notification/notification.service';
import { TaskService } from '../task/task.service';
import {
  CommentDto,
  CreateCommentRequest,
  UpdateCommentRequest,
  CommentMentionDto,
  UserDto,
} from '@vineroot/shared-types';

/** Cuid-like ids embedded in comment text as @[userId]. */
function mentionIdsFromBody(body: string): string[] {
  const ids = new Set<string>();
  for (const m of body.matchAll(/@([a-z0-9]{20,36})/gi)) {
    ids.add(m[1]);
  }
  return [...ids];
}

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private eventsGateway: EventsGateway,
    private taskService: TaskService,
  ) {}

  private async assertTaskCommentAccess(
    taskId: string,
    userId: string,
  ): Promise<{ id: string; title: string; projectId: string | null; workspaceId: string | null }> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        OR: [
          { createdById: userId },
          { assignees: { some: { userId } } },
          {
            projectId: { not: null },
            project: {
              deletedAt: null,
              OR: [
                { createdById: userId },
                { members: { some: { userId } } },
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        workspaceId: true,
      },
    });
    if (task) {
      return task;
    }

    const wsTask = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        projectId: null,
        workspaceId: { not: null },
      },
      select: {
        id: true,
        title: true,
        projectId: true,
        workspaceId: true,
      },
    });
    if (!wsTask?.workspaceId) {
      throw new NotFoundException('Task not found');
    }
    const m = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId: wsTask.workspaceId },
    });
    if (!m) {
      throw new NotFoundException('Task not found');
    }
    return wsTask;
  }

  private mapAuthor(u: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    isAgent: boolean;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserDto {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl ?? undefined,
      isAgent: u.isAgent,
      timezone: u.timezone,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  private async taskWorkspaceIds(taskId: string): Promise<string[]> {
    const t = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        projectId: true,
        workspaceId: true,
        project: {
          select: { workspaceLinks: { select: { workspaceId: true } } },
        },
      },
    });
    if (!t) return [];
    if (t.projectId && t.project?.workspaceLinks?.length) {
      return t.project.workspaceLinks.map((l) => l.workspaceId);
    }
    if (t.workspaceId) {
      return [t.workspaceId];
    }
    return [];
  }

  private async assertMentionedUsersAllowed(
    taskId: string,
    userIds: string[],
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;
    const wsIds = await this.taskWorkspaceIds(taskId);
    if (wsIds.length === 0) {
      throw new BadRequestException('Task has no workspace context for mentions');
    }
    const rows = await this.prisma.workspaceMember.findMany({
      where: { userId: { in: unique }, workspaceId: { in: wsIds } },
      select: { userId: true },
    });
    const ok = new Set(rows.map((r) => r.userId));
    for (const uid of unique) {
      if (!ok.has(uid)) {
        throw new BadRequestException(
          'Mentioned user must belong to a workspace linked to this task',
        );
      }
    }
  }

  private async emitTaskUpdated(taskId: string): Promise<void> {
    const dto = await this.taskService.findById(taskId);
    if (!dto) return;
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { projectId: true, workspaceId: true },
    });
    if (!task) return;
    if (task.projectId) {
      const links = await this.prisma.projectWorkspace.findMany({
        where: { projectId: task.projectId },
        select: { workspaceId: true },
      });
      for (const l of links) {
        this.eventsGateway.emitToWorkspace(l.workspaceId, 'task:updated', {
          task: dto,
          action: 'updated',
        });
      }
      if (links[0]) {
        this.eventsGateway.emitToTask(taskId, links[0].workspaceId, 'task:updated', {
          task: dto,
          action: 'updated',
        });
      }
    } else if (task.workspaceId) {
      this.eventsGateway.emitToWorkspace(task.workspaceId, 'task:updated', {
        task: dto,
        action: 'updated',
      });
      this.eventsGateway.emitToTask(taskId, task.workspaceId, 'task:updated', {
        task: dto,
        action: 'updated',
      });
    }
  }

  private commentToDto(
    comment: {
      id: string;
      taskId: string;
      authorId: string;
      parentCommentId: string | null;
      body: string;
      htmlBody: string | null;
      isAgentComment: boolean;
      createdAt: Date;
      updatedAt: Date;
      author?: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        isAgent: boolean;
        timezone: string;
        createdAt: Date;
        updatedAt: Date;
      };
      mentions?: { userId: string; user: { displayName: string } }[];
    },
  ): CommentDto {
    const mentions: CommentMentionDto[] | undefined =
      comment.mentions?.map((m) => ({
        userId: m.userId,
        displayName: m.user.displayName,
      })) ?? undefined;
    return {
      id: comment.id,
      taskId: comment.taskId,
      authorId: comment.authorId,
      parentCommentId: comment.parentCommentId,
      body: comment.body,
      htmlBody: comment.htmlBody ?? undefined,
      isAgentComment: comment.isAgentComment,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author ? this.mapAuthor(comment.author) : undefined,
      ...(mentions?.length ? { mentions } : {}),
    };
  }

  async create(
    taskId: string,
    userId: string,
    req: CreateCommentRequest,
  ): Promise<CommentDto> {
    const task = await this.assertTaskCommentAccess(taskId, userId);
    const body = (req.body ?? '').trim();
    if (!body) {
      throw new BadRequestException('Comment body is required');
    }

    let parentCommentId: string | null = null;
    if (req.parentCommentId) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: req.parentCommentId,
          taskId,
          deletedAt: null,
        },
        select: { id: true, authorId: true },
      });
      if (!parent) {
        throw new BadRequestException('Parent comment not found');
      }
      parentCommentId = parent.id;
    }

    const fromBody = mentionIdsFromBody(body);
    const fromReq = req.mentionedUserIds ?? [];
    const mentionSet = new Set<string>([...fromBody, ...fromReq]);
    mentionSet.delete(userId);
    const mentionList = [...mentionSet];
    await this.assertMentionedUsersAllowed(taskId, mentionList);

    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        authorId: userId,
        parentCommentId,
        body,
        mentions:
          mentionList.length > 0
            ? {
                create: mentionList.map((uid) => ({ userId: uid })),
              }
            : undefined,
      },
      include: {
        author: true,
        mentions: { include: { user: { select: { displayName: true } } } },
      },
    });

    const authorName =
      comment.author?.displayName ?? comment.author?.email ?? 'Someone';

    for (const uid of mentionList) {
      await this.notifications.create(
        uid,
        userId,
        NotificationType.MENTION,
        `${authorName} mentioned you`,
        `On task: ${task.title}`,
        taskId,
        'task',
      );
    }

    if (parentCommentId) {
      const parent = await this.prisma.comment.findFirst({
        where: { id: parentCommentId, deletedAt: null },
        select: { authorId: true },
      });
      if (parent && parent.authorId !== userId) {
        await this.notifications.create(
          parent.authorId,
          userId,
          NotificationType.TASK_COMMENTED,
          `${authorName} replied to your comment`,
          task.title,
          taskId,
          'task',
        );
      }
    }

    await this.emitTaskUpdated(taskId);

    return this.commentToDto(comment);
  }

  async listByTask(taskId: string, userId: string): Promise<CommentDto[]> {
    await this.assertTaskCommentAccess(taskId, userId);
    const comments = await this.prisma.comment.findMany({
      where: { taskId, deletedAt: null },
      include: {
        author: true,
        mentions: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((c) => this.commentToDto(c));
  }

  async update(
    id: string,
    userId: string,
    req: UpdateCommentRequest,
  ): Promise<CommentDto> {
    const existing = await this.prisma.comment.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, taskId: true },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found');
    }
    if (existing.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    await this.assertTaskCommentAccess(existing.taskId, userId);
    const body = (req.body ?? '').trim();
    if (!body) {
      throw new BadRequestException('Comment body is required');
    }
    const comment = await this.prisma.comment.update({
      where: { id },
      data: { body },
      include: {
        author: true,
        mentions: { include: { user: { select: { displayName: true } } } },
      },
    });
    return this.commentToDto(comment);
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.prisma.comment.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, authorId: true, taskId: true },
    });
    if (!existing) {
      throw new NotFoundException('Comment not found');
    }
    if (existing.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.assertTaskCommentAccess(existing.taskId, userId);
    await this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.emitTaskUpdated(existing.taskId);
  }
}
