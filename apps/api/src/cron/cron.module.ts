import { Module } from '@nestjs/common';
import { AttachmentModule } from '../attachment/attachment.module';
import { GoalMetricModule } from '../goal/goal-metric.module';
import { PmModule } from '../pm/pm.module';
import { ConfigurableCronService } from './configurable-cron.service';

@Module({
  imports: [GoalMetricModule, AttachmentModule, PmModule],
  providers: [ConfigurableCronService],
})
export class CronModule {}
