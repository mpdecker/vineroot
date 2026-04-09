import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { GoalService } from './goal.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import {
  GoalDto,
  CreateGoalRequest,
  UpdateGoalRequest,
  CreateGoalMetricRequest,
  UpdateGoalMetricRequest,
} from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/goals')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class GoalController {
  constructor(private goalService: GoalService) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string): Promise<GoalDto[]> {
    return this.goalService.listByWorkspace(workspaceId);
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() req: CreateGoalRequest,
  ): Promise<GoalDto> {
    return this.goalService.create(workspaceId, req);
  }

  @Post('metrics/:metricId/recompute')
  @HttpCode(200)
  async recomputeMetric(
    @Param('workspaceId') workspaceId: string,
    @Param('metricId') metricId: string,
  ): Promise<GoalDto> {
    return this.goalService.recomputeMetric(workspaceId, metricId);
  }

  @Get(':id')
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ): Promise<GoalDto | null> {
    return this.goalService.findByIdInWorkspace(id, workspaceId);
  }

  @Patch(':id')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() req: UpdateGoalRequest,
  ): Promise<GoalDto> {
    return this.goalService.update(id, workspaceId, req);
  }

  @Delete(':id')
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.goalService.deleteGoal(id, workspaceId);
  }

  @Post(':id/metrics')
  async createMetric(
    @Param('workspaceId') workspaceId: string,
    @Param('id') goalId: string,
    @Body() req: CreateGoalMetricRequest,
  ): Promise<GoalDto> {
    return this.goalService.createMetric(workspaceId, goalId, req);
  }

  @Patch('metrics/:metricId')
  async updateMetric(
    @Param('workspaceId') workspaceId: string,
    @Param('metricId') metricId: string,
    @Body() req: UpdateGoalMetricRequest,
  ): Promise<GoalDto> {
    return this.goalService.updateMetric(workspaceId, metricId, req);
  }
}
