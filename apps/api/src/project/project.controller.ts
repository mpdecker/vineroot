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
  Request,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import {
  ProjectDto,
  CreateProjectRequest,
  UpdateProjectRequest,
  DuplicateProjectRequest,
} from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/projects')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Get()
  async list(
    @Param('workspaceId') workspaceId: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
    @Query('archived') archived?: boolean,
    @Query('includeTemplates') includeTemplates?: boolean,
  ): Promise<ProjectDto[]> {
    return this.projectService.listByWorkspace(workspaceId, {
      teamId,
      status,
      archived,
      includeTemplates,
    });
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() body: CreateProjectRequest,
  ): Promise<ProjectDto> {
    const { workspaceIds: extra, ...rest } = body;
    const merged = [
      workspaceId,
      ...(extra ?? []).filter((id) => id && id !== workspaceId),
    ];
    return this.projectService.create(merged, req.user.userId, rest);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<ProjectDto | null> {
    return this.projectService.findById(id, req.user.userId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: UpdateProjectRequest,
  ): Promise<ProjectDto> {
    return this.projectService.update(id, req.user.userId, body);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<void> {
    return this.projectService.delete(id, req.user.userId);
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: DuplicateProjectRequest,
  ): Promise<ProjectDto> {
    return this.projectService.duplicate(
      id,
      req.user.userId,
      workspaceId,
      body,
    );
  }
}
