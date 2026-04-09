/** Query keys for `/projects/:id/timephased` — kept in sync with saved views. */

export type TimephasedGridMode = 'list' | 'task_usage' | 'resource_usage';

export function parseTimephasedGranularity(sp: URLSearchParams): 'week' | 'day' {
  return sp.get('granularity') === 'day' ? 'day' : 'week';
}

export function parseTimephasedBasis(sp: URLSearchParams): 'calendar' | 'working' {
  return sp.get('basis') === 'working' ? 'working' : 'calendar';
}

export function parseTimephasedGridMode(sp: URLSearchParams): TimephasedGridMode {
  const g = sp.get('grid');
  if (g === 'list') return 'list';
  if (g === 'resource_usage') return 'resource_usage';
  return 'task_usage';
}
