/** Normalize stored custom-field JSON for display in task detail inputs. */
export function fieldValueToDisplay(value: Record<string, unknown> | undefined): string {
  if (value == null) return '';
  if (typeof value.text === 'string') return value.text;
  if (value.value === null || value.value === undefined) return '';
  if (typeof value.value === 'string' || typeof value.value === 'number') return String(value.value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
