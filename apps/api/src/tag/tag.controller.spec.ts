import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { JwtAuthGuard } from '../auth/guards';

describe('TagController (HTTP)', () => {
  let app: INestApplication;
  const tagService = {
    listByWorkspace: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    attachTagToTask: jest.fn(),
    detachTagFromTask: jest.fn(),
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
      controllers: [TagController],
      providers: [{ provide: TagService, useValue: tagService }],
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

  it('GET / lists tags', async () => {
    tagService.listByWorkspace.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws1/tags')
      .expect(200);

    expect(tagService.listByWorkspace).toHaveBeenCalledWith('ws1');
  });

  it('POST / creates tag', async () => {
    tagService.create.mockResolvedValue({ id: 't1' });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/tags')
      .send({ name: 'bug', color: '#f00' })
      .expect(201);

    expect(tagService.create).toHaveBeenCalledWith('ws1', { name: 'bug', color: '#f00' });
  });

  it('DELETE /:id deletes tag', async () => {
    tagService.delete.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws1/tags/t1')
      .expect(200);

    expect(tagService.delete).toHaveBeenCalledWith('t1');
  });

  it('POST tasks/:taskId/tags/:tagId attaches', async () => {
    tagService.attachTagToTask.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws1/tags/tasks/task-1/tags/tag-1')
      .expect(201);

    expect(tagService.attachTagToTask).toHaveBeenCalledWith('task-1', 'tag-1');
  });

  it('DELETE tasks/:taskId/tags/:tagId detaches', async () => {
    tagService.detachTagFromTask.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws1/tags/tasks/task-1/tags/tag-1')
      .expect(200);

    expect(tagService.detachTagFromTask).toHaveBeenCalledWith('task-1', 'tag-1');
  });
});
