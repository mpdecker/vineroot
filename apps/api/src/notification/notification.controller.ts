import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificationService, NotificationQueryDto } from './notification.service';
import { JwtAuthGuard } from '../auth/guards';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  async list(
    @Request() req: any,
    @Query() query: NotificationQueryDto,
  ) {
    const result = await this.notificationService.findAllForUser(
      req.user.userId,
    );

    if (query.unreadOnly) {
      return {
        notifications: result.notifications.filter((n) => !n.isRead),
        unreadCount: result.unreadCount,
      };
    }

    return result;
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationService.getUnreadCount(
      req.user.userId,
    );
    return { count };
  }

  @Post(':id/read')
  async markRead(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return await this.notificationService.markRead(id, req.user.userId);
  }

  @Post('read-all')
  async markAllRead(@Request() req: any) {
    return await this.notificationService.markAllRead(req.user.userId);
  }
}
