import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AttachmentDownload } from './attachment-download.types';
import { parseAttachmentStorageKey } from './attachment-storage-key';
import { LocalAttachmentStorage } from './local-attachment-storage';
import { S3AttachmentStorage } from './s3-attachment-storage';

export type UploadPlacement = 'local' | 's3';

@Injectable()
export class AttachmentStorageRouter {
  private readonly s3: S3AttachmentStorage | null;

  constructor(
    private readonly config: ConfigService,
    private readonly local: LocalAttachmentStorage,
    s3: S3AttachmentStorage | null,
  ) {
    this.s3 = s3;
  }

  static factory(
    config: ConfigService,
    local: LocalAttachmentStorage,
  ): AttachmentStorageRouter {
    const s3 = S3AttachmentStorage.tryCreate(config);
    return new AttachmentStorageRouter(config, local, s3);
  }

  /** When `S3_BUCKET` is set, new uploads go to S3; otherwise local disk under `UPLOAD_ROOT`. */
  isS3Primary(): boolean {
    return this.s3 != null;
  }

  async saveUpload(relativePath: string, buffer: Buffer, contentType: string): Promise<UploadPlacement> {
    if (this.s3) {
      await this.s3.put(relativePath, buffer, contentType);
      return 's3';
    }
    await this.local.write(relativePath, buffer);
    return 'local';
  }

  async rollbackUpload(placement: UploadPlacement, relativePath: string): Promise<void> {
    try {
      if (placement === 's3' && this.s3) {
        await this.s3.remove(relativePath);
      } else if (placement === 'local') {
        await this.local.remove(relativePath);
      }
    } catch {
      /* best-effort */
    }
  }

  /**
   * Persisted `storageKey` from DB: `link:…`, `s3:tasks/…`, or local `tasks/…`.
   */
  async removeStoredObject(storageKey: string): Promise<void> {
    const parsed = parseAttachmentStorageKey(storageKey);
    if (parsed.kind === 'link') return;
    if (parsed.kind === 's3') {
      if (!this.s3) {
        return;
      }
      await this.s3.remove(parsed.objectKey).catch(() => undefined);
      return;
    }
    await this.local.remove(parsed.relativePath);
  }

  async resolveDownload(
    storageKey: string,
    mimeType: string,
    filename: string,
  ): Promise<AttachmentDownload> {
    const parsed = parseAttachmentStorageKey(storageKey);
    if (parsed.kind === 'link') {
      throw new Error('resolveDownload: link keys must be handled by caller');
    }
    if (parsed.kind === 's3') {
      if (!this.s3) {
        throw new NotFoundException('Object storage not configured for this attachment');
      }
      const ok = await this.s3.exists(parsed.objectKey);
      if (!ok) {
        throw new NotFoundException('File no longer in storage');
      }
      const url = await this.s3.presignedGetUrl(parsed.objectKey, filename, mimeType);
      return { kind: 'redirect', url };
    }
    if (!this.local.exists(parsed.relativePath)) {
      throw new NotFoundException('File no longer on server');
    }
    return {
      kind: 'file',
      stream: this.local.createReadStream(parsed.relativePath),
      mimeType,
      filename,
    };
  }
}
