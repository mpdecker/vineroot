import { describe, it, expect } from 'vitest';
import {
  parseTimephasedBasis,
  parseTimephasedGranularity,
  parseTimephasedGridMode,
} from './timephasedSearchParams';

function sp(entries: Record<string, string>): URLSearchParams {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) u.set(k, v);
  return u;
}

describe('timephasedSearchParams', () => {
  describe('parseTimephasedGranularity', () => {
    it('defaults to week when missing or not day', () => {
      expect(parseTimephasedGranularity(sp({}))).toBe('week');
      expect(parseTimephasedGranularity(sp({ granularity: '' }))).toBe('week');
      expect(parseTimephasedGranularity(sp({ granularity: 'week' }))).toBe('week');
    });
    it('returns day only when explicitly day', () => {
      expect(parseTimephasedGranularity(sp({ granularity: 'day' }))).toBe('day');
    });
  });

  describe('parseTimephasedBasis', () => {
    it('defaults to calendar', () => {
      expect(parseTimephasedBasis(sp({}))).toBe('calendar');
      expect(parseTimephasedBasis(sp({ basis: 'calendar' }))).toBe('calendar');
    });
    it('returns working when set', () => {
      expect(parseTimephasedBasis(sp({ basis: 'working' }))).toBe('working');
    });
  });

  describe('parseTimephasedGridMode', () => {
    it('defaults to task_usage', () => {
      expect(parseTimephasedGridMode(sp({}))).toBe('task_usage');
      expect(parseTimephasedGridMode(sp({ grid: '' }))).toBe('task_usage');
      expect(parseTimephasedGridMode(sp({ grid: 'bogus' }))).toBe('task_usage');
    });
    it('accepts list and resource_usage', () => {
      expect(parseTimephasedGridMode(sp({ grid: 'list' }))).toBe('list');
      expect(parseTimephasedGridMode(sp({ grid: 'resource_usage' }))).toBe('resource_usage');
    });
  });
});
