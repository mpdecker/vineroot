import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { JwtAuthGuard } from '../auth/guards';

describe('CommentController (HTTP)', () => {
  let app: INestApplication;
  const commentService = {
    listByTask: jest.fn(),
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
      controllers: [CommentController],
      providers: [{ provide: CommentService, useValue: commentService }],
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

  it('GET / lists comments for task', async () => {
    commentService.listByTask.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/tasks/t1/comments')
      .expect(200);

    expect(commentService.listByTask).toHaveBeenCalledWith('t1', 'u1');
  });

  it('POST / creates comment', async () => {
    commentService.create.mockResolvedValue({ id: 'c1' });

    await request(app.getHttpServer())
      .post('/api/v1/tasks/t1/comments')
      .send({ body: 'Hello' })
      .expect(201);

    expect(commentService.create).toHaveBeenCalledWith('t1', 'u1', { body: 'Hello' });
  });

  it('PATCH /:id updates', async () => {
    commentService.update.mockResolvedValue({ id: 'c1' });

    await request(app.getHttpServer())
      .patch('/api/v1/tasks/t1/comments/c1')
      .send({ body: 'Edited' })
      .expect(200);

    expect(commentService.update).toHaveBeenCalledWith('c1', 'u1', { body: 'Edited' });
  });

  it('DELETE /:id removes', async () => {
    commentService.delete.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/tasks/t1/comments/c1')
      .expect(200);

    expect(commentService.delete).toHaveBeenCalledWith('c1', 'u1');
  });
});
