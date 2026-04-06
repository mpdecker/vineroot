import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import type { WorkspaceReportingSummaryDto } from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/reporting')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ReportingController {
  constructor(private reportingService: ReportingService) {}

  @Get('summary')
  async summary(
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceReportingSummaryDto> {
    return this.reportingService.workspaceSummary(workspaceId);
  }
}
