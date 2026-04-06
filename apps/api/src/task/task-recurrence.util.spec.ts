import { computeNextRecurrenceWindow, parseRecurrenceRule } from './task-recurrence.util';

describe('task-recurrence.util', () => {
  it('parseRecurrenceRule accepts DAILY / WEEKLY / MONTHLY', () => {
    expect(parseRecurrenceRule('FREQ=DAILY;INTERVAL=2').freq).toBe('DAILY');
    expect(parseRecurrenceRule('FREQ=WEEKLY;INTERVAL=1').freq).toBe('WEEKLY');
    expect(parseRecurrenceRule('FREQ=MONTHLY;INTERVAL=1').freq).toBe('MONTHLY');
  });

  it('computeNextRecurrenceWindow advances daily after completion', () => {
    const due = new Date(Date.UTC(2026, 3, 10));
    const completion = new Date(Date.UTC(2026, 3, 10, 18, 0, 0));
    const next = computeNextRecurrenceWindow({
      rule: 'FREQ=DAILY;INTERVAL=1',
      dueDate: due,
      startDate: null,
      completion,
    });
    expect(next.dueDate).toBeDefined();
    expect(next.dueDate!.getUTCDate()).toBe(11);
  });

  it('computeNextRecurrenceWindow preserves start/due offset', () => {
    const start = new Date(Date.UTC(2026, 3, 8));
    const due = new Date(Date.UTC(2026, 3, 10));
    const completion = new Date(Date.UTC(2026, 3, 10, 12, 0, 0));
    const next = computeNextRecurrenceWindow({
      rule: 'FREQ=DAILY;INTERVAL=1',
      dueDate: due,
      startDate: start,
      completion,
    });
    expect(next.dueDate!.getUTCDate()).toBe(11);
    expect(next.startDate!.getUTCDate()).toBe(9);
  });
});
