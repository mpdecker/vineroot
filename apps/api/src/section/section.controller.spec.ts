import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { SectionController } from './section.controller';
import { SectionService } from './section.service';
import { JwtAuthGuard } from '../auth/guards';

describe('SectionController (HTTP)', () => {
  let app: INestApplication;
  const sectionService = {
    listByProject: jest.fn(),
    create: jest.fn(),
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
      controllers: [SectionController],
      providers: [{ provide: SectionService, useValue: sectionService }],
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

  it('GET / lists sections for project', async () => {
    sectionService.listByProject.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/projects/p1/sections')
      .expect(200);

    expect(sectionService.listByProject).toHaveBeenCalledWith('p1');
  });

  it('POST / creates section', async () => {
    sectionService.create.mockResolvedValue({ id: 's1' });

    await request(app.getHttpServer())
      .post('/api/v1/projects/p1/sections')
      .send({ name: 'Backlog' })
      .expect(201);

    expect(sectionService.create).toHaveBeenCalledWith('p1', { name: 'Backlog' });
  });

  it('PATCH /:id updates section', async () => {
    sectionService.update.mockResolvedValue({ id: 's1' });

    await request(app.getHttpServer())
      .patch('/api/v1/projects/p1/sections/s1')
      .send({ name: 'Done' })
      .expect(200);

    expect(sectionService.update).toHaveBeenCalledWith('s1', { name: 'Done' });
  });

  it('DELETE /:id removes section', async () => {
    sectionService.delete.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/projects/p1/sections/s1')
      .expect(200);

    expect(sectionService.delete).toHaveBeenCalledWith('s1');
  });
});
