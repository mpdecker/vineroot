import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  InviteMemberRequest,
  WorkspaceDto,
} from '@vineroot/shared-types';

@Controller('api/v1/workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  @Get()
  async listMyWorkspaces(@Request() req: any): Promise<WorkspaceDto[]> {
    return this.workspaceService.listByUser(req.user.userId);
  }

  @Post()
  async createWorkspace(
    @Request() req: any,
    @Body() createWorkspaceReq: CreateWorkspaceRequest,
  ): Promise<WorkspaceDto> {
    return this.workspaceService.create(req.user.userId, createWorkspaceReq);
  }

  @Get(':id')
  @UseGuards(WorkspaceGuard)
  async getWorkspace(@Param('id') id: string): Promise<WorkspaceDto | null> {
    return this.workspaceService.findById(id);
  }

  @Patch(':id')
  @UseGuards(WorkspaceGuard)
  async updateWorkspace(
    @Param('id') id: string,
    @Body() updateWorkspaceReq: UpdateWorkspaceRequest,
    @Request() req: any,
  ): Promise<WorkspaceDto> {
    return this.workspaceService.update(id, req.user.userId, updateWorkspaceReq);
  }

  @Post(':id/members')
  @UseGuards(WorkspaceGuard)
  async inviteMember(
    @Param('id') workspaceId: string,
    @Body() inviteReq: InviteMemberRequest,
  ): Promise<WorkspaceDto> {
    return this.workspaceService.inviteMember(workspaceId, inviteReq);
  }

  @Delete(':id/members/:userId')
  @UseGuards(WorkspaceGuard)
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
  ): Promise<WorkspaceDto> {
    return this.workspaceService.removeMember(workspaceId, userId);
  }

  @Patch(':id/members/:userId')
  @UseGuards(WorkspaceGuard)
  async updateMemberRole(
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Body() updateReq: { role: string },
  ): Promise<WorkspaceDto> {
    return this.workspaceService.updateMemberRole(
      workspaceId,
      userId,
      updateReq.role,
    );
  }
}
