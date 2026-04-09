import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import type {
  WorkspaceReportingSummaryDto,
  ReportingSavedViewDto,
  CreateReportingSavedViewRequest,
  UpdateReportingSavedViewRequest,
} from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/reporting')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ReportingController {
  constructor(private reportingService: ReportingService) {}

  @Get('summary')
  async summary(
    @Param('workspaceId') workspaceId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('portfolioId') portfolioId?: string,
    @Query('projectIds') projectIds?: string,
    @Query('assigneeIds') assigneeIds?: string,
    @Query('statuses') statuses?: string,
    @Query('tagIds') tagIds?: string,
  ): Promise<WorkspaceReportingSummaryDto> {
    return this.reportingService.workspaceSummary(workspaceId, {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(portfolioId ? { portfolioId } : {}),
      ...(projectIds
        ? { projectIds: projectIds.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}),
      ...(assigneeIds
        ? { assigneeIds: assigneeIds.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}),
      ...(statuses
        ? { statuses: statuses.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}),
      ...(tagIds ? { tagIds: tagIds.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
    });
  }

  @Get('export.csv')
  async exportCsv(
    @Param('workspaceId') workspaceId: string,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('portfolioId') portfolioId?: string,
    @Query('projectIds') projectIds?: string,
    @Query('assigneeIds') assigneeIds?: string,
    @Query('statuses') statuses?: string,
    @Query('tagIds') tagIds?: string,
  ): Promise<void> {
    const filters = {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(portfolioId ? { portfolioId } : {}),
      ...(projectIds
        ? { projectIds: projectIds.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}),
      ...(assigneeIds
        ? { assigneeIds: assigneeIds.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}),
      ...(statuses
        ? { statuses: statuses.split(',').map((s) => s.trim()).filter(Boolean) }
        : {}),
      ...(tagIds ? { tagIds: tagIds.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
    };
    const summary = await this.reportingService.workspaceSummary(workspaceId, filters);
    const csv = this.reportingService.summaryToCsvString(summary);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="workspace-reporting.csv"',
    );
    res.send(csv);
  }

  @Get('views')
  async listViews(
    @Param('workspaceId') workspaceId: string,
  ): Promise<ReportingSavedViewDto[]> {
    return this.reportingService.listSavedViews(workspaceId);
  }

  @Post('views')
  async createView(
    @Param('workspaceId') workspaceId: string,
    @Request() req: { user: { userId: string } },
    @Body() body: CreateReportingSavedViewRequest,
  ): Promise<ReportingSavedViewDto> {
    return this.reportingService.createSavedView(workspaceId, req.user.userId, body);
  }

  @Patch('views/:viewId')
  async updateView(
    @Param('workspaceId') workspaceId: string,
    @Param('viewId') viewId: string,
    @Body() body: UpdateReportingSavedViewRequest,
  ): Promise<ReportingSavedViewDto> {
    return this.reportingService.updateSavedView(workspaceId, viewId, body);
  }

  @Delete('views/:viewId')
  async deleteView(
    @Param('workspaceId') workspaceId: string,
    @Param('viewId') viewId: string,
  ): Promise<void> {
    await this.reportingService.deleteSavedView(workspaceId, viewId);
  }
}
