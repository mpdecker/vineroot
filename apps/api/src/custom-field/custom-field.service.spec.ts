import { Test } from '@nestjs/testing';
import { AuditEventType, CustomFieldComputedKind } from '@prisma/client';
import { CustomFieldService } from './custom-field.service';
import { PrismaService } from '../common/prisma.service';
import { TaskActivityLogService } from '../activity-log/task-activity-log.service';
import { CustomFieldType } from '@vineroot/shared-types';

describe('CustomFieldService', () => {
  let service: CustomFieldService;
  const prisma = {
    customFieldDefinition: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    customFieldValue: {
      upsert: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
    },
    projectCustomField: {
      findUnique: jest.fn(),
    },
  };
  const taskActivityLog = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomFieldService,
        { provide: PrismaService, useValue: prisma },
        { provide: TaskActivityLogService, useValue: taskActivityLog },
      ],
    }).compile();
    service = moduleRef.get(CustomFieldService);
  });

  it('setValue upserts and logs activity with field name', async () => {
    const now = new Date();
    prisma.task.findUnique.mockResolvedValue({
      id: 't1',
      projectId: 'p1',
      workspaceId: 'ws-1',
      deletedAt: null,
      title: 'Task',
    });
    prisma.customFieldDefinition.findUnique.mockResolvedValue({
      id: 'f1',
      workspaceId: 'ws-1',
      name: 'Priority label',
      type: CustomFieldType.TEXT,
      options: null,
      isRequired: false,
      computedKind: CustomFieldComputedKind.NONE,
      createdAt: now,
    });
    prisma.projectCustomField.findUnique.mockResolvedValue({
      projectId: 'p1',
      fieldId: 'f1',
    });
    prisma.customFieldValue.upsert.mockResolvedValue({
      id: 'cv-1',
      taskId: 't1',
      fieldId: 'f1',
      value: { text: 'x' },
      field: {
        id: 'f1',
        workspaceId: 'ws-1',
        name: 'Priority label',
        type: CustomFieldType.TEXT,
        options: null,
        isRequired: false,
        computedKind: CustomFieldComputedKind.NONE,
        createdAt: now,
      },
    });

    const dto = await service.setValue('t1', 'f1', { value: { text: 'x' } }, 'user-1');

    expect(prisma.customFieldValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId_fieldId: { taskId: 't1', fieldId: 'f1' } },
        create: { taskId: 't1', fieldId: 'f1', value: { text: 'x' } },
        update: { value: { text: 'x' } },
        include: { field: true },
      }),
    );
    expect(taskActivityLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-1',
        taskId: 't1',
        projectId: 'p1',
        eventType: AuditEventType.TASK_UPDATED,
        description: 'Custom field "Priority label" updated',
        newValue: { fieldId: 'f1', value: { text: 'x' } },
      }),
    );
    expect(dto.field?.name).toBe('Priority label');
    expect(dto.value).toEqual({ text: 'x' });
  });

  it('setValue rejects when field is not linked to the task project', async () => {
    const now = new Date();
    prisma.task.findUnique.mockResolvedValue({
      id: 't1',
      projectId: 'p1',
      workspaceId: 'ws-1',
      deletedAt: null,
      title: 'Task',
    });
    prisma.customFieldDefinition.findUnique.mockResolvedValue({
      id: 'f9',
      workspaceId: 'ws-1',
      name: 'Orphan',
      type: CustomFieldType.TEXT,
      options: null,
      isRequired: false,
      computedKind: CustomFieldComputedKind.NONE,
      createdAt: now,
    });
    prisma.projectCustomField.findUnique.mockResolvedValue(null);

    await expect(
      service.setValue('t1', 'f9', { value: { text: 'x' } }, 'user-1'),
    ).rejects.toThrow(/not enabled on the task project/);

    expect(prisma.customFieldValue.upsert).not.toHaveBeenCalled();
  });

  it('setValue rejects computed (rollup) fields', async () => {
    const now = new Date();
    prisma.task.findUnique.mockResolvedValue({
      id: 't1',
      projectId: 'p1',
      workspaceId: 'ws-1',
      deletedAt: null,
      title: 'Task',
    });
    prisma.customFieldDefinition.findUnique.mockResolvedValue({
      id: 'f-roll',
      workspaceId: 'ws-1',
      name: 'Total',
      type: CustomFieldType.NUMBER,
      options: null,
      isRequired: false,
      computedKind: CustomFieldComputedKind.SUBTASK_ROLLUP_NUMBER,
      createdAt: now,
    });

    await expect(
      service.setValue('t1', 'f-roll', { value: { value: 1 } }, 'user-1'),
    ).rejects.toThrow(/computed/);

    expect(prisma.customFieldValue.upsert).not.toHaveBeenCalled();
  });
});
