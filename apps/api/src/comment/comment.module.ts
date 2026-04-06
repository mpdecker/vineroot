import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { PrismaService } from '../common/prisma.service';
import { NotificationModule } from '../notification/notification.module';
import { TaskModule } from '../task/task.module';
import { EventsGateway } from '../common/events.gateway';

@Module({
  imports: [NotificationModule, TaskModule],
  controllers: [CommentController],
  providers: [CommentService, PrismaService, EventsGateway],
})
export class CommentModule {}
