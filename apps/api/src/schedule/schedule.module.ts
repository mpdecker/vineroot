import { Module, forwardRef } from '@nestjs/common';
import { WorkCalendarService } from './work-calendar.service';
import { GenericResourceService } from './generic-resource.service';
import { ScheduleProgramService } from './schedule-program.service';
import { ScheduleProjectService } from './schedule-project.service';
import {
  GenericResourceController,
  WorkCalendarController,
  ScheduleProgramController,
  ScheduleProjectController,
} from './schedule.controller';
import { TaskModule } from '../task/task.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [forwardRef(() => TaskModule)],
  controllers: [
    WorkCalendarController,
    GenericResourceController,
    ScheduleProgramController,
    ScheduleProjectController,
  ],
  providers: [
    PrismaService,
    WorkCalendarService,
    GenericResourceService,
    ScheduleProgramService,
    ScheduleProjectService,
  ],
  exports: [
    WorkCalendarService,
    GenericResourceService,
    ScheduleProgramService,
    ScheduleProjectService,
  ],
})
/** MS Project–style scheduling (calendars, CPM, baselines). Not NestJS @nestjs/schedule. */
export class WorkScheduleModule {}
