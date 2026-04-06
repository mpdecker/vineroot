import type { Readable } from 'stream';

export type AttachmentDownload =
  | { kind: 'file'; stream: Readable; mimeType: string; filename: string }
  | { kind: 'redirect'; url: string };
