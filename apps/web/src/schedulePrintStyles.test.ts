import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * Guards F-01 print/PDF snapshot CSS so refactors do not drop the print isolate rules.
 */
describe('schedule print styles (index.css)', () => {
  it('defines landscape print page and #vineroot-schedule-print-root visibility isolate', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(dir, 'index.css'), 'utf8');
    expect(css).toContain('@media print');
    expect(css).toContain('#vineroot-schedule-print-root');
    expect(css).toMatch(/size:\s*landscape/i);
    expect(css).toContain('visibility: hidden');
    expect(css).toContain('visibility: visible');
  });
});
