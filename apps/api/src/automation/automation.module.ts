import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [AutomationController],
  providers: [AutomationService, PrismaService, EventsGateway],
  exports: [AutomationService],
})
export class AutomationModule {}
