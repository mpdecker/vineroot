import { Module } from '@nestjs/common';
import { CustomFieldService } from './custom-field.service';
import { CustomFieldController } from './custom-field.controller';
import { PrismaService } from '../common/prisma.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [CustomFieldController],
  providers: [CustomFieldService, PrismaService],
})
export class CustomFieldModule {}
