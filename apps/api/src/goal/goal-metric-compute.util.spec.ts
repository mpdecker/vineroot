import { resolveGoalMetricPeriod } from './goal-metric-compute.util';

describe('goal-metric-compute.util', () => {
  it('resolveGoalMetricPeriod supports CURRENT_QUARTER', () => {
    const { from, to } = resolveGoalMetricPeriod({ preset: 'CURRENT_QUARTER' });
    expect(from.getTime()).toBeLessThanOrEqual(to.getTime());
  });

  it('resolveGoalMetricPeriod supports explicit from/to', () => {
    const { from, to } = resolveGoalMetricPeriod({
      from: '2026-01-01',
      to: '2026-03-31',
    });
    expect(from.getFullYear()).toBe(2026);
    expect(to.getMonth()).toBe(2);
  });
});
