import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { GoalMetricComputeService } from './goal-metric-compute.service';
import {
  GoalDto,
  CreateGoalRequest,
  UpdateGoalRequest,
  CreateGoalMetricRequest,
  UpdateGoalMetricRequest,
} from '@vineroot/shared-types';
import { parseGoalMetricDefinition } from './goal-metric-compute.util';

@Injectable()
export class GoalService {
  constructor(
    private prisma: PrismaService,
    private goalMetricCompute: GoalMetricComputeService,
  ) {}

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

  async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<GoalDto | null> {
    const goal = await this.prisma.goal.findFirst({
      where: { id, workspaceId },
      include: { metrics: true, owner: true },
    });
    if (!goal) return null;
    return this.goalToDto(goal);
  }

  async findById(id: string): Promise<GoalDto | null> {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: { metrics: true, owner: true },
    });
    if (!goal) return null;
    return this.goalToDto(goal);
  }

  async update(
    id: string,
    workspaceId: string,
    req: UpdateGoalRequest,
  ): Promise<GoalDto> {
    const existing = await this.prisma.goal.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Goal not found');
    }
    const goal = await this.prisma.goal.update({
      where: { id },
      data: req,
      include: { metrics: true, owner: true },
    });
    return this.goalToDto(goal);
  }

  async createMetric(
    workspaceId: string,
    goalId: string,
    req: CreateGoalMetricRequest,
  ): Promise<GoalDto> {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, workspaceId },
    });
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    const metric = await this.prisma.goalMetric.create({
      data: {
        goalId,
        name: req.name,
        type: req.type,
        target: req.target,
        unit: req.unit,
        ...(req.definition !== undefined
          ? { definition: req.definition as Prisma.InputJsonValue }
          : {}),
      },
    });
    if (req.definition) {
      await this.goalMetricCompute.computeAndPersist(metric.id);
    }
    const full = await this.findByIdInWorkspace(goalId, workspaceId);
    if (!full) throw new NotFoundException('Goal not found');
    return full;
  }

  async updateMetric(
    workspaceId: string,
    metricId: string,
    req: UpdateGoalMetricRequest,
  ): Promise<GoalDto> {
    const goal = await this.prisma.goal.findFirst({
      where: {
        workspaceId,
        metrics: { some: { id: metricId } },
      },
      select: { id: true },
    });
    if (!goal) {
      throw new NotFoundException('Metric not found');
    }
    await this.prisma.goalMetric.update({
      where: { id: metricId },
      data: {
        ...(req.name !== undefined && { name: req.name }),
        ...(req.type !== undefined && { type: req.type }),
        ...(req.current !== undefined && { current: req.current }),
        ...(req.target !== undefined && { target: req.target }),
        ...(req.unit !== undefined && { unit: req.unit }),
        ...(req.definition !== undefined && {
          definition:
            req.definition === null
              ? null
              : (req.definition as Prisma.InputJsonValue),
        }),
      },
    });
    if (req.definition !== undefined && req.definition !== null) {
      await this.goalMetricCompute.computeAndPersist(metricId);
    }
    const full = await this.findByIdInWorkspace(goal.id, workspaceId);
    if (!full) throw new NotFoundException('Goal not found');
    return full;
  }

  async recomputeMetric(workspaceId: string, metricId: string): Promise<GoalDto> {
    await this.goalMetricCompute.recomputeMetricInWorkspace(workspaceId, metricId);
    const row = await this.prisma.goalMetric.findFirst({
      where: { id: metricId, goal: { workspaceId } },
      select: { goalId: true },
    });
    if (!row) throw new NotFoundException('Metric not found');
    const full = await this.findByIdInWorkspace(row.goalId, workspaceId);
    if (!full) throw new NotFoundException('Goal not found');
    return full;
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
      metrics: Array.isArray(goal.metrics)
        ? goal.metrics.map((m: any) => ({
            id: m.id,
            goalId: m.goalId,
            name: m.name,
            type: m.type,
            current: m.current,
            target: m.target,
            unit: m.unit,
            updatedAt: m.updatedAt,
            definition: parseGoalMetricDefinition(m.definition) ?? undefined,
            lastComputedAt: m.lastComputedAt ?? undefined,
            lastError: m.lastError ?? undefined,
          }))
        : [],
      owner: goal.owner,
    };
  }
}
