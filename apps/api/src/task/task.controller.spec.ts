import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { AttachmentService } from '../attachment/attachment.service';
import { JwtAuthGuard } from '../auth/guards';

describe('TaskController (HTTP integration)', () => {
  let app: INestApplication;

  const taskService = {
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    addAttachment: jest.fn(),
    deleteAttachment: jest.fn(),
    addAssignee: jest.fn(),
    removeAssignee: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    reorderTasks: jest.fn(),
    broadcastTaskUpdated: jest.fn(),
  };

  const attachmentService = {
    saveUploadedFile: jest.fn(),
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
      controllers: [TaskController],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: AttachmentService, useValue: attachmentService },
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

  it('POST /api/v1/tasks/:id/dependencies forwards user and body', async () => {
    taskService.addDependency.mockResolvedValue({ id: 't-dep' });

    await request(app.getHttpServer())
      .post('/api/v1/tasks/t-dep/dependencies')
      .send({ blockingTaskId: 't-block' })
      .expect(201);

    expect(taskService.addDependency).toHaveBeenCalledWith('u1', 't-dep', {
      blockingTaskId: 't-block',
    });
  });

  it('DELETE /api/v1/tasks/:id/dependencies/:blockingTaskId', async () => {
    taskService.removeDependency.mockResolvedValue({ id: 't-dep' });

    await request(app.getHttpServer())
      .delete('/api/v1/tasks/t-dep/dependencies/t-block')
      .expect(200);

    expect(taskService.removeDependency).toHaveBeenCalledWith('u1', 't-dep', 't-block');
  });

  it('PATCH /api/v1/tasks/:id passes actor userId to service.update', async () => {
    taskService.update.mockResolvedValue({ id: 't1', title: 'X' });

    await request(app.getHttpServer())
      .patch('/api/v1/tasks/t1')
      .send({ title: 'Renamed' })
      .expect(200);

    expect(taskService.update).toHaveBeenCalledWith('t1', 'u1', { title: 'Renamed' });
  });

  it('PATCH /api/v1/tasks/reorder calls reorderTasks (not update with id=reorder)', async () => {
    taskService.reorderTasks.mockResolvedValue(undefined);

    const body = {
      items: [{ taskId: 't1', sortOrder: 0, sectionId: 's1' }],
    };

    await request(app.getHttpServer()).patch('/api/v1/tasks/reorder').send(body).expect(200);

    expect(taskService.reorderTasks).toHaveBeenCalledWith(body);
    expect(taskService.update).not.toHaveBeenCalled();
  });

  it('POST /api/v1/tasks/:id/attachments/upload saves file and returns task', async () => {
    attachmentService.saveUploadedFile.mockResolvedValue('att-id');
    taskService.findById.mockResolvedValue({ id: 't1', title: 'With file' });

    await request(app.getHttpServer())
      .post('/api/v1/tasks/t1/attachments/upload')
      .attach('file', Buffer.from('hello'), 'note.txt')
      .expect(201);

    expect(attachmentService.saveUploadedFile).toHaveBeenCalled();
    const call = attachmentService.saveUploadedFile.mock.calls[0];
    expect(call[0]).toBe('t1');
    expect(call[1]).toBe('u1');
    expect(call[2].originalname).toBe('note.txt');
    expect(taskService.findById).toHaveBeenCalledWith('t1');
    expect(taskService.broadcastTaskUpdated).toHaveBeenCalledWith({
      id: 't1',
      title: 'With file',
    });
  });

  it('POST /api/v1/tasks/:id/assignees passes actor and assignee', async () => {
    taskService.addAssignee.mockResolvedValue({ id: 't1' });

    await request(app.getHttpServer())
      .post('/api/v1/tasks/t1/assignees')
      .send({ userId: 'u-assignee' })
      .expect(201);

    expect(taskService.addAssignee).toHaveBeenCalledWith('t1', 'u1', 'u-assignee');
  });

  it('DELETE /api/v1/tasks/:id/assignees/:userId passes actor', async () => {
    taskService.removeAssignee.mockResolvedValue({ id: 't1' });

    await request(app.getHttpServer())
      .delete('/api/v1/tasks/t1/assignees/u-assignee')
      .expect(200);

    expect(taskService.removeAssignee).toHaveBeenCalledWith('t1', 'u1', 'u-assignee');
  });

  it('POST /api/v1/tasks/:id/attachments', async () => {
    taskService.addAttachment.mockResolvedValue({ id: 't1' });

    await request(app.getHttpServer())
      .post('/api/v1/tasks/t1/attachments')
      .send({
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1200,
        url: 'https://example.com/doc.pdf',
      })
      .expect(201);

    expect(taskService.addAttachment).toHaveBeenCalledWith('u1', 't1', {
      filename: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1200,
      url: 'https://example.com/doc.pdf',
    });
  });

  it('DELETE /api/v1/tasks/:id/attachments/:attachmentId', async () => {
    taskService.deleteAttachment.mockResolvedValue({ id: 't1' });

    await request(app.getHttpServer())
      .delete('/api/v1/tasks/t1/attachments/a99')
      .expect(200);

    expect(taskService.deleteAttachment).toHaveBeenCalledWith('u1', 't1', 'a99');
  });
});
