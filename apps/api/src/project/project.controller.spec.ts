import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('ProjectController nested workspace routes (HTTP integration)', () => {
  let app: INestApplication;

  const projectService = {
    create: jest.fn(),
    listByWorkspace: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
      controllers: [ProjectController],
      providers: [{ provide: ProjectService, useValue: projectService }],
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

  it('POST with only name merges URL workspace id (no body.workspaceIds)', async () => {
    projectService.create.mockResolvedValue({
      id: 'p-solo',
      workspaceIds: ['ws-main'],
      name: 'Solo',
      createdById: 'u1',
      color: 'BLUE',
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'list',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws-main/projects')
      .send({ name: 'Solo' })
      .expect(201);

    expect(projectService.create).toHaveBeenCalledWith(
      ['ws-main'],
      'u1',
      expect.objectContaining({ name: 'Solo' }),
    );
  });

  it('POST merges URL workspace with optional extra workspaceIds', async () => {
    projectService.create.mockResolvedValue({
      id: 'p-new',
      workspaceIds: ['ws-main', 'ws-extra'],
      name: 'X',
      createdById: 'u1',
      color: 'BLUE',
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'list',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws-main/projects')
      .send({
        name: 'X',
        workspaceIds: ['ws-main', 'ws-extra'],
      })
      .expect(201);

    expect(projectService.create).toHaveBeenCalledWith(
      ['ws-main', 'ws-extra'],
      'u1',
      expect.objectContaining({ name: 'X' }),
    );
  });

  it('GET lists projects for workspace', async () => {
    projectService.listByWorkspace.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws-main/projects')
      .expect(200);

    expect(projectService.listByWorkspace).toHaveBeenCalledWith('ws-main', {
      teamId: undefined,
      status: undefined,
      archived: undefined,
    });
  });
});
