import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import { WorkCalendarService } from './work-calendar.service';
import { GenericResourceService } from './generic-resource.service';
import { ScheduleProgramService } from './schedule-program.service';
import { ScheduleProjectService } from './schedule-project.service';
import type {
  AddProjectToScheduleProgramRequest,
  CreateGenericResourceRequest,
  CreateScheduleProgramRequest,
  CreateWorkCalendarRequest,
  ProjectLevelRequest,
  ScheduleEvmQueryOptions,
  ScheduleOverallocationsQueryDto,
  UpdateGenericResourceRequest,
  UpdateWorkCalendarRequest,
} from '@vineroot/shared-types';
import { SCHEDULE_BASELINE_INDEX_MAX } from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/work-calendars')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class WorkCalendarController {
  constructor(private calendars: WorkCalendarService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string, @Request() req: any) {
    return this.calendars.listWorkspaceCalendars(workspaceId, req.user.userId);
  }

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() body: CreateWorkCalendarRequest,
  ) {
    return this.calendars.create(workspaceId, req.user.userId, body);
  }

  @Get(':calendarId')
  findOne(@Param('calendarId') calendarId: string, @Request() req: any) {
    return this.calendars.findById(calendarId, req.user.userId);
  }

  @Patch(':calendarId')
  update(
    @Param('calendarId') calendarId: string,
    @Request() req: any,
    @Body() body: UpdateWorkCalendarRequest,
  ) {
    return this.calendars.update(calendarId, req.user.userId, body);
  }

  @Delete(':calendarId')
  remove(@Param('calendarId') calendarId: string, @Request() req: any) {
    return this.calendars.delete(calendarId, req.user.userId);
  }
}

@Controller('api/v1/workspaces/:workspaceId/schedule-programs')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ScheduleProgramController {
  constructor(private programs: ScheduleProgramService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string, @Request() req: any) {
    return this.programs.list(workspaceId, req.user.userId);
  }

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() body: CreateScheduleProgramRequest,
  ) {
    return this.programs.create(workspaceId, req.user.userId, body);
  }

  @Get(':programId')
  findOne(@Param('programId') programId: string, @Request() req: any) {
    return this.programs.findById(programId, req.user.userId);
  }

  @Post(':programId/projects')
  addProject(
    @Param('programId') programId: string,
    @Request() req: any,
    @Body() body: AddProjectToScheduleProgramRequest,
  ) {
    return this.programs.addProject(programId, req.user.userId, body);
  }

  @Delete(':programId/projects/:projectId')
  removeProject(
    @Param('programId') programId: string,
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return this.programs.removeProject(programId, projectId, req.user.userId);
  }

  @Get(':programId/schedule-rollup')
  rollup(@Param('programId') programId: string, @Request() req: any) {
    return this.programs.scheduleRollup(programId, req.user.userId);
  }
}

@Controller('api/v1/workspaces/:workspaceId/generic-resources')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class GenericResourceController {
  constructor(private resources: GenericResourceService) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string, @Request() req: any) {
    return this.resources.list(workspaceId, req.user.userId);
  }

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
    @Body() body: CreateGenericResourceRequest,
  ) {
    return this.resources.create(workspaceId, req.user.userId, body);
  }

  @Get(':resourceId')
  findOne(@Param('resourceId') resourceId: string, @Request() req: any) {
    return this.resources.findById(resourceId, req.user.userId);
  }

  @Patch(':resourceId')
  update(
    @Param('resourceId') resourceId: string,
    @Request() req: any,
    @Body() body: UpdateGenericResourceRequest,
  ) {
    return this.resources.update(resourceId, req.user.userId, body);
  }

  @Delete(':resourceId')
  remove(@Param('resourceId') resourceId: string, @Request() req: any) {
    return this.resources.delete(resourceId, req.user.userId);
  }
}

@Controller('api/v1/workspaces/:workspaceId/projects/:projectId/schedule')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ScheduleProjectController {
  constructor(private schedule: ScheduleProjectService) {}

  @Post('recalculate')
  recalculate(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return this.schedule.recalculate(projectId, req.user.userId);
  }

  @Get('critical-path')
  criticalPath(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return this.schedule.getCriticalPath(projectId, req.user.userId);
  }

  @Post('baselines')
  saveBaseline(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('index') index?: string,
  ) {
    const idx = index != null ? Number(index) : 0;
    return this.schedule.saveBaseline(projectId, req.user.userId, idx);
  }

  @Delete('baselines')
  clearBaseline(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('index') index?: string,
  ) {
    const idx = index != null ? Number(index) : 0;
    return this.schedule.clearBaseline(projectId, req.user.userId, idx);
  }

  @Get('baselines/summary')
  baselineSummary(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('index') index?: string,
  ) {
    const idx = index != null ? Number(index) : 0;
    return this.schedule.getBaselineSummary(projectId, req.user.userId, idx);
  }

  @Get('baselines/compare')
  compareBaselines(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('index') index?: string,
    @Query('taskId') taskId?: string,
  ) {
    const idx = index != null ? Number(index) : 0;
    return this.schedule.compareBaselines(
      projectId,
      req.user.userId,
      idx,
      taskId,
    );
  }

  @Get('baselines')
  listBaselines(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return this.schedule.listBaselines(projectId, req.user.userId);
  }

  @Get('overallocations')
  overallocations(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('granularity') granularity?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('scope') scope?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const q: ScheduleOverallocationsQueryDto = {};
    if (granularity === 'day' || granularity === 'week') {
      q.granularity = granularity;
    }
    if (from) q.from = from;
    if (to) q.to = to;
    if (scope === 'program' || scope === 'project') {
      q.scope = scope;
    }
    if (limit != null && limit !== '') {
      const n = Number(limit);
      if (Number.isFinite(n)) q.limit = n;
    }
    if (offset != null && offset !== '') {
      const n = Number(offset);
      if (Number.isFinite(n)) q.offset = n;
    }
    return this.schedule.getOverallocations(
      projectId,
      req.user.userId,
      Object.keys(q).length ? q : undefined,
    );
  }

  @Post('level')
  level(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() body?: ProjectLevelRequest,
  ) {
    return this.schedule.level(projectId, req.user.userId, body);
  }

  @Get('evm')
  evm(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('tasks') tasks?: string,
    @Query('baselineIndex') baselineIndexRaw?: string,
    @Query('earnedValueBasis') earnedValueBasisRaw?: string,
    @Query('pvModel') pvModelRaw?: string,
  ) {
    const includeTasks = tasks !== '0' && tasks !== 'false';
    const opts: ScheduleEvmQueryOptions = {};
    if (baselineIndexRaw != null && baselineIndexRaw !== '') {
      const n = Number(baselineIndexRaw);
      if (!Number.isInteger(n) || n < 0 || n > SCHEDULE_BASELINE_INDEX_MAX) {
        throw new BadRequestException(
          `baselineIndex must be an integer 0–${SCHEDULE_BASELINE_INDEX_MAX}`,
        );
      }
      opts.baselineIndex = n;
    }
    if (earnedValueBasisRaw != null && earnedValueBasisRaw !== '') {
      const u = earnedValueBasisRaw.toUpperCase();
      if (u === 'WORK_VS_BASELINE') {
        opts.earnedValueBasis = 'WORK_VS_BASELINE';
      } else if (u === 'PERCENT_COMPLETE') {
        opts.earnedValueBasis = 'PERCENT_COMPLETE';
      } else {
        throw new BadRequestException(
          'earnedValueBasis must be PERCENT_COMPLETE or WORK_VS_BASELINE',
        );
      }
    }
    if (pvModelRaw != null && pvModelRaw !== '') {
      const u = pvModelRaw.toUpperCase();
      if (u === 'WORK_SCHEDULE_LINEAR') {
        opts.pvModel = 'WORK_SCHEDULE_LINEAR';
      } else if (u === 'BASELINE_DURATION_LINEAR') {
        opts.pvModel = 'BASELINE_DURATION_LINEAR';
      } else {
        throw new BadRequestException(
          'pvModel must be BASELINE_DURATION_LINEAR or WORK_SCHEDULE_LINEAR',
        );
      }
    }
    return this.schedule.evm(
      projectId,
      req.user.userId,
      includeTasks,
      Object.keys(opts).length ? opts : undefined,
    );
  }

  @Get('network')
  networkGraph(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return this.schedule.getNetworkGraph(projectId, req.user.userId);
  }

  @Get('timephased')
  timephased(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Query('granularity') granularity?: string,
    @Query('basis') basis?: string,
  ) {
    const g = granularity === 'day' ? 'day' : 'week';
    const b = basis === 'working' ? 'working' : 'calendar';
    return this.schedule.getTimephased(projectId, req.user.userId, g, b);
  }
}
