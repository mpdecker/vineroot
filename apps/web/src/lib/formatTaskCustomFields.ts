import type { CustomFieldValue } from '../types';
import { fieldValueToDisplay } from './taskDetailFieldValue';

const MAX_VALUE_LEN = 26;

/** Short labels for list/board cards (non-empty values only). */
export function summarizeCustomFieldsForList(
  customFields: CustomFieldValue[] | undefined,
  max = 3,
): { key: string; line: string }[] {
  if (!customFields?.length) return [];
  const out: { key: string; line: string }[] = [];
  for (const v of customFields) {
    if (!v.field) continue;
    const raw = fieldValueToDisplay(v.value).trim();
    if (!raw) continue;
    const clipped = raw.length > MAX_VALUE_LEN ? `${raw.slice(0, MAX_VALUE_LEN)}…` : raw;
    out.push({ key: v.fieldId, line: `${v.field.name}: ${clipped}` });
    if (out.length >= max) break;
  }
  return out;
}
