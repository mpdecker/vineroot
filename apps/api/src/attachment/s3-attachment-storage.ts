import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';

/**
 * S3-compatible uploads (AWS S3, MinIO, Cloudflare R2, etc.).
 * Enabled when `S3_BUCKET` is set; optional `S3_ENDPOINT` + `S3_FORCE_PATH_STYLE=1` for MinIO.
 */
export class S3AttachmentStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly presignSeconds: number,
  ) {}

  static tryCreate(config: ConfigService): S3AttachmentStorage | null {
    const bucket = config.get<string>('S3_BUCKET')?.trim();
    if (!bucket) return null;

    const region = (config.get<string>('AWS_REGION') ?? config.get<string>('S3_REGION') ?? 'us-east-1').trim();
    const endpoint = config.get<string>('S3_ENDPOINT')?.trim();
    const forcePathStyle =
      config.get<string>('S3_FORCE_PATH_STYLE') === '1' ||
      config.get<string>('S3_FORCE_PATH_STYLE')?.toLowerCase() === 'true';

    const client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle } : {}),
    });

    const rawPresign = config.get<string>('ATTACHMENT_S3_PRESIGN_SECONDS');
    const presignSeconds = rawPresign ? Math.min(3600, Math.max(60, parseInt(rawPresign, 10) || 300)) : 300;

    return new S3AttachmentStorage(client, bucket, presignSeconds);
  }

  async put(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async remove(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  async exists(objectKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async presignedGetUrl(objectKey: string, filename: string, mimeType: string): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ResponseContentType: mimeType,
      ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: this.presignSeconds });
  }
}
