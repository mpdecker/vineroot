import { BadRequestException } from '@nestjs/common';
import { assertAttachmentUploadAllowed } from './attachment-upload-policy';

describe('assertAttachmentUploadAllowed', () => {
  it('allows common document when executables blocked', () => {
    expect(() =>
      assertAttachmentUploadAllowed('application/pdf', 'report.pdf', false),
    ).not.toThrow();
  });

  it('rejects dangerous extension', () => {
    expect(() =>
      assertAttachmentUploadAllowed('application/octet-stream', 'setup.exe', false),
    ).toThrow(BadRequestException);
  });

  it('rejects blocked mime type', () => {
    expect(() =>
      assertAttachmentUploadAllowed('application/x-msdownload', 'file.bin', false),
    ).toThrow(BadRequestException);
  });

  it('skips checks when allowExecutables', () => {
    expect(() =>
      assertAttachmentUploadAllowed('application/x-msdownload', 'x.exe', true),
    ).not.toThrow();
  });
});
