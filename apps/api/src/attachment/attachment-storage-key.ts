/** Prefix for objects stored in S3-compatible blob storage (bucket from env). */
export const ATTACHMENT_S3_STORAGE_PREFIX = 's3:' as const;

export type ParsedAttachmentStorage =
  | { kind: 'link' }
  | { kind: 'local'; relativePath: string }
  | { kind: 's3'; objectKey: string };

export function parseAttachmentStorageKey(storageKey: string): ParsedAttachmentStorage {
  if (!storageKey || storageKey.startsWith('link:')) {
    return { kind: 'link' };
  }
  if (storageKey.startsWith(ATTACHMENT_S3_STORAGE_PREFIX)) {
    const objectKey = storageKey.slice(ATTACHMENT_S3_STORAGE_PREFIX.length).replace(/^\//, '');
    return objectKey.length > 0 ? { kind: 's3', objectKey } : { kind: 'link' };
  }
  return { kind: 'local', relativePath: storageKey };
}

export function buildS3StorageKey(objectKey: string): string {
  return `${ATTACHMENT_S3_STORAGE_PREFIX}${objectKey}`;
}
