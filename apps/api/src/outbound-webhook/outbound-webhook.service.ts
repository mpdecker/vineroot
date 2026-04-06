import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AutomationTriggerType } from '@prisma/client';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import type {
  OutboundWebhookDto,
  CreateOutboundWebhookRequest,
  CreateOutboundWebhookResponse,
  UpdateOutboundWebhookRequest,
} from '@vineroot/shared-types';

/** Events we actually emit from the task pipeline (subset of AutomationTriggerType). */
export const OUTBOUND_WEBHOOK_TRIGGER_TYPES: readonly AutomationTriggerType[] = [
  AutomationTriggerType.TASK_CREATED,
  AutomationTriggerType.TASK_STATUS_CHANGED,
  AutomationTriggerType.TASK_COMPLETED,
  AutomationTriggerType.ASSIGNEE_CHANGED,
  AutomationTriggerType.SECTION_CHANGED,
  AutomationTriggerType.AGENT_COMPLETED,
] as const;

@Injectable()
export class OutboundWebhookService {
  private readonly logger = new Logger(OutboundWebhookService.name);

  constructor(private prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    workspaceId: string;
    name: string;
    url: string;
    eventTypes: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): OutboundWebhookDto {
    const et = row.eventTypes;
    const eventTypes = Array.isArray(et)
      ? (et as string[]).filter((x) => typeof x === 'string')
      : [];
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      url: row.url,
      eventTypes,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private assertEventFilter(eventTypes: string[] | undefined) {
    if (!eventTypes || eventTypes.length === 0) return;
    const allowed = new Set(OUTBOUND_WEBHOOK_TRIGGER_TYPES as readonly string[]);
    for (const e of eventTypes) {
      if (!allowed.has(e)) {
        throw new BadRequestException(
          `Invalid webhook event type: ${e}. Allowed: ${[...allowed].join(', ')}`,
        );
      }
    }
  }

  async findAll(workspaceId: string): Promise<OutboundWebhookDto[]> {
    const rows = await this.prisma.workspaceOutboundWebhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    workspaceId: string,
    dto: CreateOutboundWebhookRequest,
  ): Promise<CreateOutboundWebhookResponse> {
    this.assertEventFilter(dto.eventTypes);
    const secret = randomBytes(32).toString('hex');
    const eventTypesJson =
      dto.eventTypes && dto.eventTypes.length > 0 ? dto.eventTypes : [];

    const row = await this.prisma.workspaceOutboundWebhook.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        url: dto.url.trim(),
        secret,
        eventTypes: eventTypesJson,
      },
    });

    return {
      webhook: this.toDto(row),
      signingSecret: secret,
    };
  }

  async update(
    id: string,
    workspaceId: string,
    dto: UpdateOutboundWebhookRequest,
  ): Promise<OutboundWebhookDto> {
    const existing = await this.prisma.workspaceOutboundWebhook.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Outbound webhook not found');
    }
    if (dto.eventTypes !== undefined) {
      this.assertEventFilter(dto.eventTypes);
    }

    const row = await this.prisma.workspaceOutboundWebhook.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.url !== undefined && { url: dto.url.trim() }),
        ...(dto.eventTypes !== undefined && { eventTypes: dto.eventTypes }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.toDto(row);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const existing = await this.prisma.workspaceOutboundWebhook.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Outbound webhook not found');
    }
    await this.prisma.workspaceOutboundWebhook.delete({ where: { id } });
  }

  async resolveWorkspaceIds(taskLike: {
    projectId?: string | null;
    workspaceId?: string | null;
  }): Promise<string[]> {
    if (taskLike.projectId) {
      const links = await this.prisma.projectWorkspace.findMany({
        where: { projectId: taskLike.projectId },
        select: { workspaceId: true },
      });
      return [...new Set(links.map((l) => l.workspaceId))];
    }
    if (taskLike.workspaceId) {
      return [taskLike.workspaceId];
    }
    return [];
  }

  /**
   * Fire-and-forget signed POSTs to every active subscription in the given workspaces
   * whose event filter matches (empty filter = all outbound types).
   */
  async deliverTaskEvent(
    workspaceIds: string[],
    trigger: AutomationTriggerType,
    taskPayload: Record<string, unknown>,
  ): Promise<void> {
    if (workspaceIds.length === 0) return;
    if (
      !(OUTBOUND_WEBHOOK_TRIGGER_TYPES as readonly string[]).includes(trigger)
    ) {
      return;
    }

    const webhooks = await this.prisma.workspaceOutboundWebhook.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        isActive: true,
      },
    });

    const bodyObj = {
      event: trigger,
      occurredAt: new Date().toISOString(),
      task: taskPayload,
    };
    const rawBody = JSON.stringify(bodyObj);
    const deliveryId = randomUUID();

    for (const wh of webhooks) {
      const types = wh.eventTypes as unknown;
      const list = Array.isArray(types) ? (types as string[]) : [];
      if (list.length > 0 && !list.includes(trigger)) {
        continue;
      }
      void this.deliverOne(wh, rawBody, deliveryId, trigger);
    }
  }

  private async deliverOne(
    wh: { id: string; url: string; secret: string },
    rawBody: string,
    deliveryId: string,
    event: string,
  ): Promise<void> {
    const sig = createHmac('sha256', wh.secret).update(rawBody).digest('hex');
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    try {
      await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vineroot-Event': event,
          'X-Vineroot-Delivery': deliveryId,
          'X-Vineroot-Signature': `sha256=${sig}`,
        },
        body: rawBody,
        signal: ac.signal,
      });
    } catch (e) {
      this.logger.warn(
        `Outbound webhook ${wh.id} delivery failed: ${(e as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
