import {
  ATTACHMENT_S3_STORAGE_PREFIX,
  buildS3StorageKey,
  parseAttachmentStorageKey,
} from './attachment-storage-key';

describe('attachment-storage-key', () => {
  it('parses link and empty', () => {
    expect(parseAttachmentStorageKey('')).toEqual({ kind: 'link' });
    expect(parseAttachmentStorageKey('link:https://x')).toEqual({ kind: 'link' });
  });

  it('parses s3 object key', () => {
    expect(parseAttachmentStorageKey(`${ATTACHMENT_S3_STORAGE_PREFIX}tasks/t1/a.pdf`)).toEqual({
      kind: 's3',
      objectKey: 'tasks/t1/a.pdf',
    });
  });

  it('parses local relative path', () => {
    expect(parseAttachmentStorageKey('tasks/t1/a.pdf')).toEqual({
      kind: 'local',
      relativePath: 'tasks/t1/a.pdf',
    });
  });

  it('buildS3StorageKey round-trips', () => {
    const k = 'tasks/x/y';
    const p = parseAttachmentStorageKey(buildS3StorageKey(k));
    expect(p).toEqual({ kind: 's3', objectKey: k });
  });
});
