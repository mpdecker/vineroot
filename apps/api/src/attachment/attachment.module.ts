import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { AttachmentRetentionService } from './attachment-retention.service';
import { AttachmentStorageRouter } from './attachment-storage.router';
import { LocalAttachmentStorage } from './local-attachment-storage';
import { PrismaService } from '../common/prisma.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ConfigModule, ActivityLogModule],
  controllers: [AttachmentController],
  providers: [
    LocalAttachmentStorage,
    {
      provide: AttachmentStorageRouter,
      useFactory: (config: ConfigService, local: LocalAttachmentStorage) =>
        AttachmentStorageRouter.factory(config, local),
      inject: [ConfigService, LocalAttachmentStorage],
    },
    AttachmentService,
    AttachmentRetentionService,
    PrismaService,
  ],
  exports: [AttachmentService, AttachmentRetentionService],
})
export class AttachmentModule {}
