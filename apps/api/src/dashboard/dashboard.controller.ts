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
  NotFoundException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import {
  JwtAuthGuard,
  WorkspaceGuard,
  WorkspaceMemberWriteGuard,
} from '../auth/guards';
import type {
  DashboardDto,
  DashboardLayoutPresetSummaryDto,
  DashboardTemplateSummaryDto,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  DashboardWidgetDto,
} from '@vineroot/shared-types';
import {
  ApplyDashboardLayoutPresetBodyDto,
  CreateDashboardFromTemplateBodyDto,
  CreateDashboardWidgetBodyDto,
  DuplicateDashboardBodyDto,
  UpdateDashboardWidgetBodyDto,
} from './dashboard-request.dto';

@Controller('api/v1/workspaces/:workspaceId/dashboards')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string): Promise<DashboardDto[]> {
    return this.dashboardService.list(workspaceId);
  }

  @Post()
  @UseGuards(WorkspaceMemberWriteGuard)
  async create(
    @Param('workspaceId') workspaceId: string,
    @Req() req: { user: { userId: string } },
    @Body() body: CreateDashboardRequest,
  ): Promise<DashboardDto> {
    return this.dashboardService.create(workspaceId, req.user.userId, body);
  }

  @Get('layout-presets')
  async layoutPresets(): Promise<{
    presets: DashboardLayoutPresetSummaryDto[];
  }> {
    return { presets: this.dashboardService.listLayoutPresets() };
  }

  @Get('templates')
  async templates(): Promise<{
    templates: DashboardTemplateSummaryDto[];
  }> {
    return { templates: this.dashboardService.listDashboardTemplates() };
  }

  @Post('from-template')
  @UseGuards(WorkspaceMemberWriteGuard)
  async createFromTemplate(
    @Param('workspaceId') workspaceId: string,
    @Req() req: { user: { userId: string } },
    @Body() body: CreateDashboardFromTemplateBodyDto,
  ): Promise<DashboardDto> {
    return this.dashboardService.createFromTemplate(
      workspaceId,
      req.user.userId,
      body,
    );
  }

  @Get(':dashboardId')
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Req() req: { user: { userId: string } },
    @Query('resolved') resolved?: string,
  ): Promise<DashboardDto> {
    const withResolved = resolved !== '0' && resolved !== 'false';
    const d = await this.dashboardService.findByIdInWorkspace(
      workspaceId,
      dashboardId,
      withResolved,
      req.user.userId,
    );
    if (!d) {
      throw new NotFoundException('Dashboard not found');
    }
    return d;
  }

  @Patch(':dashboardId')
  @UseGuards(WorkspaceMemberWriteGuard)
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() body: UpdateDashboardRequest,
  ): Promise<DashboardDto> {
    return this.dashboardService.update(workspaceId, dashboardId, body);
  }

  @Delete(':dashboardId')
  @UseGuards(WorkspaceMemberWriteGuard)
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
  ): Promise<void> {
    return this.dashboardService.deleteInWorkspace(workspaceId, dashboardId);
  }

  @Post(':dashboardId/duplicate')
  @UseGuards(WorkspaceMemberWriteGuard)
  async duplicate(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Req() req: { user: { userId: string } },
    @Body() body: DuplicateDashboardBodyDto,
  ): Promise<DashboardDto> {
    return this.dashboardService.duplicateDashboard(
      workspaceId,
      dashboardId,
      req.user.userId,
      body,
    );
  }

  @Post(':dashboardId/apply-layout-preset')
  @UseGuards(WorkspaceMemberWriteGuard)
  async applyLayoutPreset(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() body: ApplyDashboardLayoutPresetBodyDto,
  ): Promise<DashboardDto> {
    return this.dashboardService.applyLayoutPreset(
      workspaceId,
      dashboardId,
      body,
    );
  }

  @Post(':dashboardId/widgets')
  @UseGuards(WorkspaceMemberWriteGuard)
  async addWidget(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() body: CreateDashboardWidgetBodyDto,
  ): Promise<DashboardWidgetDto> {
    return this.dashboardService.addWidget(workspaceId, dashboardId, body);
  }

  @Patch(':dashboardId/widgets/:widgetId')
  @UseGuards(WorkspaceMemberWriteGuard)
  async updateWidget(
    @Param('workspaceId') workspaceId: string,
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() body: UpdateDashboardWidgetBodyDto,
  ): Promise<DashboardWidgetDto> {
    return this.dashboardService.updateWidget(
      workspaceId,
      dashboardId,
      widgetId,
      body,
    );
  }

  @Delete(':dashboardId/widgets/:widgetId')
  @UseGuards(WorkspaceMemberWriteGuard)
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
