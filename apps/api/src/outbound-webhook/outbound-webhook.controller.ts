import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  WorkspaceGuard,
  WorkspaceAdminGuard,
} from '../auth/guards';
import { OutboundWebhookService } from './outbound-webhook.service';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateOutboundWebhookBody {
  @IsString()
  name!: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  url!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];
}

export class UpdateOutboundWebhookBody {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('api/v1/workspaces/:workspaceId/outbound-webhooks')
@UseGuards(JwtAuthGuard, WorkspaceGuard, WorkspaceAdminGuard)
export class OutboundWebhookController {
  constructor(private readonly outboundWebhookService: OutboundWebhookService) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string) {
    return this.outboundWebhookService.findAll(workspaceId);
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateOutboundWebhookBody,
  ) {
    return this.outboundWebhookService.create(workspaceId, {
      name: body.name,
      url: body.url,
      eventTypes: body.eventTypes,
    });
  }

  @Patch(':webhookId')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('webhookId') webhookId: string,
    @Body() body: UpdateOutboundWebhookBody,
  ) {
    return this.outboundWebhookService.update(webhookId, workspaceId, body);
  }

  @Delete(':webhookId')
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('webhookId') webhookId: string,
  ) {
    await this.outboundWebhookService.remove(webhookId, workspaceId);
    return { ok: true };
  }
}
