import { Test } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';

describe('NotificationService', () => {
  let service: NotificationService;
  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const gateway = { emitToUser: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsGateway, useValue: gateway },
      ],
    }).compile();

    service = moduleRef.get(NotificationService);
  });

  it('findAllForUser returns notifications and unreadCount', async () => {
    const rows = [{ id: 'n1', isRead: false }];
    prisma.notification.findMany.mockResolvedValue(rows);
    prisma.notification.count.mockResolvedValue(3);

    const result = await service.findAllForUser('user-1');

    expect(result.notifications).toEqual(rows);
    expect(result.unreadCount).toBe(3);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: 'user-1' },
        take: 50,
      }),
    );
  });
});
