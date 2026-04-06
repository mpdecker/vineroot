import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('DashboardController (HTTP integration)', () => {
  let app: INestApplication;

  const dashboardService = {
    list: jest.fn(),
    create: jest.fn(),
    findByIdInWorkspace: jest.fn(),
    update: jest.fn(),
    deleteInWorkspace: jest.fn(),
    addWidget: jest.fn(),
    updateWidget: jest.fn(),
    removeWidget: jest.fn(),
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
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
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
    dashboardService.findByIdInWorkspace.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/dashboards/d1?resolved=0')
      .expect(200);

    expect(dashboardService.findByIdInWorkspace).toHaveBeenCalledWith('ws1', 'd1', false);
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
});
