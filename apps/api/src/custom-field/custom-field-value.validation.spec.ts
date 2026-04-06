import { BadRequestException } from '@nestjs/common';
import { CustomFieldType } from '@vineroot/shared-types';
import {
  validateCustomFieldPayload,
  isCustomFieldValueEmpty,
} from './custom-field-value.validation';

describe('custom-field-value.validation', () => {
  const textField = (overrides: Partial<{ name: string; isRequired: boolean }> = {}) => ({
    id: 'f1',
    name: 'Note',
    type: CustomFieldType.TEXT,
    isRequired: false,
    ...overrides,
  });

  it('validateCustomFieldPayload rejects non-object', () => {
    expect(() =>
      validateCustomFieldPayload(textField() as any, null as any),
    ).toThrow(BadRequestException);
  });

  it('throws when required text empty', () => {
    expect(() =>
      validateCustomFieldPayload(textField({ isRequired: true }) as any, { text: '  ' }),
    ).toThrow(/required/);
  });

  it('allows empty optional field', () => {
    expect(() =>
      validateCustomFieldPayload(textField() as any, { text: '' }),
    ).not.toThrow();
  });

  it('URL field rejects non-http protocols', () => {
    const f = { ...textField(), type: CustomFieldType.URL, name: 'Link' };
    expect(() =>
      validateCustomFieldPayload(f as any, { text: 'ftp://x.com' }),
    ).toThrow(/URL must use http|Invalid URL/);
  });

  it('isCustomFieldValueEmpty true for null', () => {
    expect(isCustomFieldValueEmpty(CustomFieldType.TEXT, null)).toBe(true);
  });
});
