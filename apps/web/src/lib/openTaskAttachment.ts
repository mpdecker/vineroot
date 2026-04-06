import { api } from './api';

export function isRemoteAttachmentUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * Opens an attachment: external URLs in a new tab; server-stored files via authenticated blob fetch
 * (plain <a href> cannot send the JWT).
 */
export async function openTaskAttachment(att: {
  id: string;
  url: string;
  filename: string;
}): Promise<void> {
  const u = att.url.trim();
  if (isRemoteAttachmentUrl(u)) {
    window.open(u, '_blank', 'noopener,noreferrer');
    return;
  }

  const tab = window.open('about:blank', '_blank', 'noopener,noreferrer');
  try {
    const res = await api.get(`/attachments/${att.id}/content`, {
      responseType: 'blob',
    });
    const blobUrl = URL.createObjectURL(res.data);
    if (tab) {
      tab.location.href = blobUrl;
    } else {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    }
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
  } catch {
    tab?.close();
    throw new Error('Could not open attachment');
  }
}
