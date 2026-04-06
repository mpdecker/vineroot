import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('tasks/:taskId/audit-logs')
  async listForTask(
    @Param('taskId') taskId: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.auditService.listForTask(taskId, req.user.userId);
  }

  @Get('workspaces/:workspaceId/audit-logs')
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async listForWorkspace(@Param('workspaceId') workspaceId: string) {
    return this.auditService.listForWorkspace(workspaceId);
  }
}
