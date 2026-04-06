import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PmController } from './pm.controller';
import { PmService } from './pm.service';
import { PmOrchestratorGuard } from './pm-orchestrator.guard';

describe('PmController (HTTP)', () => {
  let app: INestApplication;
  const pm = {
    listPmProjects: jest.fn(),
    createPmProject: jest.fn(),
    getProject: jest.fn(),
    patchProjectStatus: jest.fn(),
    getReadyTasks: jest.fn(),
    getTaskById: jest.fn(),
    patchTaskStatus: jest.fn(),
    createTaskArtifact: jest.fn(),
    batchUpsertTasks: jest.fn(),
    getTaskDependencies: jest.fn(),
    createHumanGate: jest.fn(),
    listPendingGates: jest.fn(),
    resolveHumanGate: jest.fn(),
    listAudit: jest.fn(),
    appendAudit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.PM_ORCHESTRATOR_SECRET = 'test-pm-secret';

    const moduleRef = await Test.createTestingModule({
      controllers: [PmController],
      providers: [{ provide: PmService, useValue: pm }],
    })
      .overrideGuard(PmOrchestratorGuard)
      .useValue({ canActivate: () => true })
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

  it('GET /api/v1/pm/projects calls listPmProjects', async () => {
    pm.listPmProjects.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/pm/projects')
      .expect(200);
    expect(pm.listPmProjects).toHaveBeenCalled();
  });

  it('POST /api/v1/pm/projects validates body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pm/projects')
      .send({ name: 'Only name' })
      .expect(400);
    expect(pm.createPmProject).not.toHaveBeenCalled();
  });

  it('POST /api/v1/pm/projects creates project', async () => {
    pm.createPmProject.mockResolvedValue({ id: 'x', slug: 's', name: 'N' });
    await request(app.getHttpServer())
      .post('/api/v1/pm/projects')
      .send({ slug: 'my-app', name: 'My App' })
      .expect(201);
    expect(pm.createPmProject).toHaveBeenCalledWith('my-app', 'My App');
  });

  it('GET /api/v1/pm/tasks/ready forwards project_id', async () => {
    pm.getReadyTasks.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/pm/tasks/ready')
      .query({ project_id: '11111111-1111-4111-8111-111111111111' })
      .expect(200);
    expect(pm.getReadyTasks).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('PATCH /api/v1/pm/tasks/:id/status forwards body', async () => {
    pm.patchTaskStatus.mockResolvedValue({ id: 't1' });
    await request(app.getHttpServer())
      .patch('/api/v1/pm/tasks/t1/status')
      .send({ status: 'IN_PROGRESS', actor: 'CREW_BACKEND' })
      .expect(200);
    expect(pm.patchTaskStatus).toHaveBeenCalledWith('t1', {
      status: 'IN_PROGRESS',
      actor: 'CREW_BACKEND',
    });
  });

  it('POST /api/v1/pm/tasks/batch validates uuid', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/pm/tasks/batch')
      .send({ project_id: 'bad', tasks: [], dependencies: [] })
      .expect(400);
    expect(pm.batchUpsertTasks).not.toHaveBeenCalled();
  });

  it('GET /api/v1/pm/audit parses limit', async () => {
    pm.listAudit.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/pm/audit')
      .query({
        project_id: '11111111-1111-4111-8111-111111111111',
        limit: '10',
        before: '2020-01-01T00:00:00.000Z',
      })
      .expect(200);
    expect(pm.listAudit).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      10,
      '2020-01-01T00:00:00.000Z',
    );
  });

  it('GET /api/v1/pm/human-gates/pending forwards project_id', async () => {
    pm.listPendingGates.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/pm/human-gates/pending')
      .query({ project_id: '11111111-1111-4111-8111-111111111111' })
      .expect(200);
    expect(pm.listPendingGates).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
  });
});
