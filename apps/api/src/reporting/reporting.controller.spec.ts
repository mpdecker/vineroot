import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('ReportingController (HTTP integration)', () => {
  let app: INestApplication;
  const reportingService = {
    workspaceSummary: jest.fn(),
    summaryToCsvString: jest.fn(),
    listSavedViews: jest.fn(),
    createSavedView: jest.fn(),
    updateSavedView: jest.fn(),
    deleteSavedView: jest.fn(),
  };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: 'u1' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [{ provide: ReportingService, useValue: reportingService }],
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

  it('GET summary delegates to service', async () => {
    reportingService.workspaceSummary.mockResolvedValue({
      workspaceId: 'ws-1',
      period: { from: '2026-01-01', to: '2026-01-31' },
      appliedFilters: {},
      tasksByStatus: {},
      openTaskCount: 0,
      completedLast30Days: 0,
      createdLast30Days: 0,
      throughputByWeek: [],
      flowMetrics: {
        leadTimeDays: { avg: null, median: null, sampleSize: 0 },
        cycleTimeDays: { avg: null, median: null, sampleSize: 0 },
      },
      workload: [],
    });

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws-1/reporting/summary')
      .expect(200);

    expect(reportingService.workspaceSummary).toHaveBeenCalledWith('ws-1', {});
  });

  it('GET summary parses comma-delimited filters', async () => {
    reportingService.workspaceSummary.mockResolvedValue({
      workspaceId: 'ws-1',
      period: { from: '2026-01-01', to: '2026-01-31' },
      appliedFilters: {},
      tasksByStatus: {},
      openTaskCount: 0,
      completedLast30Days: 0,
      createdLast30Days: 0,
      throughputByWeek: [],
      flowMetrics: {
        leadTimeDays: { avg: null, median: null, sampleSize: 0 },
        cycleTimeDays: { avg: null, median: null, sampleSize: 0 },
      },
      workload: [],
    });

    await request(app.getHttpServer())
      .get(
        '/api/v1/workspaces/ws-1/reporting/summary?projectIds=p1,p2&assigneeIds=u1,u2&statuses=DONE,BACKLOG&tagIds=t1,t2&from=2026-01-01&to=2026-01-31&portfolioId=pf1',
      )
      .expect(200);

    expect(reportingService.workspaceSummary).toHaveBeenCalledWith('ws-1', {
      from: '2026-01-01',
      to: '2026-01-31',
      portfolioId: 'pf1',
      projectIds: ['p1', 'p2'],
      assigneeIds: ['u1', 'u2'],
      statuses: ['DONE', 'BACKLOG'],
      tagIds: ['t1', 't2'],
    });
  });

  it('GET export.csv responds with attachment and csv body', async () => {
    reportingService.workspaceSummary.mockResolvedValue({
      workspaceId: 'ws-1',
      period: { from: '2026-01-01', to: '2026-01-31' },
      appliedFilters: {},
      tasksByStatus: {},
      openTaskCount: 0,
      completedLast30Days: 0,
      createdLast30Days: 0,
      throughputByWeek: [],
      flowMetrics: {
        leadTimeDays: { avg: null, median: null, sampleSize: 0 },
        cycleTimeDays: { avg: null, median: null, sampleSize: 0 },
      },
      workload: [],
    });
    reportingService.summaryToCsvString.mockReturnValue('k,v\na,b');

    const res = await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws-1/reporting/export.csv?projectIds=p1')
      .expect(200);

    expect(reportingService.workspaceSummary).toHaveBeenCalledWith('ws-1', {
      projectIds: ['p1'],
    });
    expect(reportingService.summaryToCsvString).toHaveBeenCalled();
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('workspace-reporting.csv');
    expect(res.text).toBe('k,v\na,b');
  });

  it('saved view endpoints delegate to service', async () => {
    reportingService.listSavedViews.mockResolvedValue([{ id: 'v1' }]);
    reportingService.createSavedView.mockResolvedValue({ id: 'v2' });
    reportingService.updateSavedView.mockResolvedValue({ id: 'v2' });
    reportingService.deleteSavedView.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws-1/reporting/views')
      .expect(200);
    expect(reportingService.listSavedViews).toHaveBeenCalledWith('ws-1');

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws-1/reporting/views')
      .send({ name: 'My view' })
      .expect(201);
    expect(reportingService.createSavedView).toHaveBeenCalledWith('ws-1', 'u1', {
      name: 'My view',
    });

    await request(app.getHttpServer())
      .patch('/api/v1/workspaces/ws-1/reporting/views/v2')
      .send({ name: 'Renamed' })
      .expect(200);
    expect(reportingService.updateSavedView).toHaveBeenCalledWith('ws-1', 'v2', {
      name: 'Renamed',
    });

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws-1/reporting/views/v2')
      .expect(200);
    expect(reportingService.deleteSavedView).toHaveBeenCalledWith('ws-1', 'v2');
  });
});
