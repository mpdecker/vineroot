import { describe, expect, it } from 'vitest';
import { extractMentionIdsFromBody } from './commentMentions';

describe('extractMentionIdsFromBody', () => {
  it('returns empty for text without mentions', () => {
    expect(extractMentionIdsFromBody('hello world')).toEqual([]);
  });

  it('extracts cuid-like ids', () => {
    const id = 'clxxxxxxxxxxxxxxxxxxxxxxxx';
    expect(extractMentionIdsFromBody(`Hi @${id} and @${id}`)).toEqual([id]);
  });

  it('dedupes multiple mentions', () => {
    const a = 'claaaaaaaaaaaaaaaaaaaaaaaa';
    const b = 'clbbbbbbbbbbbbbbbbbbbbbbbb';
    expect(extractMentionIdsFromBody(`@${a} @${b} @${a}`)).toEqual([a, b]);
  });
});
