import { BadRequestException } from '@nestjs/common';
import { CustomFieldType, type CustomFieldDefinitionDto } from '@vineroot/shared-types';

function isEmptyPayload(type: CustomFieldType, value: Record<string, unknown>): boolean {
  switch (type) {
    case CustomFieldType.TEXT:
    case CustomFieldType.URL:
    case CustomFieldType.PERSON:
    case CustomFieldType.DATE:
      return String((value as { text?: unknown }).text ?? '').trim() === '';
    case CustomFieldType.NUMBER: {
      const v = (value as { value?: unknown }).value;
      return v === null || v === undefined || v === '' || Number.isNaN(Number(v));
    }
    case CustomFieldType.CHECKBOX:
      return (value as { checked?: unknown }).checked !== true;
    case CustomFieldType.DROPDOWN: {
      const v = (value as { value?: unknown }).value ?? (value as { text?: unknown }).text;
      return v === null || v === undefined || String(v).trim() === '';
    }
    case CustomFieldType.MULTI_SELECT: {
      const arr = (value as { values?: unknown }).values ?? (value as { ids?: unknown }).ids;
      return !Array.isArray(arr) || arr.length === 0;
    }
    default:
      return Object.keys(value).length === 0;
  }
}

function dropdownChoices(field: CustomFieldDefinitionDto): string[] {
  const raw = field.options?.choices;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: unknown) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object' && 'id' in c) return String((c as { id: unknown }).id);
      return '';
    })
    .filter(Boolean);
}

/**
 * Validates JSON payload shape for a workspace field definition.
 * @throws BadRequestException
 */
export function validateCustomFieldPayload(
  field: CustomFieldDefinitionDto,
  value: Record<string, unknown>,
): void {
  if (value == null || typeof value !== 'object') {
    throw new BadRequestException('Custom field value must be a JSON object');
  }

  if (field.isRequired && isEmptyPayload(field.type, value)) {
    throw new BadRequestException(`"${field.name}" is required`);
  }

  if (isEmptyPayload(field.type, value)) {
    return;
  }

  switch (field.type) {
    case CustomFieldType.URL: {
      const t = String((value as { text?: unknown }).text ?? '').trim();
      if (!t) return;
      try {
        const u = new URL(t);
        if (!['http:', 'https:'].includes(u.protocol)) {
          throw new BadRequestException('URL must use http or https');
        }
      } catch {
        throw new BadRequestException('Invalid URL');
      }
      break;
    }
    case CustomFieldType.NUMBER: {
      const v = (value as { value?: unknown }).value;
      if (v !== null && v !== undefined && typeof v !== 'number') {
        throw new BadRequestException('Number field expects a numeric value');
      }
      break;
    }
    case CustomFieldType.DROPDOWN: {
      const choices = dropdownChoices(field);
      if (choices.length === 0) break;
      const picked =
        (value as { value?: unknown }).value ?? (value as { text?: unknown }).text ?? '';
      const s = String(picked);
      if (!choices.includes(s)) {
        throw new BadRequestException('Invalid option for this dropdown field');
      }
      break;
    }
    case CustomFieldType.MULTI_SELECT: {
      const choices = new Set(dropdownChoices(field));
      if (choices.size === 0) break;
      const arr = ((value as { values?: unknown }).values ??
        (value as { ids?: unknown }).ids) as unknown;
      if (!Array.isArray(arr)) {
        throw new BadRequestException('Multi-select value must be an array');
      }
      for (const x of arr) {
        if (!choices.has(String(x))) {
          throw new BadRequestException('Invalid option for this multi-select field');
        }
      }
      break;
    }
    default:
      break;
  }
}

/** True if stored DB JSON is considered "empty" for required-field checks. */
export function isCustomFieldValueEmpty(
  type: CustomFieldType,
  value: Record<string, unknown> | null | undefined,
): boolean {
  if (!value || typeof value !== 'object') return true;
  return isEmptyPayload(type, value);
}
