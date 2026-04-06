/** Matches @[userId] tokens (cuid-style) embedded in comment text. */
export function extractMentionIdsFromBody(body: string): string[] {
  const ids = new Set<string>();
  for (const m of body.matchAll(/@([a-z0-9]{20,36})/gi)) {
    ids.add(m[1]);
  }
  return [...ids];
}
