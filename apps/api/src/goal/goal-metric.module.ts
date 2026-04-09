import { Module } from '@nestjs/common';
import { GoalMetricComputeService } from './goal-metric-compute.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  providers: [GoalMetricComputeService, PrismaService],
  exports: [GoalMetricComputeService],
})
export class GoalMetricModule {}
