import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards';

describe('TeamController (HTTP)', () => {
  let app: INestApplication;
  const teamService = {
    listByWorkspace: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
      controllers: [TeamController],
      providers: [{ provide: TeamService, useValue: teamService }],
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

  it('GET / lists teams', async () => {
    teamService.listByWorkspace.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/teams')
      .expect(200);

    expect(teamService.listByWorkspace).toHaveBeenCalledWith('ws1');
  });

  it('POST / creates team', async () => {
    teamService.create.mockResolvedValue({ id: 'tm1' });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/teams')
      .send({ name: 'Core' })
      .expect(201);

    expect(teamService.create).toHaveBeenCalledWith('ws1', { name: 'Core' });
  });

  it('GET /:id fetches one', async () => {
    teamService.findById.mockResolvedValue({ id: 'tm1' });

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/teams/tm1')
      .expect(200);

    expect(teamService.findById).toHaveBeenCalledWith('tm1');
  });

  it('PATCH /:id updates', async () => {
    teamService.update.mockResolvedValue({ id: 'tm1' });

    await request(app.getHttpServer())
      .patch('/api/v1/workspaces/ws1/teams/tm1')
      .send({ name: 'Renamed' })
      .expect(200);

    expect(teamService.update).toHaveBeenCalledWith('tm1', { name: 'Renamed' });
  });

  it('DELETE /:id deletes', async () => {
    teamService.delete.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws1/teams/tm1')
      .expect(200);

    expect(teamService.delete).toHaveBeenCalledWith('tm1');
  });
});
