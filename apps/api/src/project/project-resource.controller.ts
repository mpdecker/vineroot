import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { JwtAuthGuard } from '../auth/guards';
import {
  ProjectDto,
  CreateProjectRequest,
  UpdateProjectRequest,
  CustomFieldDefinitionDto,
  AddProjectCustomFieldRequest,
  TaskActivityLogDto,
  SprintDto,
  CreateSprintRequest,
  UpdateSprintRequest,
  SprintBurndownDto,
  SprintBurnupDto,
  ProjectSprintVelocityDto,
  ProjectCfdDto,
  ProjectEpicRollupsDto,
  ProjectSavedViewDto,
  CreateProjectSavedViewRequest,
  UpdateProjectSavedViewRequest,
  ReorderProjectSavedViewsRequest,
  ProjectWorkloadDto,
  ProjectIntakeFormDto,
  UpsertProjectIntakeFormRequest,
} from '@vineroot/shared-types';
import { ProjectIntakeFormService } from './project-intake-form.service';

/**
 * Top-level project routes (list/create + by id). Nested workspace routes live on {@link ProjectController}.
 */
@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectResourceController {
  constructor(
    private projectService: ProjectService,
    private intakeFormService: ProjectIntakeFormService,
  ) {}

  @Get(':projectId/custom-fields')
  async listProjectCustomFields(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ): Promise<CustomFieldDefinitionDto[]> {
    return this.projectService.listProjectCustomFields(projectId, req.user.userId);
  }

  @Post(':projectId/custom-fields')
  async addProjectCustomField(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() body: AddProjectCustomFieldRequest,
  ): Promise<CustomFieldDefinitionDto> {
    return this.projectService.addProjectCustomField(projectId, req.user.userId, body);
  }

  @Get(':projectId/activity-logs')
  async listProjectActivity(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('take') takeRaw?: string,
  ): Promise<TaskActivityLogDto[]> {
    const parsed = takeRaw ? parseInt(takeRaw, 10) : 100;
    const take = Number.isFinite(parsed)
      ? Math.min(200, Math.max(1, parsed))
      : 100;
    return this.projectService.listProjectActivity(
      projectId,
      req.user.userId,
      take,
    );
  }

  @Get(':projectId/sprints')
  async listSprints(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ): Promise<SprintDto[]> {
    return this.projectService.listSprints(projectId, req.user.userId);
  }

  @Post(':projectId/sprints')
  async createSprint(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() body: CreateSprintRequest,
  ): Promise<SprintDto> {
    return this.projectService.createSprint(projectId, req.user.userId, body);
  }

  @Patch(':projectId/sprints/:sprintId')
  async updateSprint(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Request() req: any,
    @Body() body: UpdateSprintRequest,
  ): Promise<SprintDto> {
    return this.projectService.updateSprint(
      projectId,
      sprintId,
      req.user.userId,
      body,
    );
  }

  @Delete(':projectId/sprints/:sprintId')
  async deleteSprint(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Request() req: any,
  ): Promise<void> {
    return this.projectService.deleteSprint(
      projectId,
      sprintId,
      req.user.userId,
    );
  }

  @Get(':projectId/sprints/velocity')
  async getProjectSprintVelocity(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('take') takeRaw?: string,
  ): Promise<ProjectSprintVelocityDto> {
    const parsed = takeRaw ? parseInt(takeRaw, 10) : 6;
    const take = Number.isFinite(parsed)
      ? Math.min(12, Math.max(1, parsed))
      : 6;
    return this.projectService.getProjectSprintVelocity(
      projectId,
      req.user.userId,
      take,
    );
  }

  @Get(':projectId/sprints/:sprintId/burndown')
  async getSprintBurndown(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<SprintBurndownDto> {
    return this.projectService.getSprintBurndown(
      projectId,
      sprintId,
      req.user.userId,
      from,
      to,
    );
  }

  @Get(':projectId/sprints/:sprintId/burnup')
  async getSprintBurnup(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Request() req: any,
  ): Promise<SprintBurnupDto> {
    return this.projectService.getSprintBurnup(
      projectId,
      sprintId,
      req.user.userId,
    );
  }

  @Get(':projectId/cfd')
  async getProjectCfd(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ProjectCfdDto> {
    return this.projectService.getProjectCfd(
      projectId,
      req.user.userId,
      from,
      to,
    );
  }

  @Get(':projectId/epic-rollups')
  async getEpicRollups(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ): Promise<ProjectEpicRollupsDto> {
    return this.projectService.getEpicRollups(projectId, req.user.userId);
  }

  @Get(':projectId/workload')
  async getProjectWorkload(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('weeks') weeksRaw?: string,
    @Query('from') from?: string,
    @Query('sprintFilter') sprintFilter?: string,
    @Query('epicFilter') epicFilter?: string,
  ): Promise<ProjectWorkloadDto> {
    return this.projectService.getProjectWorkload(
      projectId,
      req.user.userId,
      weeksRaw,
      from,
      sprintFilter,
      epicFilter,
    );
  }

  @Get(':projectId/saved-views')
  async listSavedViews(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ): Promise<ProjectSavedViewDto[]> {
    return this.projectService.listProjectSavedViews(
      projectId,
      req.user.userId,
    );
  }

  @Post(':projectId/saved-views')
  async createSavedView(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() body: CreateProjectSavedViewRequest,
  ): Promise<ProjectSavedViewDto> {
    return this.projectService.createProjectSavedView(
      projectId,
      req.user.userId,
      body,
    );
  }

  @Patch(':projectId/saved-views/reorder')
  async reorderSavedViews(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() body: ReorderProjectSavedViewsRequest,
  ): Promise<ProjectSavedViewDto[]> {
    return this.projectService.reorderProjectSavedViews(
      projectId,
      req.user.userId,
      body.orderedIds ?? [],
    );
  }

  @Patch(':projectId/saved-views/:viewId')
  async updateSavedView(
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
    @Request() req: any,
    @Body() body: UpdateProjectSavedViewRequest,
  ): Promise<ProjectSavedViewDto> {
    return this.projectService.updateProjectSavedView(
      projectId,
      viewId,
      req.user.userId,
      body,
    );
  }

  @Delete(':projectId/saved-views/:viewId')
  async deleteSavedView(
    @Param('projectId') projectId: string,
    @Param('viewId') viewId: string,
    @Request() req: any,
  ): Promise<void> {
    return this.projectService.deleteProjectSavedView(
      projectId,
      viewId,
      req.user.userId,
    );
  }

  @Get(':projectId/intake-form')
  async getIntakeForm(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ): Promise<ProjectIntakeFormDto | null> {
    return this.intakeFormService.getForProject(
      projectId,
      req.user.userId,
    );
  }

  @Put(':projectId/intake-form')
  async upsertIntakeForm(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() body: UpsertProjectIntakeFormRequest,
  ): Promise<ProjectIntakeFormDto> {
    return this.intakeFormService.upsert(projectId, req.user.userId, body);
  }

  @Post(':projectId/intake-form/publish')
  async publishIntakeForm(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ): Promise<ProjectIntakeFormDto> {
    return this.intakeFormService.publish(projectId, req.user.userId);
  }

  @Post(':projectId/intake-form/unpublish')
  async unpublishIntakeForm(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ): Promise<ProjectIntakeFormDto> {
    return this.intakeFormService.unpublish(projectId, req.user.userId);
  }

  @Get()
  async listMine(@Request() req: any): Promise<ProjectDto[]> {
    return this.projectService.listForUser(req.user.userId);
  }

  @Post()
  async createProject(
    @Request() req: any,
    @Body() body: CreateProjectRequest,
  ): Promise<ProjectDto> {
    return this.projectService.createFromRequest(req.user.userId, body);
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
}
