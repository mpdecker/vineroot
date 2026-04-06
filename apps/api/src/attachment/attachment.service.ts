import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditEventType } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { TaskActivityLogService } from '../activity-log/task-activity-log.service';
import { assertAttachmentUploadAllowed } from './attachment-upload-policy';
import { AttachmentStorageRouter } from './attachment-storage.router';
import { buildS3StorageKey } from './attachment-storage-key';
import type { AttachmentDownload } from './attachment-download.types';

export type { AttachmentDownload };

@Injectable()
export class AttachmentService {
  constructor(
    private prisma: PrismaService,
    private taskActivityLog: TaskActivityLogService,
    private config: ConfigService,
    private storage: AttachmentStorageRouter,
  ) {}

  private allowExecutableUploads(): boolean {
    return this.config.get<string>('ATTACHMENT_ALLOW_EXECUTABLES') === '1';
  }

  /**
   * Remove bytes for an upload (no-op for `link:`). Handles local paths and `s3:…` keys.
   */
  async removeLocalStoredFile(storageKey: string): Promise<void> {
    await this.storage.removeStoredObject(storageKey);
  }

  private notifyUploadHook(payload: Record<string, unknown>): void {
    const url = this.config.get<string>('ATTACHMENT_UPLOAD_NOTIFY_URL')?.trim();
    if (!url) return;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    }).catch(() => undefined);
  }

  private async assertUserCanReadTask(taskId: string, userId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { include: { workspaceLinks: { orderBy: { joinedAt: 'asc' }, take: 1 } } },
      },
    });
    if (!task || task.deletedAt) {
      throw new NotFoundException('Task not found');
    }
    const workspaceId =
      task.workspaceId || task.project?.workspaceLinks?.[0]?.workspaceId;
    if (!workspaceId) {
      throw new ForbiddenException('No workspace context for this task');
    }
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) {
      throw new ForbiddenException('No access to this task');
    }
  }

  async saveUploadedFile(
    taskId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    if (!file?.buffer?.length && !file?.size) {
      throw new BadRequestException('Empty file');
    }
    const buffer = file.buffer ?? (file.path ? await fs.readFile(file.path) : null);
    if (!buffer?.length) {
      throw new BadRequestException('Could not read uploaded file');
    }
    const safeName = path
      .basename(file.originalname || 'upload')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 180);
    const mime = file.mimetype || 'application/octet-stream';
    return this.saveUploadBuffer(taskId, userId, buffer, file.originalname || safeName, mime);
  }

  /** Same pipeline as multipart upload (policy, S3/local, activity). */
  async saveUploadBuffer(
    taskId: string,
    userId: string,
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<string> {
    if (!buffer?.length) {
      throw new BadRequestException('Empty file');
    }
    await this.assertUserCanReadTask(taskId, userId);

    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    const safeName = path
      .basename(originalFilename || 'upload')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 180);
    const mime = mimeType?.trim() || 'application/octet-stream';
    assertAttachmentUploadAllowed(mime, originalFilename || safeName, this.allowExecutableUploads());

    const id = randomUUID();
    const relKey = ['tasks', taskId, `${id}-${safeName}`].join('/');
    const placement = await this.storage.saveUpload(relKey, buffer, mime);
    const storageKey = placement === 's3' ? buildS3StorageKey(relKey) : relKey;
    const urlPath = `/api/v1/attachments/${id}/content`;

    try {
      await this.prisma.attachment.create({
        data: {
          id,
          taskId,
          uploadedById: userId,
          filename: originalFilename || safeName,
          mimeType: mime,
          sizeBytes: buffer.length,
          url: urlPath,
          storageKey,
        },
      });
    } catch (e) {
      await this.storage.rollbackUpload(placement, relKey);
      throw e;
    }

    this.notifyUploadHook({
      event: 'attachment.uploaded',
      attachmentId: id,
      taskId,
      projectId: task.projectId,
      filename: originalFilename || safeName,
      mimeType: mime,
      sizeBytes: buffer.length,
      storage: placement,
    });

    await this.taskActivityLog.log({
      actorId: userId,
      taskId,
      projectId: task.projectId,
      eventType: AuditEventType.ATTACHMENT_ADDED,
      description: `Uploaded "${originalFilename || safeName}"`,
      newValue: { attachmentId: id, storage: placement },
    });

    return id;
  }

  async resolveDownload(attachmentId: string, userId: string): Promise<AttachmentDownload> {
    const att = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!att) {
      throw new NotFoundException('Attachment not found');
    }
    await this.assertUserCanReadTask(att.taskId, userId);

    if (att.storageKey.startsWith('link:')) {
      return { kind: 'redirect', url: att.url };
    }

    return this.storage.resolveDownload(att.storageKey, att.mimeType, att.filename);
  }
}
