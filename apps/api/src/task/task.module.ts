import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { PrismaService } from '../common/prisma.service';
import { AutomationModule } from '../automation/automation.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { OutboundWebhookModule } from '../outbound-webhook/outbound-webhook.module';
import { GoalMetricModule } from '../goal/goal-metric.module';
import { CustomFieldModule } from '../custom-field/custom-field.module';

@Module({
  imports: [
    AutomationModule,
    ActivityLogModule,
    AttachmentModule,
    OutboundWebhookModule,
    GoalMetricModule,
    CustomFieldModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, PrismaService],
  exports: [TaskService],
})
export class TaskModule {}
