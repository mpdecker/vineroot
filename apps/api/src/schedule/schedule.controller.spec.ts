import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import {
  GenericResourceController,
  WorkCalendarController,
  ScheduleProgramController,
  ScheduleProjectController,
} from './schedule.controller';
import { GenericResourceService } from './generic-resource.service';
import { WorkCalendarService } from './work-calendar.service';
import { ScheduleProgramService } from './schedule-program.service';
import { ScheduleProjectService } from './schedule-project.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('Schedule controllers (HTTP)', () => {
  let app: INestApplication;

  const workCalendars = {
    listWorkspaceCalendars: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const programs = {
    list: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    addProject: jest.fn(),
    removeProject: jest.fn(),
    scheduleRollup: jest.fn(),
  };

  const scheduleProject = {
    recalculate: jest.fn(),
    getCriticalPath: jest.fn(),
    saveBaseline: jest.fn(),
    clearBaseline: jest.fn(),
    getBaselineSummary: jest.fn(),
    compareBaselines: jest.fn(),
    listBaselines: jest.fn(),
    getOverallocations: jest.fn(),
    level: jest.fn(),
    evm: jest.fn(),
    getNetworkGraph: jest.fn(),
    getTimephased: jest.fn(),
  };

  const genericResources = {
    list: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      context.switchToHttp().getRequest().user = { userId: 'u1' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [
        WorkCalendarController,
        GenericResourceController,
        ScheduleProgramController,
        ScheduleProjectController,
      ],
      providers: [
        { provide: WorkCalendarService, useValue: workCalendars },
        { provide: GenericResourceService, useValue: genericResources },
        { provide: ScheduleProgramService, useValue: programs },
        { provide: ScheduleProjectService, useValue: scheduleProject },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(WorkspaceGuard)
      .useValue(allowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const base = '/api/v1/workspaces/ws1';
  const projSchedule = `${base}/projects/p1/schedule`;

  it('GET work-calendars lists calendars', async () => {
    workCalendars.listWorkspaceCalendars.mockResolvedValue([]);

    await request(app.getHttpServer()).get(`${base}/work-calendars`).expect(200);

    expect(workCalendars.listWorkspaceCalendars).toHaveBeenCalledWith('ws1', 'u1');
  });

  it('POST work-calendars creates calendar', async () => {
    workCalendars.create.mockResolvedValue({ id: 'cal1' });

    await request(app.getHttpServer())
      .post(`${base}/work-calendars`)
      .send({ name: 'Std', weeklyPattern: {} })
      .expect(201);

    expect(workCalendars.create).toHaveBeenCalledWith('ws1', 'u1', {
      name: 'Std',
      weeklyPattern: {},
    });
  });

  it('POST schedule/recalculate delegates', async () => {
    scheduleProject.recalculate.mockResolvedValue({
      projectId: 'p1',
      criticalTaskIds: [],
      tasks: [],
    });

    await request(app.getHttpServer()).post(`${projSchedule}/recalculate`).expect(201);

    expect(scheduleProject.recalculate).toHaveBeenCalledWith('p1', 'u1');
  });

  it('GET schedule/critical-path delegates', async () => {
    scheduleProject.getCriticalPath.mockResolvedValue({
      projectId: 'p1',
      criticalTaskIds: ['t1'],
      tasks: [],
    });

    const res = await request(app.getHttpServer())
      .get(`${projSchedule}/critical-path`)
      .expect(200);

    expect(res.body.criticalTaskIds).toEqual(['t1']);
    expect(scheduleProject.getCriticalPath).toHaveBeenCalledWith('p1', 'u1');
  });

  it('POST schedule/baselines passes baseline index query', async () => {
    scheduleProject.saveBaseline.mockResolvedValue({ saved: 2 });

    await request(app.getHttpServer())
      .post(`${projSchedule}/baselines?index=1`)
      .expect(201);

    expect(scheduleProject.saveBaseline).toHaveBeenCalledWith('p1', 'u1', 1);
  });

  it('GET schedule/baselines delegates', async () => {
    scheduleProject.listBaselines.mockResolvedValue([]);

    await request(app.getHttpServer()).get(`${projSchedule}/baselines`).expect(200);

    expect(scheduleProject.listBaselines).toHaveBeenCalledWith('p1', 'u1');
  });

  it('DELETE schedule/baselines passes baseline index query', async () => {
    scheduleProject.clearBaseline.mockResolvedValue({ deleted: 3 });

    await request(app.getHttpServer())
      .delete(`${projSchedule}/baselines?index=2`)
      .expect(200);

    expect(scheduleProject.clearBaseline).toHaveBeenCalledWith('p1', 'u1', 2);
  });

  it('GET schedule/baselines/compare passes baseline index and optional taskId', async () => {
    scheduleProject.compareBaselines.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get(`${projSchedule}/baselines/compare?index=1&taskId=t9`)
      .expect(200);

    expect(scheduleProject.compareBaselines).toHaveBeenCalledWith('p1', 'u1', 1, 't9');
  });

  it('GET schedule/baselines/summary delegates', async () => {
    scheduleProject.getBaselineSummary.mockResolvedValue({
      projectId: 'p1',
      baselineIndex: 0,
      projectTaskCount: 1,
      tasksWithBaselineCount: 0,
      finishLateCount: 0,
      finishEarlyCount: 0,
      finishOnTimeCount: 0,
      avgFinishVarianceDays: null,
      sumFinishVarianceDays: null,
      avgFinishVarianceWorkingDays: null,
      sumFinishVarianceWorkingDays: null,
      sumWorkVarianceMinutes: null,
      sumCostVariance: null,
      maxFinishSlipDays: null,
      maxFinishSlipWorkingDays: null,
      latestBaselineSavedAt: null,
    });

    await request(app.getHttpServer())
      .get(`${projSchedule}/baselines/summary?index=0`)
      .expect(200);

    expect(scheduleProject.getBaselineSummary).toHaveBeenCalledWith('p1', 'u1', 0);
  });

  it('GET schedule/overallocations and POST schedule/level delegate', async () => {
    scheduleProject.getOverallocations.mockResolvedValue([]);
    scheduleProject.level.mockResolvedValue({
      shiftedTaskIds: [],
      stoppedReason: 'resolved',
      remainingOverallocations: 0,
    });

    await request(app.getHttpServer()).get(`${projSchedule}/overallocations`).expect(200);
    await request(app.getHttpServer()).post(`${projSchedule}/level`).expect(201);

    expect(scheduleProject.getOverallocations).toHaveBeenCalledWith('p1', 'u1', undefined);
    expect(scheduleProject.level).toHaveBeenCalledWith('p1', 'u1', expect.anything());
  });

  it('GET schedule/evm delegates', async () => {
    scheduleProject.evm.mockResolvedValue({
      projectId: 'p1',
      bac: 0,
      pv: 0,
      ev: 0,
      ac: 0,
      spi: null,
      cpi: null,
      eac: null,
    });

    await request(app.getHttpServer()).get(`${projSchedule}/evm`).expect(200);

    expect(scheduleProject.evm).toHaveBeenCalledWith('p1', 'u1', true, undefined);
  });

  it('GET schedule/network delegates', async () => {
    scheduleProject.getNetworkGraph.mockResolvedValue({
      projectId: 'p1',
      nodes: [{ id: 't1', title: 'A' }],
      edges: [],
    });

    const res = await request(app.getHttpServer())
      .get(`${projSchedule}/network`)
      .expect(200);

    expect(res.body.nodes).toHaveLength(1);
    expect(scheduleProject.getNetworkGraph).toHaveBeenCalledWith('p1', 'u1');
  });

  it('GET schedule/timephased defaults granularity to week', async () => {
    scheduleProject.getTimephased.mockResolvedValue({
      projectId: 'p1',
      granularity: 'week',
      basis: 'calendar',
      cells: [],
      resourceCells: [],
    });

    await request(app.getHttpServer()).get(`${projSchedule}/timephased`).expect(200);

    expect(scheduleProject.getTimephased).toHaveBeenCalledWith(
      'p1',
      'u1',
      'week',
      'calendar',
    );
  });

  it('GET schedule/timephased passes day when query says day', async () => {
    scheduleProject.getTimephased.mockResolvedValue({
      projectId: 'p1',
      granularity: 'day',
      basis: 'calendar',
      cells: [],
      resourceCells: [],
    });

    await request(app.getHttpServer())
      .get(`${projSchedule}/timephased?granularity=day`)
      .expect(200);

    expect(scheduleProject.getTimephased).toHaveBeenCalledWith('p1', 'u1', 'day', 'calendar');
  });

  it('GET schedule/timephased passes working basis from query', async () => {
    scheduleProject.getTimephased.mockResolvedValue({
      projectId: 'p1',
      granularity: 'week',
      basis: 'working',
      cells: [],
      resourceCells: [],
    });

    await request(app.getHttpServer())
      .get(`${projSchedule}/timephased?basis=working`)
      .expect(200);

    expect(scheduleProject.getTimephased).toHaveBeenCalledWith(
      'p1',
      'u1',
      'week',
      'working',
    );
  });

  it('GET schedule-programs/:id/schedule-rollup delegates to service', async () => {
    programs.scheduleRollup.mockResolvedValue({
      programId: 'prog1',
      programEarliestStart: null,
      programLatestFinish: null,
      projects: [
        {
          projectId: 'p1',
          projectName: 'A',
          earliestStart: null,
          latestFinish: null,
          criticalTaskCount: 1,
          criticalTaskIds: ['a'],
        },
        {
          projectId: 'p2',
          projectName: 'B',
          earliestStart: null,
          latestFinish: null,
          criticalTaskCount: 2,
          criticalTaskIds: ['b', 'c'],
        },
      ],
    });

    const res = await request(app.getHttpServer())
      .get(`${base}/schedule-programs/prog1/schedule-rollup`)
      .expect(200);

    expect(res.body.programId).toBe('prog1');
    expect(res.body.projects).toHaveLength(2);
    expect(programs.scheduleRollup).toHaveBeenCalledWith('prog1', 'u1');
  });

  it('GET generic-resources lists workspace resources', async () => {
    genericResources.list.mockResolvedValue([]);

    await request(app.getHttpServer()).get(`${base}/generic-resources`).expect(200);

    expect(genericResources.list).toHaveBeenCalledWith('ws1', 'u1');
  });

  it('POST generic-resources creates resource', async () => {
    genericResources.create.mockResolvedValue({ id: 'gr1', name: 'Crane' });

    await request(app.getHttpServer())
      .post(`${base}/generic-resources`)
      .send({ name: 'Crane', maxUnitsPercent: 150 })
      .expect(201);

    expect(genericResources.create).toHaveBeenCalledWith('ws1', 'u1', {
      name: 'Crane',
      maxUnitsPercent: 150,
    });
  });

  it('GET generic-resources/:id fetches one', async () => {
    genericResources.findById.mockResolvedValue({ id: 'gr1' });

    await request(app.getHttpServer()).get(`${base}/generic-resources/gr1`).expect(200);

    expect(genericResources.findById).toHaveBeenCalledWith('gr1', 'u1');
  });

  it('PATCH generic-resources/:id updates', async () => {
    genericResources.update.mockResolvedValue({ id: 'gr1', name: 'Renamed' });

    await request(app.getHttpServer())
      .patch(`${base}/generic-resources/gr1`)
      .send({ name: 'Renamed' })
      .expect(200);

    expect(genericResources.update).toHaveBeenCalledWith('gr1', 'u1', { name: 'Renamed' });
  });

  it('DELETE generic-resources/:id removes', async () => {
    await request(app.getHttpServer()).delete(`${base}/generic-resources/gr1`).expect(200);

    expect(genericResources.delete).toHaveBeenCalledWith('gr1', 'u1');
  });

  it('GET work-calendars/:id fetches one calendar', async () => {
    workCalendars.findById.mockResolvedValue({ id: 'cal-x' });

    await request(app.getHttpServer()).get(`${base}/work-calendars/cal-x`).expect(200);

    expect(workCalendars.findById).toHaveBeenCalledWith('cal-x', 'u1');
  });

  it('PATCH work-calendars/:id updates', async () => {
    workCalendars.update.mockResolvedValue({ id: 'cal-x', name: 'Renamed' });

    await request(app.getHttpServer())
      .patch(`${base}/work-calendars/cal-x`)
      .send({ name: 'Renamed' })
      .expect(200);

    expect(workCalendars.update).toHaveBeenCalledWith('cal-x', 'u1', { name: 'Renamed' });
  });

  it('DELETE work-calendars/:id removes', async () => {
    workCalendars.delete.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete(`${base}/work-calendars/cal-x`).expect(200);

    expect(workCalendars.delete).toHaveBeenCalledWith('cal-x', 'u1');
  });

  it('GET schedule-programs lists programs', async () => {
    programs.list.mockResolvedValue([]);

    await request(app.getHttpServer()).get(`${base}/schedule-programs`).expect(200);

    expect(programs.list).toHaveBeenCalledWith('ws1', 'u1');
  });

  it('POST schedule-programs creates program', async () => {
    programs.create.mockResolvedValue({ id: 'prog-new', name: 'Program A', projectIds: [] });

    await request(app.getHttpServer())
      .post(`${base}/schedule-programs`)
      .send({ name: 'Program A' })
      .expect(201);

    expect(programs.create).toHaveBeenCalledWith('ws1', 'u1', { name: 'Program A' });
  });

  it('GET schedule-programs/:id fetches one', async () => {
    programs.findById.mockResolvedValue({ id: 'prog1', name: 'P', projectIds: ['p1'] });

    await request(app.getHttpServer()).get(`${base}/schedule-programs/prog1`).expect(200);

    expect(programs.findById).toHaveBeenCalledWith('prog1', 'u1');
  });

  it('POST schedule-programs/:id/projects links project', async () => {
    programs.addProject.mockResolvedValue({
      id: 'prog1',
      name: 'P',
      projectIds: ['p1', 'p2'],
    });

    await request(app.getHttpServer())
      .post(`${base}/schedule-programs/prog1/projects`)
      .send({ projectId: 'p2' })
      .expect(201);

    expect(programs.addProject).toHaveBeenCalledWith('prog1', 'u1', { projectId: 'p2' });
  });

  it('DELETE schedule-programs/:id/projects/:projectId unlinks', async () => {
    programs.removeProject.mockResolvedValue({
      id: 'prog1',
      name: 'P',
      projectIds: ['p1'],
    });

    await request(app.getHttpServer())
      .delete(`${base}/schedule-programs/prog1/projects/p2`)
      .expect(200);

    expect(programs.removeProject).toHaveBeenCalledWith('prog1', 'p2', 'u1');
  });

  it('GET schedule/evm passes includeTasks=false when tasks=0', async () => {
    scheduleProject.evm.mockResolvedValue({
      projectId: 'p1',
      bac: 10,
      pv: 0,
      ev: 0,
      ac: 0,
      spi: null,
      cpi: null,
      eac: null,
    });

    await request(app.getHttpServer()).get(`${projSchedule}/evm?tasks=0`).expect(200);

    expect(scheduleProject.evm).toHaveBeenCalledWith('p1', 'u1', false, undefined);
  });

  it('GET schedule/evm passes baselineIndex and EVM options', async () => {
    scheduleProject.evm.mockResolvedValue({
      projectId: 'p1',
      baselineIndex: 3,
      earnedValueBasis: 'WORK_VS_BASELINE',
      pvModel: 'WORK_SCHEDULE_LINEAR',
      bac: 1,
      pv: 0,
      ev: 0,
      ac: 0,
      spi: null,
      cpi: null,
      eac: null,
    });

    await request(app.getHttpServer())
      .get(
        `${projSchedule}/evm?baselineIndex=3&earnedValueBasis=WORK_VS_BASELINE&pvModel=WORK_SCHEDULE_LINEAR`,
      )
      .expect(200);

    expect(scheduleProject.evm).toHaveBeenCalledWith('p1', 'u1', true, {
      baselineIndex: 3,
      earnedValueBasis: 'WORK_VS_BASELINE',
      pvModel: 'WORK_SCHEDULE_LINEAR',
    });
  });
});
