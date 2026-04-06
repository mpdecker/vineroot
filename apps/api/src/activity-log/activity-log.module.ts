import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TaskActivityLogService } from './task-activity-log.service';

@Module({
  providers: [TaskActivityLogService, PrismaService],
  exports: [TaskActivityLogService],
})
export class ActivityLogModule {}
