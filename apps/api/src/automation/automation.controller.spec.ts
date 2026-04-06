import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import { AutomationTriggerType } from '@prisma/client';

describe('AutomationController (HTTP)', () => {
  let app: INestApplication;
  const automationService = {
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    toggleActive: jest.fn(),
    evaluate: jest.fn(),
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
      controllers: [AutomationController],
      providers: [{ provide: AutomationService, useValue: automationService }],
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

  it('GET / lists automations', async () => {
    automationService.findAll.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/automations')
      .expect(200);

    expect(automationService.findAll).toHaveBeenCalledWith('ws1');
  });

  it('POST / creates', async () => {
    automationService.create.mockResolvedValue({ id: 'a1' });

    const dto = {
      name: 'Rule',
      triggerType: AutomationTriggerType.TASK_CREATED,
      triggerConfig: {},
      actions: [],
    };
    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/automations')
      .send(dto)
      .expect(201);

    expect(automationService.create).toHaveBeenCalledWith('ws1', dto);
  });

  it('GET /:id fetches one', async () => {
    automationService.findOne.mockResolvedValue({ id: 'a1' });

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/automations/a1')
      .expect(200);

    expect(automationService.findOne).toHaveBeenCalledWith('a1', 'ws1');
  });

  it('PATCH /:id updates', async () => {
    automationService.update.mockResolvedValue({ id: 'a1' });

    await request(app.getHttpServer())
      .patch('/api/v1/workspaces/ws1/automations/a1')
      .send({ name: 'X' })
      .expect(200);

    expect(automationService.update).toHaveBeenCalledWith('a1', 'ws1', { name: 'X' });
  });

  it('DELETE /:id removes', async () => {
    automationService.remove.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws1/automations/a1')
      .expect(200);

    expect(automationService.remove).toHaveBeenCalledWith('a1', 'ws1');
  });

  it('POST /:id/toggle toggles active', async () => {
    automationService.toggleActive.mockResolvedValue({ id: 'a1', isActive: false });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/automations/a1/toggle')
      .expect(201);

    expect(automationService.toggleActive).toHaveBeenCalledWith('a1', 'ws1');
  });

  it('POST /:id/test runs evaluate with mock task', async () => {
    automationService.evaluate.mockResolvedValue({ matchedAutomations: [] });

    const res = await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/automations/a1/test')
      .send({ triggerType: AutomationTriggerType.TASK_CREATED })
      .expect(201);

    expect(res.body.testRun).toBe(true);
    expect(res.body.trigger).toBe(AutomationTriggerType.TASK_CREATED);
    expect(res.body.mockTask.workspaceId).toBe('ws1');
    expect(automationService.evaluate).toHaveBeenCalledWith(
      'test-task-id',
      AutomationTriggerType.TASK_CREATED,
      undefined,
      expect.objectContaining({ id: 'test-task-id', workspaceId: 'ws1' }),
    );
  });
});
