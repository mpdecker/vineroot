import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { ActorTier, AgentTokenScope, ReviewGate, TaskStatus } from '@prisma/client';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsDateString,
  IsObject,
  IsNumber,
} from 'class-validator';
import crypto from 'crypto';

export class CreateAgentTokenDto {
  @IsString()
  name: string;

  @IsEnum(ActorTier)
  actorTier: ActorTier;

  @IsArray()
  @IsEnum(AgentTokenScope, { each: true })
  scope: AgentTokenScope[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ClaimTaskDto {
  // empty — just claiming sets status IN_PROGRESS
}

export class CompleteTaskDto {
  @IsObject()
  output: Record<string, any>;

  @IsOptional()
  @IsNumber()
  actualMin?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class FailTaskDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsObject()
  partialOutput?: Record<string, any>;
}

@Injectable()
export class AgentService {
  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
  ) {}

  // Token Management
  async createToken(
    workspaceId: string,
    userId: string,
    dto: CreateAgentTokenDto,
  ) {
    const token = crypto.randomBytes(32).toString('hex');

    const agentToken = await this.prisma.agentToken.create({
      data: {
        workspaceId,
        userId,
        name: dto.name,
        token,
        scope: dto.scope,
        actorTier: dto.actorTier,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return {
      id: agentToken.id,
      name: agentToken.name,
      token, // Only shown once at creation
      actorTier: agentToken.actorTier,
      scope: agentToken.scope,
      expiresAt: agentToken.expiresAt,
      createdAt: agentToken.createdAt,
    };
  }

  async listTokens(workspaceId: string) {
    const tokens = await this.prisma.agentToken.findMany({
      where: { workspaceId },
    });

    return tokens.map((t) => ({
      id: t.id,
      name: t.name,
      token: `${t.token.substring(0, 8)}...${t.token.substring(t.token.length - 4)}`, // Masked
      actorTier: t.actorTier,
      scope: t.scope,
      isActive: t.isActive,
      lastUsedAt: t.lastUsedAt,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
    }));
  }

  async revokeToken(id: string, workspaceId: string) {
    const token = await this.prisma.agentToken.findFirst({
      where: { id, workspaceId },
    });

    if (!token) {
      throw new NotFoundException('Agent token not found');
    }

    return await this.prisma.agentToken.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async validateToken(token: string) {
    const agentToken = await this.prisma.agentToken.findFirst({
      where: {
        token,
        isActive: true,
      },
    });

    if (!agentToken) {
      throw new UnauthorizedException('Invalid or inactive agent token');
    }

    // Check expiration
    if (agentToken.expiresAt && agentToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Agent token has expired');
    }

    // Update last used
    await this.prisma.agentToken.update({
      where: { id: agentToken.id },
      data: { lastUsedAt: new Date() },
    });

    return agentToken;
  }

  // Agent Task Operations
  async getReadyTasks(actorTier: ActorTier, workspaceId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        status: TaskStatus.READY,
        actorTier,
      },
      include: {
        project: {
          select: { name: true, id: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, displayName: true, email: true },
            },
          },
        },
        blockedBy: {
          include: {
            blockingTask: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Filter out tasks with incomplete dependencies
    return tasks.filter((task) => {
      return !task.blockedBy.some(
        (dep) => dep.blockingTask.status !== TaskStatus.DONE,
      );
    });
  }

  async claimTask(taskId: string, agentToken: any) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.status !== TaskStatus.READY) {
      throw new Error('Task is not in READY status');
    }

    const updatedTask = await this.prisma.$transaction(async (tx) => {
      // Update task status
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.IN_PROGRESS,
          agentStartedAt: new Date(),
        },
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          workspaceId: task.workspaceId,
          taskId,
          actorTier: agentToken.actorTier,
          eventType: 'AGENT_STARTED',
          description: `Agent tier ${agentToken.actorTier} started working on task`,
          metadata: {
            agentTokenId: agentToken.id,
            agentTokenName: agentToken.name,
          },
        },
      });

      return updated;
    });

    return updatedTask;
  }

  async completeTask(taskId: string, agentToken: any, dto: CompleteTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Determine final status based on reviewGate
    let finalStatus: TaskStatus = TaskStatus.DONE;
    if (
      task.reviewGate === ReviewGate.AUTOMATED_ONLY ||
      task.reviewGate === ReviewGate.CRITIC_REVIEW ||
      task.reviewGate === ReviewGate.HUMAN_SIGNOFF ||
      task.reviewGate === ReviewGate.FULL
    ) {
      finalStatus = TaskStatus.IN_REVIEW;
    }

    const updatedTask = await this.prisma.$transaction(async (tx) => {
      // Update task
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          status: finalStatus,
          agentOutput: dto.output,
          agentCompletedAt: new Date(),
          actualMin: dto.actualMin,
          ...(finalStatus === TaskStatus.DONE && { completedAt: new Date() }),
        },
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          workspaceId: task.workspaceId,
          taskId,
          actorTier: agentToken.actorTier,
          eventType: 'AGENT_COMPLETED',
          description: `Agent tier ${agentToken.actorTier} completed task with status ${finalStatus}`,
          metadata: {
            agentTokenId: agentToken.id,
            agentTokenName: agentToken.name,
            reviewGate: task.reviewGate,
            notes: dto.notes,
          },
        },
      });

      return updated;
    });

    // Emit WebSocket event
    if (task.workspaceId) {
      this.gateway.emitToWorkspace(task.workspaceId, 'task:completed', {
        taskId,
        status: finalStatus,
        agentOutput: dto.output,
      });
    }

    return updatedTask;
  }

  async failTask(taskId: string, agentToken: any, dto: FailTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const newRetryCount = task.retryCount + 1;
    let finalStatus: TaskStatus = TaskStatus.READY;
    let description = `Agent tier ${agentToken.actorTier} failed task, retrying`;

    // Escalation logic
    if (newRetryCount >= 2) {
      finalStatus = TaskStatus.ESCALATION_PENDING;
      description = `Agent tier ${agentToken.actorTier} failed task (retry count ${newRetryCount}), escalating`;
    }

    const updatedTask = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          status: finalStatus,
          retryCount: newRetryCount,
          agentOutput: dto.partialOutput,
          escalationNote:
            newRetryCount >= 2 ? dto.reason : task.escalationNote,
        },
      });

      // Write audit log
      await tx.auditLog.create({
        data: {
          workspaceId: task.workspaceId,
          taskId,
          actorTier: agentToken.actorTier,
          eventType: newRetryCount >= 2 ? 'ESCALATION' : 'AGENT_FAILED',
          description,
          metadata: {
            agentTokenId: agentToken.id,
            agentTokenName: agentToken.name,
            reason: dto.reason,
            retryCount: newRetryCount,
          },
        },
      });

      return updated;
    });

    // Notify workspace admins if escalated
    if (newRetryCount >= 2 && task.workspaceId) {
      const admins = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId: task.workspaceId,
          role: 'ADMIN',
        },
        include: { user: true },
      });

      for (const admin of admins) {
        await this.prisma.notification.create({
          data: {
            recipientId: admin.userId,
            type: 'ESCALATION',
            title: 'Task Escalation',
            body: `Task "${task.title}" has been escalated after ${newRetryCount} failed attempts. Reason: ${dto.reason}`,
            resourceId: taskId,
            resourceType: 'Task',
          },
        });
      }
    }

    return updatedTask;
  }
}
