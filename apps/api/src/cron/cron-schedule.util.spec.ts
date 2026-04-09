import { resolveCronExpression } from './cron-schedule.util';

describe('resolveCronExpression', () => {
  it('returns null for explicit empty string', () => {
    expect(resolveCronExpression('', '0 * * * *')).toBeNull();
  });

  it('returns null for whitespace-only', () => {
    expect(resolveCronExpression('   ', '0 * * * *')).toBeNull();
  });

  it('uses default when raw is undefined', () => {
    expect(resolveCronExpression(undefined, '0 3 * * *')).toBe('0 3 * * *');
  });

  it('returns null when undefined and no default', () => {
    expect(resolveCronExpression(undefined, null)).toBeNull();
  });

  it('prefers explicit expression over default', () => {
    expect(resolveCronExpression('1 2 * * *', '0 3 * * *')).toBe('1 2 * * *');
  });
});
