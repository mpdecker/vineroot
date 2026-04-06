import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
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

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<GoalDto | null> {
    return this.goalService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() req: UpdateGoalRequest,
  ): Promise<GoalDto> {
    return this.goalService.update(id, req);
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
    @Param('id') goalId: string,
    @Body() req: CreateGoalMetricRequest,
  ): Promise<GoalDto> {
    return this.goalService.createMetric(goalId, req);
  }

  @Patch('metrics/:metricId')
  async updateMetric(
    @Param('metricId') metricId: string,
    @Body() req: UpdateGoalMetricRequest,
  ): Promise<any> {
    return this.goalService.updateMetric(metricId, req);
  }
}
