import { Module } from '@nestjs/common';
import { GoalService } from './goal.service';
import { GoalController } from './goal.controller';
import { GoalMetricModule } from './goal-metric.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [GoalMetricModule],
  controllers: [GoalController],
  providers: [GoalService, PrismaService],
  exports: [GoalService],
})
export class GoalModule {}
