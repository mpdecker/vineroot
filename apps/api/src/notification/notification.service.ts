import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { NotificationType } from '@prisma/client';
import { IsOptional, IsBoolean } from 'class-validator';

export class NotificationQueryDto {
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private gateway: EventsGateway,
  ) {}

  async create(
    recipientId: string,
    senderId: string | null,
    type: NotificationType,
    title: string,
    body?: string,
    resourceId?: string,
    resourceType?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId,
        senderId,
        type,
        title,
        body,
        resourceId,
        resourceType,
      },
    });

    // Emit via WebSocket to the recipient's user room
    this.gateway.emitToUser(
      recipientId,
      '', // workspaceId can be empty for user notifications
      'notification:new',
      {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        resourceId: notification.resourceId,
        resourceType: notification.resourceType,
        createdAt: notification.createdAt,
      },
    );

    return notification;
  }

  async findAllForUser(userId: string, workspaceId?: string, limit = 50) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });

    return {
      notifications,
      unreadCount,
    };
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.recipientId !== userId) {
      throw new NotFoundException(
        'You do not have permission to mark this notification as read',
      );
    }

    return await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        recipientId: userId,
        isRead: false,
      },
    });
    return count;
  }
}
