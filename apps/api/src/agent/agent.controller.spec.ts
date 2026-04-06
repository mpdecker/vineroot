import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/guards';
import { AgentTokenGuard } from './agent-token.guard';
import { ActorTier } from '@prisma/client';

describe('AgentController (HTTP)', () => {
  let app: INestApplication;
  const agentService = {
    listTokens: jest.fn(),
    createToken: jest.fn(),
    revokeToken: jest.fn(),
    getReadyTasks: jest.fn(),
    claimTask: jest.fn(),
    completeTask: jest.fn(),
    failTask: jest.fn(),
  };

  const jwtGuard: CanActivate = {
    canActivate: (context) => {
      context.switchToHttp().getRequest().user = { userId: 'u1' };
      return true;
    },
  };

  const agentGuard: CanActivate = {
    canActivate: (context) => {
      context.switchToHttp().getRequest().agentToken = {
        id: 'at1',
        name: 'Worker',
        actorTier: ActorTier.CLAUDE_SONNET,
        workspaceId: 'ws1',
      };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: agentService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtGuard)
      .overrideGuard(AgentTokenGuard)
      .useValue(agentGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET workspaces/:id/agent/tokens lists tokens', async () => {
    agentService.listTokens.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/agent/tokens')
      .expect(200);

    expect(agentService.listTokens).toHaveBeenCalledWith('ws1');
  });

  it('POST workspaces/:id/agent/tokens creates token', async () => {
    agentService.createToken.mockResolvedValue({ id: 't1', token: 'secret' });

    const dto = {
      name: 'CI',
      actorTier: ActorTier.CLAUDE_SONNET,
      scope: [],
    };

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/agent/tokens')
      .send(dto)
      .expect(201);

    expect(agentService.createToken).toHaveBeenCalledWith('ws1', 'u1', dto);
  });

  it('DELETE workspaces/:id/agent/tokens/:id revokes', async () => {
    agentService.revokeToken.mockResolvedValue({});

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws1/agent/tokens/tok-1')
      .expect(200);

    expect(agentService.revokeToken).toHaveBeenCalledWith('tok-1', 'ws1');
  });

  it('GET agent/tasks uses token actor tier and workspace', async () => {
    agentService.getReadyTasks.mockResolvedValue([]);

    await request(app.getHttpServer()).get('/api/v1/agent/tasks').expect(200);

    expect(agentService.getReadyTasks).toHaveBeenCalledWith(
      ActorTier.CLAUDE_SONNET,
      'ws1',
    );
  });

  it('POST agent/tasks/:id/claim forwards', async () => {
    agentService.claimTask.mockResolvedValue({ id: 'task-1' });

    await request(app.getHttpServer())
      .post('/api/v1/agent/tasks/task-1/claim')
      .expect(201);

    expect(agentService.claimTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ workspaceId: 'ws1' }),
    );
  });

  it('POST agent/tasks/:id/complete forwards body', async () => {
    agentService.completeTask.mockResolvedValue({});

    await request(app.getHttpServer())
      .post('/api/v1/agent/tasks/task-1/complete')
      .send({ output: { ok: true }, actualMin: 5 })
      .expect(201);

    expect(agentService.completeTask).toHaveBeenCalledWith(
      'task-1',
      expect.any(Object),
      { output: { ok: true }, actualMin: 5 },
    );
  });

  it('POST agent/tasks/:id/fail forwards body', async () => {
    agentService.failTask.mockResolvedValue({});

    await request(app.getHttpServer())
      .post('/api/v1/agent/tasks/task-1/fail')
      .send({ reason: 'timeout' })
      .expect(201);

    expect(agentService.failTask).toHaveBeenCalledWith(
      'task-1',
      expect.any(Object),
      { reason: 'timeout' },
    );
  });
});
