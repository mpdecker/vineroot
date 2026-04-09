import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { AttachmentStorageRouter } from './attachment-storage.router';

/**
 * Deletes upload bytes (local disk or S3) and DB rows older than ATTACHMENT_RETENTION_DAYS.
 * Link-style attachments (`storageKey` starting with `link:`) are never removed.
 */
@Injectable()
export class AttachmentRetentionService {
  private readonly log = new Logger(AttachmentRetentionService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private storage: AttachmentStorageRouter,
  ) {}

  async purgeExpiredLocalFiles(): Promise<void> {
    const raw = this.config.get<string>('ATTACHMENT_RETENTION_DAYS') ?? '0';
    const days = parseInt(raw, 10);
    if (!Number.isFinite(days) || days < 1) return;

    const cutoff = new Date(Date.now() - days * 86400000);
    const batch = await this.prisma.attachment.findMany({
      where: {
        createdAt: { lt: cutoff },
        NOT: { storageKey: { startsWith: 'link:' } },
      },
      take: 500,
    });

    for (const a of batch) {
      try {
        await this.storage.removeStoredObject(a.storageKey);
      } catch (e: unknown) {
        this.log.warn(`Storage remove ${a.id}: ${String(e)}`);
      }
      await this.prisma.attachment.delete({ where: { id: a.id } }).catch(() => undefined);
    }

    if (batch.length > 0) {
      this.log.log(`Retention: processed ${batch.length} attachment(s) older than ${days}d`);
    }
  }
}
