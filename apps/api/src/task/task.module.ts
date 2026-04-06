import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';
import { AutomationModule } from '../automation/automation.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { OutboundWebhookModule } from '../outbound-webhook/outbound-webhook.module';

@Module({
  imports: [AutomationModule, ActivityLogModule, AttachmentModule, OutboundWebhookModule],
  controllers: [TaskController],
  providers: [TaskService, PrismaService, EventsGateway],
  exports: [TaskService],
})
export class TaskModule {}
