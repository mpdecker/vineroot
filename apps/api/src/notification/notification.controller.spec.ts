import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards';

describe('NotificationController (HTTP)', () => {
  let app: INestApplication;
  const notificationService = {
    findAllForUser: jest.fn(),
    getUnreadCount: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
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
      controllers: [NotificationController],
      providers: [{ provide: NotificationService, useValue: notificationService }],
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

  it('GET / returns full list when unreadOnly absent', async () => {
    const payload = {
      notifications: [{ id: 'n1', isRead: false }],
      unreadCount: 1,
    };
    notificationService.findAllForUser.mockResolvedValue(payload);

    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .expect(200);

    expect(res.body).toEqual(payload);
    expect(notificationService.findAllForUser).toHaveBeenCalledWith('u1');
  });

  it('GET / filters to unread when unreadOnly is set', async () => {
    notificationService.findAllForUser.mockResolvedValue({
      notifications: [
        { id: 'a', isRead: true },
        { id: 'b', isRead: false },
      ],
      unreadCount: 1,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .query({ unreadOnly: '1' })
      .expect(200);

    expect(res.body.notifications).toEqual([{ id: 'b', isRead: false }]);
    expect(res.body.unreadCount).toBe(1);
  });

  it('GET /unread-count returns count', async () => {
    notificationService.getUnreadCount.mockResolvedValue(3);

    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .expect(200);

    expect(res.body).toEqual({ count: 3 });
  });

  it('POST /:id/read marks read', async () => {
    notificationService.markRead.mockResolvedValue({ ok: true });

    await request(app.getHttpServer())
      .post('/api/v1/notifications/n1/read')
      .expect(201);

    expect(notificationService.markRead).toHaveBeenCalledWith('n1', 'u1');
  });

  it('POST /read-all marks all read', async () => {
    notificationService.markAllRead.mockResolvedValue({ updated: 5 });

    await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .expect(201);

    expect(notificationService.markAllRead).toHaveBeenCalledWith('u1');
  });
});
