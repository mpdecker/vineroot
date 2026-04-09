import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PrismaService } from '../common/prisma.service';
import { WorkScheduleModule } from '../schedule/schedule.module';

@Module({
  imports: [WorkScheduleModule],
  controllers: [DashboardController],
  providers: [DashboardService, PrismaService],
  exports: [DashboardService],
})
export class DashboardModule {}
