import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PmOrchestratorGuard } from './pm-orchestrator.guard';
import { PmService } from './pm.service';
import {
  PmPatchTaskStatusDto,
  PmCreateTaskArtifactDto,
  PmTasksBatchDto,
  PmCreateHumanGateDto,
  PmResolveHumanGateDto,
  PmPatchProjectStatusDto,
  PmAppendAuditDto,
  PmCreateProjectDto,
} from './dto/pm.dto';

/**
 * ModelT PM orchestrator API (Section 5.3).
 * All routes require Authorization: Bearer PM_ORCHESTRATOR_SECRET
 */
@Controller('api/v1/pm')
@UseGuards(PmOrchestratorGuard)
export class PmController {
  constructor(private readonly pm: PmService) {}

  @Get('projects')
  listProjects() {
    return this.pm.listPmProjects();
  }

  @Post('projects')
  createProject(@Body() body: PmCreateProjectDto) {
    return this.pm.createPmProject(body.slug, body.name);
  }

  @Get('projects/:projectId')
  getProject(@Param('projectId') projectId: string) {
    return this.pm.getProject(projectId);
  }

  @Patch('projects/:projectId/status')
  patchProjectStatus(
    @Param('projectId') projectId: string,
    @Body() body: PmPatchProjectStatusDto,
  ) {
    return this.pm.patchProjectStatus(projectId, body);
  }

  @Get('tasks/ready')
  getReadyTasks(@Query('project_id') projectId: string) {
    return this.pm.getReadyTasks(projectId);
  }

  @Get('tasks/:taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.pm.getTaskById(taskId);
  }

  @Patch('tasks/:taskId/status')
  patchTaskStatus(
    @Param('taskId') taskId: string,
    @Body() body: PmPatchTaskStatusDto,
  ) {
    return this.pm.patchTaskStatus(taskId, body);
  }

  @Post('tasks/:taskId/artifacts')
  createArtifact(
    @Param('taskId') taskId: string,
    @Body() body: PmCreateTaskArtifactDto,
  ) {
    return this.pm.createTaskArtifact(taskId, body);
  }

  @Post('tasks/batch')
  batchTasks(@Body() body: PmTasksBatchDto) {
    return this.pm.batchUpsertTasks(body);
  }

  @Get('tasks/:taskId/dependencies')
  getTaskDependencies(@Param('taskId') taskId: string) {
    return this.pm.getTaskDependencies(taskId);
  }

  @Post('human-gates')
  createHumanGate(@Body() body: PmCreateHumanGateDto) {
    return this.pm.createHumanGate(body);
  }

  @Get('human-gates/pending')
  listPendingGates(@Query('project_id') projectId: string) {
    return this.pm.listPendingGates(projectId);
  }

  @Patch('human-gates/:gateId/resolve')
  resolveGate(
    @Param('gateId') gateId: string,
    @Body() body: PmResolveHumanGateDto,
  ) {
    return this.pm.resolveHumanGate(gateId, body);
  }

  @Get('audit')
  listAudit(
    @Query('project_id') projectId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.pm.listAudit(projectId, Number.isFinite(n) ? n : 50, before);
  }

  @Post('audit')
  appendAudit(@Body() body: PmAppendAuditDto) {
    return this.pm.appendAudit(body);
  }
}
