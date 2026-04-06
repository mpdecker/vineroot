import { describe, it, expect } from 'vitest';
import { fieldValueToDisplay } from './taskDetailFieldValue';

describe('fieldValueToDisplay', () => {
  it('returns empty string for undefined', () => {
    expect(fieldValueToDisplay(undefined)).toBe('');
  });

  it('reads .text string', () => {
    expect(fieldValueToDisplay({ text: 'hello' })).toBe('hello');
  });

  it('reads .value string or number', () => {
    expect(fieldValueToDisplay({ value: 'x' })).toBe('x');
    expect(fieldValueToDisplay({ value: 42 })).toBe('42');
  });

  it('falls back to JSON.stringify for other shapes', () => {
    expect(fieldValueToDisplay({ checked: true })).toBe('{"checked":true}');
  });
});
