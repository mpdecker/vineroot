import { BadRequestException } from '@nestjs/common';

/** Executable / script-like extensions blocked by default (local uploads). */
const BLOCKED_EXT =
  /\.(exe|bat|cmd|com|msi|scr|pif|vbs|vbe|js|jse|wsf|wsh|ps1|psm1|dll|jar|app|deb|rpm|dmg)$/i;

const BLOCKED_MIME_EXACT = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-dosexec',
  'application/x-executable',
  'application/x-sh',
  'application/javascript',
  'text/javascript',
]);

/**
 * Enforces upload policy before bytes are written. MIME can be spoofed; extension + MIME both checked.
 * Set ATTACHMENT_ALLOW_EXECUTABLES=1 to disable extension/MIME blocks (not recommended in production).
 */
export function assertAttachmentUploadAllowed(
  mimetype: string,
  originalname: string,
  allowExecutables: boolean,
): void {
  if (allowExecutables) return;
  const name = originalname || 'upload';
  if (BLOCKED_EXT.test(name)) {
    throw new BadRequestException('This file type is not allowed for upload');
  }
  const m = (mimetype || '').toLowerCase().trim();
  if (BLOCKED_MIME_EXACT.has(m)) {
    throw new BadRequestException('This file type is not allowed for upload');
  }
}
