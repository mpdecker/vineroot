import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('WorkspaceController (HTTP)', () => {
  let app: INestApplication;
  const workspaceService = {
    listByUser: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    inviteMember: jest.fn(),
    removeMember: jest.fn(),
    updateMemberRole: jest.fn(),
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
      controllers: [WorkspaceController],
      providers: [{ provide: WorkspaceService, useValue: workspaceService }],
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

  it('GET / lists workspaces for user', async () => {
    workspaceService.listByUser.mockResolvedValue([]);

    await request(app.getHttpServer()).get('/api/v1/workspaces').expect(200);
    expect(workspaceService.listByUser).toHaveBeenCalledWith('u1');
  });

  it('POST / creates workspace', async () => {
    workspaceService.create.mockResolvedValue({ id: 'ws1' });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .send({ name: 'Acme' })
      .expect(201);

    expect(workspaceService.create).toHaveBeenCalledWith('u1', { name: 'Acme' });
  });

  it('GET /:id fetches workspace', async () => {
    workspaceService.findById.mockResolvedValue({ id: 'ws1' });

    await request(app.getHttpServer()).get('/api/v1/workspaces/ws1').expect(200);
    expect(workspaceService.findById).toHaveBeenCalledWith('ws1');
  });

  it('PATCH /:id updates', async () => {
    workspaceService.update.mockResolvedValue({ id: 'ws1' });

    await request(app.getHttpServer())
      .patch('/api/v1/workspaces/ws1')
      .send({ name: 'New' })
      .expect(200);

    expect(workspaceService.update).toHaveBeenCalledWith('ws1', 'u1', {
      name: 'New',
    });
  });

  it('POST /:id/members invites', async () => {
    workspaceService.inviteMember.mockResolvedValue({ id: 'ws1' });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/members')
      .send({ email: 'x@y.com' })
      .expect(201);

    expect(workspaceService.inviteMember).toHaveBeenCalledWith('ws1', {
      email: 'x@y.com',
    });
  });

  it('DELETE /:id/members/:userId removes member', async () => {
    workspaceService.removeMember.mockResolvedValue({ id: 'ws1' });

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws1/members/u2')
      .expect(200);

    expect(workspaceService.removeMember).toHaveBeenCalledWith('ws1', 'u2');
  });

  it('PATCH /:id/members/:userId updates role', async () => {
    workspaceService.updateMemberRole.mockResolvedValue({ id: 'ws1' });

    await request(app.getHttpServer())
      .patch('/api/v1/workspaces/ws1/members/u2')
      .send({ role: 'ADMIN' })
      .expect(200);

    expect(workspaceService.updateMemberRole).toHaveBeenCalledWith('ws1', 'u2', 'ADMIN');
  });
});
