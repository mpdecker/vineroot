import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import type {
  DashboardDto,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  CreateDashboardWidgetRequest,
  UpdateDashboardWidgetRequest,
  DashboardWidgetDto,
} from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/dashboards')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string): Promise<DashboardDto[]> {
    return this.dashboardService.list(workspaceId);
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Req() req: { user: { userId: string } },
    @Body() body: CreateDashboardRequest,
  ): Promise<DashboardDto> {
    return this.dashboardService.create(workspaceId, req.user.userId, body);
  }

  @Get(':dashboardId')
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Query('resolved') resolved?: string,
  ): Promise<DashboardDto | null> {
    const withResolved = resolved !== '0' && resolved !== 'false';
    return this.dashboardService.findByIdInWorkspace(
      workspaceId,
      dashboardId,
      withResolved,
    );
  }

  @Patch(':dashboardId')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() body: UpdateDashboardRequest,
  ): Promise<DashboardDto> {
    return this.dashboardService.update(workspaceId, dashboardId, body);
  }

  @Delete(':dashboardId')
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
  ): Promise<void> {
    return this.dashboardService.deleteInWorkspace(workspaceId, dashboardId);
  }

  @Post(':dashboardId/widgets')
  async addWidget(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() body: CreateDashboardWidgetRequest,
  ): Promise<DashboardWidgetDto> {
    return this.dashboardService.addWidget(workspaceId, dashboardId, body);
  }

  @Patch(':dashboardId/widgets/:widgetId')
  async updateWidget(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() body: UpdateDashboardWidgetRequest,
  ): Promise<DashboardWidgetDto> {
    return this.dashboardService.updateWidget(
      workspaceId,
      dashboardId,
      widgetId,
      body,
    );
  }

  @Delete(':dashboardId/widgets/:widgetId')
  async removeWidget(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
  ): Promise<void> {
    return this.dashboardService.removeWidget(
      workspaceId,
      dashboardId,
      widgetId,
    );
  }
}
