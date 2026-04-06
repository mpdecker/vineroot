import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { ProjectResourceController } from './project-resource.controller';
import { ProjectService } from './project.service';
import { ProjectIntakeFormService } from './project-intake-form.service';
import { JwtAuthGuard } from '../auth/guards';

describe('ProjectResourceController (HTTP integration)', () => {
  let app: INestApplication;

  const projectService = {
    createFromRequest: jest.fn(),
    listForUser: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    listProjectCustomFields: jest.fn(),
    addProjectCustomField: jest.fn(),
    listProjectActivity: jest.fn(),
    getSprintBurndown: jest.fn(),
    getSprintBurnup: jest.fn(),
    getProjectSprintVelocity: jest.fn(),
    getProjectCfd: jest.fn(),
    getEpicRollups: jest.fn(),
    getProjectWorkload: jest.fn(),
    listProjectSavedViews: jest.fn(),
    createProjectSavedView: jest.fn(),
    updateProjectSavedView: jest.fn(),
    deleteProjectSavedView: jest.fn(),
    reorderProjectSavedViews: jest.fn(),
    listSprints: jest.fn(),
    createSprint: jest.fn(),
  };

  const intakeFormService = {
    getForProject: jest.fn(),
    upsert: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
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
      controllers: [ProjectResourceController],
      providers: [
        { provide: ProjectService, useValue: projectService },
        { provide: ProjectIntakeFormService, useValue: intakeFormService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/projects forwards body to createFromRequest', async () => {
    projectService.createFromRequest.mockResolvedValue({
      id: 'p1',
      workspaceIds: ['ws-a'],
      name: 'N',
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
      .post('/api/v1/projects')
      .send({ name: 'N', workspaceIds: ['ws-a', 'ws-b'] })
      .expect(201);

    expect(projectService.createFromRequest).toHaveBeenCalledWith('u1', {
      name: 'N',
      workspaceIds: ['ws-a', 'ws-b'],
    });
  });

  it('GET /api/v1/projects lists mine', async () => {
    projectService.listForUser.mockResolvedValue([]);

    await request(app.getHttpServer()).get('/api/v1/projects').expect(200);

    expect(projectService.listForUser).toHaveBeenCalledWith('u1');
  });

  it('GET /api/v1/projects/:id/custom-fields lists project field definitions', async () => {
    projectService.listProjectCustomFields.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/custom-fields')
      .expect(200);

    expect(projectService.listProjectCustomFields).toHaveBeenCalledWith('p1', 'u1');
  });

  it('GET /api/v1/projects/:id/activity-logs lists project activity', async () => {
    projectService.listProjectActivity.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/activity-logs?take=50')
      .expect(200);

    expect(projectService.listProjectActivity).toHaveBeenCalledWith('p1', 'u1', 50);
  });

  it('POST /api/v1/projects/:id/custom-fields links a workspace field', async () => {
    const dto = {
      id: 'f1',
      workspaceId: 'ws-a',
      name: 'Priority',
      type: 'TEXT',
      options: null,
      isRequired: false,
      createdAt: new Date(),
    };
    projectService.addProjectCustomField.mockResolvedValue(dto);

    await request(app.getHttpServer())
      .post('/api/v1/projects/p1/custom-fields')
      .send({ fieldId: 'f1' })
      .expect(201);

    expect(projectService.addProjectCustomField).toHaveBeenCalledWith('p1', 'u1', {
      fieldId: 'f1',
    });
  });

  it('GET /api/v1/projects/:id/sprints/velocity uses default take=6', async () => {
    projectService.getProjectSprintVelocity.mockResolvedValue({
      projectId: 'p1',
      sprints: [],
      averageCompletedPoints: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sprints/velocity')
      .expect(200);

    expect(projectService.getProjectSprintVelocity).toHaveBeenCalledWith('p1', 'u1', 6);
  });

  it('GET /api/v1/projects/:id/sprints/velocity parses take query', async () => {
    projectService.getProjectSprintVelocity.mockResolvedValue({
      projectId: 'p1',
      sprints: [],
      averageCompletedPoints: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sprints/velocity?take=3')
      .expect(200);

    expect(projectService.getProjectSprintVelocity).toHaveBeenCalledWith('p1', 'u1', 3);
  });

  it('GET /api/v1/projects/:id/sprints/velocity clamps take to 1–12', async () => {
    projectService.getProjectSprintVelocity.mockResolvedValue({
      projectId: 'p1',
      sprints: [],
      averageCompletedPoints: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sprints/velocity?take=0')
      .expect(200);
    expect(projectService.getProjectSprintVelocity).toHaveBeenLastCalledWith('p1', 'u1', 1);

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sprints/velocity?take=500')
      .expect(200);
    expect(projectService.getProjectSprintVelocity).toHaveBeenLastCalledWith('p1', 'u1', 12);
  });

  it('GET /api/v1/projects/:id/sprints/velocity ignores invalid take', async () => {
    projectService.getProjectSprintVelocity.mockResolvedValue({
      projectId: 'p1',
      sprints: [],
      averageCompletedPoints: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sprints/velocity?take=nan')
      .expect(200);

    expect(projectService.getProjectSprintVelocity).toHaveBeenCalledWith('p1', 'u1', 6);
  });

  it('GET /api/v1/projects/:id/sprints/:sprintId/burndown delegates to service', async () => {
    const payload = {
      sprintId: 'sp1',
      projectId: 'p1',
      totalScope: 4,
      days: [{ date: '2024-06-10', remaining: 4, ideal: 4 }],
    };
    projectService.getSprintBurndown.mockResolvedValue(payload);

    const res = await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sprints/sp1/burndown')
      .expect(200);

    expect(res.body).toEqual(payload);
    expect(projectService.getSprintBurndown).toHaveBeenCalledWith('p1', 'sp1', 'u1');
  });

  it('GET /api/v1/projects/:id/sprints/:sprintId/burndown returns 404 when sprint missing', async () => {
    projectService.getSprintBurndown.mockRejectedValue(new NotFoundException('Sprint not found'));

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sprints/sp-missing/burndown')
      .expect(404);
  });

  it('GET /api/v1/projects/:id/cfd passes from/to query to service', async () => {
    const payload = {
      projectId: 'p1',
      days: [{ date: '2026-01-01', byStatus: { BACKLOG: 1 } }],
      statusOrder: ['BACKLOG', 'DONE'],
    };
    projectService.getProjectCfd.mockResolvedValue(payload);

    const res = await request(app.getHttpServer())
      .get('/api/v1/projects/p1/cfd?from=2026-01-01&to=2026-01-07')
      .expect(200);

    expect(res.body).toEqual(payload);
    expect(projectService.getProjectCfd).toHaveBeenCalledWith('p1', 'u1', '2026-01-01', '2026-01-07');
  });

  it('GET /api/v1/projects/:id/epic-rollups delegates to service', async () => {
    const payload = {
      projectId: 'p1',
      epics: [
        {
          epicId: 'e1',
          title: 'Epic',
          storyPointsTotal: 5,
          taskCount: 2,
          doneCount: 1,
        },
      ],
    };
    projectService.getEpicRollups.mockResolvedValue(payload);

    const res = await request(app.getHttpServer())
      .get('/api/v1/projects/p1/epic-rollups')
      .expect(200);

    expect(res.body).toEqual(payload);
    expect(projectService.getEpicRollups).toHaveBeenCalledWith('p1', 'u1');
  });

  it('GET /api/v1/projects/:id/workload passes weeks and from to service', async () => {
    const payload: Record<string, unknown> = {
      projectId: 'p1',
      from: '2026-04-06',
      to: '2026-04-26',
      weekStarts: ['2026-04-06', '2026-04-13', '2026-04-20'],
      rows: [],
    };
    projectService.getProjectWorkload.mockResolvedValue(payload);

    const res = await request(app.getHttpServer())
      .get('/api/v1/projects/p1/workload?weeks=8&from=2026-04-01')
      .expect(200);

    expect(res.body).toEqual(payload);
    expect(projectService.getProjectWorkload).toHaveBeenCalledWith(
      'p1',
      'u1',
      '8',
      '2026-04-01',
      undefined,
      undefined,
    );
  });

  it('GET /api/v1/projects/:id/workload passes sprint and epic filters', async () => {
    const payload: Record<string, unknown> = {
      projectId: 'p1',
      from: '2026-04-06',
      to: '2026-04-26',
      weekStarts: [],
      rows: [],
    };
    projectService.getProjectWorkload.mockResolvedValue(payload);

    await request(app.getHttpServer())
      .get(
        '/api/v1/projects/p1/workload?weeks=6&from=2026-04-01&sprintFilter=backlog&epicFilter=epictaskid1',
      )
      .expect(200);

    expect(projectService.getProjectWorkload).toHaveBeenCalledWith(
      'p1',
      'u1',
      '6',
      '2026-04-01',
      'backlog',
      'epictaskid1',
    );
  });

  it('GET /api/v1/projects/:id/saved-views lists saved views', async () => {
    projectService.listProjectSavedViews.mockResolvedValue([]);

    await request(app.getHttpServer()).get('/api/v1/projects/p1/saved-views').expect(200);

    expect(projectService.listProjectSavedViews).toHaveBeenCalledWith('p1', 'u1');
  });

  it('POST /api/v1/projects/:id/saved-views creates a saved view', async () => {
    const dto = {
      id: 'sv1',
      projectId: 'p1',
      createdById: 'u1',
      name: 'My sprint',
      config: { sprintFilter: 'backlog', rootsOnly: true },
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projectService.createProjectSavedView.mockResolvedValue(dto);

    const res = await request(app.getHttpServer())
      .post('/api/v1/projects/p1/saved-views')
      .send({ name: 'My sprint', config: { sprintFilter: 'backlog', rootsOnly: true } })
      .expect(201);

    expect(res.body).toEqual(dto);
    expect(projectService.createProjectSavedView).toHaveBeenCalledWith('p1', 'u1', {
      name: 'My sprint',
      config: { sprintFilter: 'backlog', rootsOnly: true },
    });
  });

  it('PATCH /api/v1/projects/:id/saved-views/reorder reorders saved views', async () => {
    const list = [
      {
        id: 'sv2',
        projectId: 'p1',
        createdById: 'u1',
        name: 'Second',
        config: {},
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'sv1',
        projectId: 'p1',
        createdById: 'u1',
        name: 'First',
        config: {},
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    projectService.reorderProjectSavedViews.mockResolvedValue(list);

    const res = await request(app.getHttpServer())
      .patch('/api/v1/projects/p1/saved-views/reorder')
      .send({ orderedIds: ['sv2', 'sv1'] })
      .expect(200);

    expect(res.body).toEqual(list);
    expect(projectService.reorderProjectSavedViews).toHaveBeenCalledWith('p1', 'u1', [
      'sv2',
      'sv1',
    ]);
  });

  it('PATCH /api/v1/projects/:id/saved-views/:viewId updates a saved view', async () => {
    const dto = {
      id: 'sv1',
      projectId: 'p1',
      createdById: 'u1',
      name: 'Renamed',
      config: { epicFilter: 'all' },
      sortOrder: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projectService.updateProjectSavedView.mockResolvedValue(dto);

    const res = await request(app.getHttpServer())
      .patch('/api/v1/projects/p1/saved-views/sv1')
      .send({ name: 'Renamed', sortOrder: 1 })
      .expect(200);

    expect(res.body).toEqual(dto);
    expect(projectService.updateProjectSavedView).toHaveBeenCalledWith('p1', 'sv1', 'u1', {
      name: 'Renamed',
      sortOrder: 1,
    });
  });

  it('DELETE /api/v1/projects/:id/saved-views/:viewId removes a saved view', async () => {
    projectService.deleteProjectSavedView.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/projects/p1/saved-views/sv1')
      .expect(200);

    expect(projectService.deleteProjectSavedView).toHaveBeenCalledWith('p1', 'sv1', 'u1');
  });

  it('GET /api/v1/projects/:id/sprints/:sprintId/burnup delegates to service', async () => {
    const payload = {
      sprintId: 'sp1',
      projectId: 'p1',
      totalScope: 8,
      initialScope: 8,
      scopeChanges: [],
      days: [
        { date: '2024-06-10', completedCumulative: 0, scopeTotal: 8 },
        { date: '2024-06-11', completedCumulative: 8, scopeTotal: 8 },
      ],
    };
    projectService.getSprintBurnup.mockResolvedValue(payload);

    const res = await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sprints/sp1/burnup')
      .expect(200);

    expect(res.body).toEqual(payload);
    expect(projectService.getSprintBurnup).toHaveBeenCalledWith('p1', 'sp1', 'u1');
  });

  it('GET /api/v1/projects/:id/sprints lists sprints', async () => {
    projectService.listSprints.mockResolvedValue([]);

    await request(app.getHttpServer()).get('/api/v1/projects/p1/sprints').expect(200);

    expect(projectService.listSprints).toHaveBeenCalledWith('p1', 'u1');
  });

  it('POST /api/v1/projects/:id/sprints creates a sprint', async () => {
    const dto = {
      id: 'sp-new',
      projectId: 'p1',
      name: 'S1',
      goal: null,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-14'),
      state: 'PLANNED',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    projectService.createSprint.mockResolvedValue(dto);

    await request(app.getHttpServer())
      .post('/api/v1/projects/p1/sprints')
      .send({ name: 'S1', startDate: '2024-01-01', endDate: '2024-01-14' })
      .expect(201);

    expect(projectService.createSprint).toHaveBeenCalledWith('p1', 'u1', {
      name: 'S1',
      startDate: '2024-01-01',
      endDate: '2024-01-14',
    });
  });
});
