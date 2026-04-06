import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  GoalDto,
  CreateGoalRequest,
  UpdateGoalRequest,
  CreateGoalMetricRequest,
  UpdateGoalMetricRequest,
} from '@vineroot/shared-types';

@Injectable()
export class GoalService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, req: CreateGoalRequest): Promise<GoalDto> {
    const goal = await this.prisma.goal.create({
      data: {
        workspaceId,
        name: req.name,
        description: req.description,
        ownerId: req.ownerId,
        startDate: req.startDate,
        dueDate: req.dueDate,
      },
      include: { metrics: true, owner: true },
    });
    return this.goalToDto(goal);
  }

  async listByWorkspace(workspaceId: string): Promise<GoalDto[]> {
    const goals = await this.prisma.goal.findMany({
      where: { workspaceId },
      include: { metrics: true, owner: true },
    });
    return goals.map((g) => this.goalToDto(g));
  }

  async findById(id: string): Promise<GoalDto | null> {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: { metrics: true, owner: true },
    });
    if (!goal) return null;
    return this.goalToDto(goal);
  }

  async update(id: string, req: UpdateGoalRequest): Promise<GoalDto> {
    const goal = await this.prisma.goal.update({
      where: { id },
      data: req,
      include: { metrics: true, owner: true },
    });
    return this.goalToDto(goal);
  }

  async createMetric(
    goalId: string,
    req: CreateGoalMetricRequest,
  ): Promise<GoalDto> {
    await this.prisma.goalMetric.create({
      data: {
        goalId,
        name: req.name,
        type: req.type,
        target: req.target,
        unit: req.unit,
      },
    });
    return this.findById(goalId);
  }

  async updateMetric(
    metricId: string,
    req: UpdateGoalMetricRequest,
  ): Promise<any> {
    const metric = await this.prisma.goalMetric.update({
      where: { id: metricId },
      data: req,
    });
    return metric;
  }

  async deleteGoal(id: string, workspaceId: string): Promise<void> {
    const goal = await this.prisma.goal.findFirst({
      where: { id, workspaceId },
    });
    if (!goal) return;
    await this.prisma.goal.delete({ where: { id } });
  }

  private goalToDto(goal: any): GoalDto {
    return {
      id: goal.id,
      workspaceId: goal.workspaceId,
      ownerId: goal.ownerId,
      name: goal.name,
      description: goal.description,
      status: goal.status,
      startDate: goal.startDate,
      dueDate: goal.dueDate,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      metrics: goal.metrics,
      owner: goal.owner,
    };
  }
}
