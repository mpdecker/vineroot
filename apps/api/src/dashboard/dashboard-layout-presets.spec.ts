import { computeAssignmentsForPreset } from './dashboard-layout-presets';

describe('computeAssignmentsForPreset', () => {
  it('orders by sortOrder then position', () => {
    const w = [
      {
        id: 'second',
        sortOrder: 1,
        gridX: 0,
        gridY: 0,
        gridW: 12,
        gridH: 2,
      },
      {
        id: 'first',
        sortOrder: 0,
        gridX: 0,
        gridY: 0,
        gridW: 12,
        gridH: 2,
      },
    ];
    const a = computeAssignmentsForPreset(w, 'kpi_row');
    expect(a[0].id).toBe('first');
    expect(a[1].id).toBe('second');
  });
});
