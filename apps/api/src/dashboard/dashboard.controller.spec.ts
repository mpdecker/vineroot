import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import {
  JwtAuthGuard,
  WorkspaceGuard,
  WorkspaceMemberWriteGuard,
} from '../auth/guards';

describe('DashboardController (HTTP integration)', () => {
  let app: INestApplication;

  const dashboardService = {
    list: jest.fn(),
    create: jest.fn(),
    listLayoutPresets: jest.fn(),
    listDashboardTemplates: jest.fn(),
    createFromTemplate: jest.fn(),
    findByIdInWorkspace: jest.fn(),
    update: jest.fn(),
    deleteInWorkspace: jest.fn(),
    duplicateDashboard: jest.fn(),
    applyLayoutPreset: jest.fn(),
    addWidget: jest.fn(),
    updateWidget: jest.fn(),
    removeWidget: jest.fn(),
  };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: 'u1' };
      req.workspace = { role: 'MEMBER', id: 'wm1' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(WorkspaceGuard)
      .useValue(allowGuard)
      .overrideGuard(WorkspaceMemberWriteGuard)
      .useValue(allowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / lists dashboards', async () => {
    dashboardService.list.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/dashboards')
      .expect(200);

    expect(dashboardService.list).toHaveBeenCalledWith('ws1');
  });

  it('POST / creates dashboard with user id', async () => {
    dashboardService.create.mockResolvedValue({
      id: 'd-new',
      workspaceId: 'ws1',
      name: 'X',
      createdById: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/dashboards')
      .send({ name: 'X' })
      .expect(201);

    expect(dashboardService.create).toHaveBeenCalledWith('ws1', 'u1', { name: 'X' });
  });

  it('GET /:id passes resolved query', async () => {
    dashboardService.findByIdInWorkspace.mockResolvedValue({
      id: 'd1',
      workspaceId: 'ws1',
      name: 'Main',
      createdById: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      widgets: [],
      widgetCount: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/dashboards/d1?resolved=0')
      .expect(200);

    expect(dashboardService.findByIdInWorkspace).toHaveBeenCalledWith(
      'ws1',
      'd1',
      false,
      'u1',
    );
  });

  it('GET /:id returns 404 when dashboard missing', async () => {
    dashboardService.findByIdInWorkspace.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/dashboards/missing?resolved=0')
      .expect(404);
  });

  it('POST /:dashboardId/widgets forwards body', async () => {
    dashboardService.addWidget.mockResolvedValue({ id: 'w1' });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/dashboards/d1/widgets')
      .send({ type: 'TEXT_NOTE', title: 'Note', config: { body: 'Hi' } })
      .expect(201);

    expect(dashboardService.addWidget).toHaveBeenCalledWith('ws1', 'd1', {
      type: 'TEXT_NOTE',
      title: 'Note',
      config: { body: 'Hi' },
    });
  });

  it('GET /layout-presets returns presets', async () => {
    dashboardService.listLayoutPresets.mockReturnValue([
      { id: 'overview', name: 'Overview', description: 'x' },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/dashboards/layout-presets')
      .expect(200);

    expect(res.body.presets).toHaveLength(1);
    expect(dashboardService.listLayoutPresets).toHaveBeenCalled();
  });

  it('GET /templates returns templates', async () => {
    dashboardService.listDashboardTemplates.mockReturnValue([
      { id: 'blank', name: 'Blank', description: 'y' },
    ]);

    const res = await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/dashboards/templates')
      .expect(200);

    expect(res.body.templates).toHaveLength(1);
    expect(dashboardService.listDashboardTemplates).toHaveBeenCalled();
  });

  it('POST /from-template forwards user and body', async () => {
    dashboardService.createFromTemplate.mockResolvedValue({
      id: 'd-new',
      workspaceId: 'ws1',
      name: 'From tpl',
      createdById: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/dashboards/from-template')
      .send({ templateId: 'workspace_overview', name: 'Custom' })
      .expect(201);

    expect(dashboardService.createFromTemplate).toHaveBeenCalledWith('ws1', 'u1', {
      templateId: 'workspace_overview',
      name: 'Custom',
    });
  });

  it('POST /:dashboardId/duplicate forwards user and body', async () => {
    dashboardService.duplicateDashboard.mockResolvedValue({
      id: 'd2',
      workspaceId: 'ws1',
      name: 'Copy',
      createdById: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/dashboards/d1/duplicate')
      .send({ name: 'Renamed copy' })
      .expect(201);

    expect(dashboardService.duplicateDashboard).toHaveBeenCalledWith('ws1', 'd1', 'u1', {
      name: 'Renamed copy',
    });
  });

  it('POST /:dashboardId/apply-layout-preset forwards presetId', async () => {
    dashboardService.applyLayoutPreset.mockResolvedValue({
      id: 'd1',
      workspaceId: 'ws1',
      name: 'Main',
      createdById: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
      widgets: [],
    });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/dashboards/d1/apply-layout-preset')
      .send({ presetId: 'overview' })
      .expect(201);

    expect(dashboardService.applyLayoutPreset).toHaveBeenCalledWith('ws1', 'd1', {
      presetId: 'overview',
    });
  });

  it('POST /from-template returns 400 when templateId missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/dashboards/from-template')
      .send({})
      .expect(400);
    expect(dashboardService.createFromTemplate).not.toHaveBeenCalled();
  });

  it('POST /:dashboardId/widgets returns 400 for invalid widget type', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/dashboards/d1/widgets')
      .send({ type: 'NOT_A_WIDGET', title: 'x' })
      .expect(400);
    expect(dashboardService.addWidget).not.toHaveBeenCalled();
  });
});
