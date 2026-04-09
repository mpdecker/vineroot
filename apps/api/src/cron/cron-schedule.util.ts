/**
 * Resolve a cron expression from env.
 * - `undefined` / missing → use `defaultWhenUnset` (may be null to mean “off”).
 * - `""` or whitespace-only → off (do not register).
 */
export function resolveCronExpression(
  raw: string | undefined,
  defaultWhenUnset: string | null,
): string | null {
  if (raw === '') {
    return null;
  }
  if (raw == null) {
    const d = defaultWhenUnset?.trim();
    return d && d.length > 0 ? d : null;
  }
  const t = raw.trim();
  return t.length > 0 ? t : null;
}
