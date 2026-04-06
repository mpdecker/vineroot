import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TeamDto, CreateTeamRequest, UpdateTeamRequest } from '@vineroot/shared-types';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, req: CreateTeamRequest): Promise<TeamDto> {
    const team = await this.prisma.team.create({
      data: {
        workspaceId,
        name: req.name,
        description: req.description,
        color: req.color,
        emoji: req.emoji,
        isPrivate: req.isPrivate || false,
      },
      include: { members: { include: { user: true } } },
    });
    return this.teamToDto(team);
  }

  async listByWorkspace(workspaceId: string): Promise<TeamDto[]> {
    const teams = await this.prisma.team.findMany({
      where: { workspaceId, deletedAt: null },
      include: { members: { include: { user: true } } },
    });
    return teams.map((t) => this.teamToDto(t));
  }

  async findById(id: string): Promise<TeamDto | null> {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: { members: { include: { user: true } } },
    });
    if (!team || team.deletedAt) return null;
    return this.teamToDto(team);
  }

  async update(id: string, req: UpdateTeamRequest): Promise<TeamDto> {
    const team = await this.prisma.team.update({
      where: { id },
      data: {
        name: req.name,
        description: req.description,
        color: req.color,
        emoji: req.emoji,
        isPrivate: req.isPrivate,
      },
      include: { members: { include: { user: true } } },
    });
    return this.teamToDto(team);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.team.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private teamToDto(team: any): TeamDto {
    return {
      id: team.id,
      workspaceId: team.workspaceId,
      name: team.name,
      description: team.description,
      color: team.color,
      emoji: team.emoji,
      isPrivate: team.isPrivate,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      memberCount: team.members?.length || 0,
    };
  }
}
