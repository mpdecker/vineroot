import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  WorkspaceDto,
  InviteMemberRequest,
  UserDto,
} from '@vineroot/shared-types';
import { randomBytes } from 'crypto';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    req: CreateWorkspaceRequest,
  ): Promise<WorkspaceDto> {
    const slug = req.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const workspace = await this.prisma.workspace.create({
      data: {
        name: req.name,
        slug: `${slug}-${randomBytes(4).toString('hex')}`,
        description: req.description,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return this.workspaceToDto(workspace);
  }

  async listByUser(userId: string): Promise<WorkspaceDto[]> {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
        deletedAt: null,
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return workspaces.map((w) => this.workspaceToDto(w));
  }

  async findById(id: string): Promise<WorkspaceDto | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    if (!workspace || workspace.deletedAt) {
      return null;
    }

    return this.workspaceToDto(workspace);
  }

  async update(
    id: string,
    userId: string,
    req: UpdateWorkspaceRequest,
  ): Promise<WorkspaceDto> {
    if (req.slackIncomingWebhookUrl !== undefined) {
      const m = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: id, userId },
        },
      });
      if (!m || (m.role !== 'OWNER' && m.role !== 'ADMIN')) {
        throw new ForbiddenException(
          'Only workspace owners and admins can configure Slack',
        );
      }
    }

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (req.name !== undefined) data.name = req.name;
    if (req.description !== undefined) data.description = req.description;
    if (req.logoUrl !== undefined) data.logoUrl = req.logoUrl;
    if (req.slackIncomingWebhookUrl !== undefined) {
      const v = req.slackIncomingWebhookUrl;
      data.slackIncomingWebhookUrl =
        v === null || v === '' ? null : String(v).trim();
    }

    const workspace = await this.prisma.workspace.update({
      where: { id },
      data: data as {
        name?: string;
        description?: string;
        logoUrl?: string;
        slackIncomingWebhookUrl?: string | null;
        updatedAt: Date;
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return this.workspaceToDto(workspace);
  }

  async inviteMember(
    workspaceId: string,
    req: InviteMemberRequest,
  ): Promise<WorkspaceDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: req.email },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      throw new Error('User is already a member');
    }

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role: req.role,
      },
    });

    return this.findById(workspaceId);
  }

  async removeMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceDto> {
    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    return this.findById(workspaceId);
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: string,
  ): Promise<WorkspaceDto> {
    await this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: { role: role as any },
    });

    return this.findById(workspaceId);
  }

  private userToPublicDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isAgent: user.isAgent,
      agentTier: user.agentTier,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private workspaceToDto(workspace: any): WorkspaceDto {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl,
      description: workspace.description,
      slackIncomingWebhookConfigured: !!workspace.slackIncomingWebhookUrl,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      memberCount: workspace.members?.length || 0,
      members: workspace.members?.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        workspaceId: m.workspaceId,
        role: m.role,
        user: this.userToPublicDto(m.user),
        joinedAt: m.joinedAt,
      })),
    };
  }
}
