/** Parse `data:<mime>;base64,<payload>` from public intake JSON. */
export function parseIntakeFileDataUrl(raw: string): { mime: string; buffer: Buffer } | null {
  const s = raw.trim();
  const m = s.match(/^data:([\w/+.-]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    const buffer = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
    return { mime: m[1].toLowerCase(), buffer };
  } catch {
    return null;
  }
}

export function intakeFileDisplayName(fieldId: string, mime: string): string {
  const ext =
    mime === 'application/pdf'
      ? '.pdf'
      : mime === 'image/png'
        ? '.png'
        : mime === 'image/jpeg' || mime === 'image/jpg'
          ? '.jpg'
          : mime === 'image/gif'
            ? '.gif'
            : mime === 'image/webp'
              ? '.webp'
              : mime === 'text/plain'
                ? '.txt'
                : '.bin';
  return `intake-${fieldId.slice(0, 8)}${ext}`;
}
