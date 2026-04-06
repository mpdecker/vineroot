import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommentService } from './comment.service';
import { PrismaService } from '../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EventsGateway } from '../common/events.gateway';
import { TaskService } from '../task/task.service';

describe('CommentService', () => {
  let service: CommentService;
  const prisma = {
    task: { findFirst: jest.fn() },
    comment: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    projectWorkspace: { findMany: jest.fn() },
    workspaceMember: { findMany: jest.fn() },
  };
  const notifications = { create: jest.fn() };
  const eventsGateway = { emitToWorkspace: jest.fn(), emitToTask: jest.fn() };
  const taskService = { findById: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notifications },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: TaskService, useValue: taskService },
      ],
    }).compile();
    service = moduleRef.get(CommentService);
  });

  it('listByTask throws when task not accessible', async () => {
    prisma.task.findFirst.mockResolvedValue(null);

    await expect(service.listByTask('t1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listByTask returns mapped comments', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      title: 'T',
      projectId: 'p1',
      workspaceId: null,
    });
    const now = new Date();
    prisma.comment.findMany.mockResolvedValue([
      {
        id: 'c1',
        taskId: 't1',
        authorId: 'u1',
        parentCommentId: null,
        body: 'Hi',
        htmlBody: null,
        isAgentComment: false,
        createdAt: now,
        updatedAt: now,
        author: {
          id: 'u1',
          email: 'a@b.c',
          displayName: 'A',
          avatarUrl: null,
          isAgent: false,
          timezone: 'UTC',
          createdAt: now,
          updatedAt: now,
        },
        mentions: [],
      },
    ]);

    const list = await service.listByTask('t1', 'u1');

    expect(list).toHaveLength(1);
    expect(list[0].body).toBe('Hi');
    expect(list[0].parentCommentId).toBeNull();
  });
});
