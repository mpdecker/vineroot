import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, PrismaService, EventsGateway],
  exports: [NotificationService],
})
export class NotificationModule {}
