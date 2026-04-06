import { describe, it, expect } from 'vitest';
import { isRemoteAttachmentUrl } from './openTaskAttachment';

describe('isRemoteAttachmentUrl', () => {
  it('treats http(s) URLs as remote', () => {
    expect(isRemoteAttachmentUrl('https://example.com/doc.pdf')).toBe(true);
    expect(isRemoteAttachmentUrl('http://local/file')).toBe(true);
  });

  it('treats app-relative attachment paths as server-backed', () => {
    expect(isRemoteAttachmentUrl('/api/v1/attachments/x/content')).toBe(false);
    expect(isRemoteAttachmentUrl('')).toBe(false);
  });
});
