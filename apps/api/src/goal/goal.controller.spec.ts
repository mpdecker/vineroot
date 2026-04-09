import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { GoalController } from './goal.controller';
import { GoalService } from './goal.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('GoalController (HTTP)', () => {
  let app: INestApplication;
  const goalService = {
    listByWorkspace: jest.fn(),
    create: jest.fn(),
    findByIdInWorkspace: jest.fn(),
    update: jest.fn(),
    deleteGoal: jest.fn(),
    createMetric: jest.fn(),
    updateMetric: jest.fn(),
    recomputeMetric: jest.fn(),
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
      controllers: [GoalController],
      providers: [{ provide: GoalService, useValue: goalService }],
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

  it('GET / lists goals', async () => {
    goalService.listByWorkspace.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/goals')
      .expect(200);

    expect(goalService.listByWorkspace).toHaveBeenCalledWith('ws1');
  });

  it('POST / creates goal', async () => {
    goalService.create.mockResolvedValue({ id: 'g1' });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/goals')
      .send({ name: 'Q1' })
      .expect(201);

    expect(goalService.create).toHaveBeenCalledWith('ws1', { name: 'Q1' });
  });

  it('GET /:id fetches goal in workspace', async () => {
    goalService.findByIdInWorkspace.mockResolvedValue({ id: 'g1' });

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/goals/g1')
      .expect(200);

    expect(goalService.findByIdInWorkspace).toHaveBeenCalledWith('g1', 'ws1');
  });

  it('PATCH /:id updates', async () => {
    goalService.update.mockResolvedValue({ id: 'g1' });

    await request(app.getHttpServer())
      .patch('/api/v1/workspaces/ws1/goals/g1')
      .send({ name: 'Q1b' })
      .expect(200);

    expect(goalService.update).toHaveBeenCalledWith('g1', 'ws1', { name: 'Q1b' });
  });

  it('DELETE /:id deletes with workspace id', async () => {
    goalService.deleteGoal.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws1/goals/g1')
      .expect(200);

    expect(goalService.deleteGoal).toHaveBeenCalledWith('g1', 'ws1');
  });

  it('POST /:id/metrics creates metric', async () => {
    goalService.createMetric.mockResolvedValue({ id: 'g1' });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/goals/g1/metrics')
      .send({ name: 'Revenue', type: 'PERCENT', target: 100 })
      .expect(201);

    expect(goalService.createMetric).toHaveBeenCalledWith('ws1', 'g1', {
      name: 'Revenue',
      type: 'PERCENT',
      target: 100,
    });
  });

  it('PATCH /metrics/:metricId updates metric', async () => {
    goalService.updateMetric.mockResolvedValue({ id: 'm1' });

    await request(app.getHttpServer())
      .patch('/api/v1/workspaces/ws1/goals/metrics/m1')
      .send({ current: 10 })
      .expect(200);

    expect(goalService.updateMetric).toHaveBeenCalledWith('ws1', 'm1', { current: 10 });
  });

  it('POST /metrics/:metricId/recompute', async () => {
    goalService.recomputeMetric.mockResolvedValue({ id: 'g1' });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/goals/metrics/m1/recompute')
      .expect(200);

    expect(goalService.recomputeMetric).toHaveBeenCalledWith('ws1', 'm1');
  });
});
