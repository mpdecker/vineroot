import { describe, it, expect } from 'vitest';
import type { CustomFieldValue } from '../types';
import { summarizeCustomFieldsForList } from './formatTaskCustomFields';

describe('summarizeCustomFieldsForList', () => {
  it('returns lines for fields with values', () => {
    const cfs: CustomFieldValue[] = [
      {
        id: '1',
        taskId: 't',
        fieldId: 'f1',
        value: { text: 'hello' },
        field: { id: 'f1', workspaceId: 'w', name: 'Region', type: 'TEXT', isRequired: false, createdAt: '' },
      },
    ];
    expect(summarizeCustomFieldsForList(cfs)).toEqual([{ key: 'f1', line: 'Region: hello' }]);
  });

  it('skips empty values and respects max', () => {
    const cfs: CustomFieldValue[] = [
      {
        id: '1',
        taskId: 't',
        fieldId: 'f1',
        value: { text: '' },
        field: { id: 'f1', workspaceId: 'w', name: 'A', type: 'TEXT', isRequired: false, createdAt: '' },
      },
      {
        id: '2',
        taskId: 't',
        fieldId: 'f2',
        value: { value: 42 },
        field: { id: 'f2', workspaceId: 'w', name: 'B', type: 'NUMBER', isRequired: false, createdAt: '' },
      },
    ];
    expect(summarizeCustomFieldsForList(cfs, 1)).toEqual([{ key: 'f2', line: 'B: 42' }]);
  });
});
