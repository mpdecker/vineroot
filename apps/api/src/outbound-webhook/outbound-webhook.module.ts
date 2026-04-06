import { Module } from '@nestjs/common';
import { OutboundWebhookService } from './outbound-webhook.service';
import { OutboundWebhookController } from './outbound-webhook.controller';
import { PrismaService } from '../common/prisma.service';
import { WorkspaceAdminGuard } from '../auth/guards';

@Module({
  controllers: [OutboundWebhookController],
  providers: [OutboundWebhookService, PrismaService, WorkspaceAdminGuard],
  exports: [OutboundWebhookService],
})
export class OutboundWebhookModule {}
