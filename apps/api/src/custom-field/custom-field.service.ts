import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditEventType,
  CustomFieldComputedKind,
  CustomFieldType as PrismaCustomFieldType,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { TaskActivityLogService } from '../activity-log/task-activity-log.service';
import {
  CustomFieldDefinitionDto,
  CreateCustomFieldRequest,
  SetCustomFieldValueRequest,
  CustomFieldValueDto,
  UpdateCustomFieldRequest,
  CustomFieldType,
} from '@vineroot/shared-types';
import { validateCustomFieldPayload } from './custom-field-value.validation';

@Injectable()
export class CustomFieldService {
  constructor(
    private prisma: PrismaService,
    private taskActivityLog: TaskActivityLogService,
  ) {}

  async createDefinition(
    workspaceId: string,
    req: CreateCustomFieldRequest,
  ): Promise<CustomFieldDefinitionDto> {
    const computedKind =
      (req.computedKind as CustomFieldComputedKind | undefined) ??
      CustomFieldComputedKind.NONE;

    if (computedKind === CustomFieldComputedKind.SUBTASK_ROLLUP_NUMBER) {
      if (req.type !== CustomFieldType.NUMBER) {
        throw new BadRequestException(
          'Subtask rollup custom fields must use type NUMBER',
        );
      }
      if (!req.rollupSourceFieldId?.trim() || !req.rollupAggregation) {
        throw new BadRequestException(
          'rollupSourceFieldId and rollupAggregation are required for subtask rollup fields',
        );
      }
      if (req.isRequired) {
        throw new BadRequestException('Computed custom fields cannot be required');
      }
      const src = await this.prisma.customFieldDefinition.findUnique({
        where: { id: req.rollupSourceFieldId.trim() },
      });
      if (!src || src.workspaceId !== workspaceId) {
        throw new BadRequestException(
          'rollupSourceFieldId must reference a NUMBER field in the same workspace',
        );
      }
      if (src.type !== PrismaCustomFieldType.NUMBER) {
        throw new BadRequestException(
          'Rollup source field must be a NUMBER custom field',
        );
      }
      if (src.computedKind !== CustomFieldComputedKind.NONE) {
        throw new BadRequestException(
          'Rollup source cannot be another computed field',
        );
      }
    } else if (req.rollupSourceFieldId || req.rollupAggregation) {
      throw new BadRequestException(
        'rollupSourceFieldId and rollupAggregation are only valid when computedKind is SUBTASK_ROLLUP_NUMBER',
      );
    }

    const field = await this.prisma.customFieldDefinition.create({
      data: {
        workspaceId,
        name: req.name,
        type: req.type,
        options: req.options,
        isRequired: req.isRequired || false,
        description: req.description?.trim() || null,
        ...(req.defaultValue !== undefined ? { defaultValue: req.defaultValue } : {}),
        computedKind,
        rollupSourceFieldId:
          computedKind === CustomFieldComputedKind.SUBTASK_ROLLUP_NUMBER
            ? req.rollupSourceFieldId!.trim()
            : null,
        rollupAggregation:
          computedKind === CustomFieldComputedKind.SUBTASK_ROLLUP_NUMBER
            ? req.rollupAggregation!
            : null,
      },
    });
    return this.fieldToDto(field);
  }

  async updateDefinition(
    workspaceId: string,
    fieldId: string,
    req: UpdateCustomFieldRequest,
  ): Promise<CustomFieldDefinitionDto> {
    const existing = await this.prisma.customFieldDefinition.findFirst({
      where: { id: fieldId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Custom field not found');
    }
    const data: Record<string, unknown> = {};
    if (req.name !== undefined) {
      const n = req.name.trim();
      if (!n) throw new BadRequestException('name cannot be empty');
      data.name = n;
    }
    if (req.options !== undefined) data.options = req.options;
    if (req.isRequired !== undefined) {
      if (req.isRequired && existing.computedKind !== CustomFieldComputedKind.NONE) {
        throw new BadRequestException('Computed custom fields cannot be required');
      }
      data.isRequired = req.isRequired;
    }
    if (req.description !== undefined) {
      data.description =
        req.description === null || req.description === ''
          ? null
          : req.description.trim();
    }
    if (req.defaultValue !== undefined) {
      data.defaultValue = req.defaultValue;
    }
    if (Object.keys(data).length === 0) {
      return this.fieldToDto(existing);
    }
    const field = await this.prisma.customFieldDefinition.update({
      where: { id: fieldId },
      data: data as any,
    });
    return this.fieldToDto(field);
  }

  async listByWorkspace(workspaceId: string): Promise<CustomFieldDefinitionDto[]> {
    const fields = await this.prisma.customFieldDefinition.findMany({
      where: { workspaceId },
    });
    return fields.map((f) => this.fieldToDto(f));
  }

  async setValue(
    taskId: string,
    fieldId: string,
    req: SetCustomFieldValueRequest,
    actorId: string,
  ): Promise<CustomFieldValueDto> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true, workspaceId: true, deletedAt: true, title: true },
    });
    if (!task || task.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    const field = await this.prisma.customFieldDefinition.findUnique({
      where: { id: fieldId },
    });
    if (!field) {
      throw new NotFoundException('Custom field not found');
    }

    const fieldDto = this.fieldToDto(field);

    if (field.computedKind !== CustomFieldComputedKind.NONE) {
      throw new BadRequestException('This field is computed and cannot be edited');
    }

    if (task.projectId) {
      const link = await this.prisma.projectCustomField.findUnique({
        where: { projectId_fieldId: { projectId: task.projectId, fieldId } },
      });
      if (!link) {
        throw new BadRequestException('This field is not enabled on the task project');
      }
    } else if (task.workspaceId) {
      if (field.workspaceId !== task.workspaceId) {
        throw new BadRequestException('Custom field does not belong to this task workspace');
      }
    } else {
      throw new BadRequestException('Task has no workspace context for custom fields');
    }

    validateCustomFieldPayload(fieldDto, req.value);

    const value = await this.prisma.customFieldValue.upsert({
      where: { taskId_fieldId: { taskId, fieldId } },
      create: { taskId, fieldId, value: req.value },
      update: { value: req.value },
      include: { field: true },
    });
    await this.taskActivityLog.log({
      actorId,
      taskId,
      projectId: task.projectId,
      eventType: AuditEventType.TASK_UPDATED,
      description: `Custom field "${value.field?.name ?? fieldId}" updated`,
      newValue: { fieldId, value: req.value },
    });
    return {
      id: value.id,
      taskId: value.taskId,
      fieldId: value.fieldId,
      value: value.value as Record<string, any>,
      field: value.field ? this.fieldToDto(value.field) : undefined,
    };
  }

  private fieldToDto(field: any): CustomFieldDefinitionDto {
    const computedKind =
      field.computedKind ?? CustomFieldComputedKind.NONE;
    return {
      id: field.id,
      workspaceId: field.workspaceId,
      name: field.name,
      type: field.type,
      options: field.options,
      isRequired: field.isRequired,
      description: field.description ?? undefined,
      defaultValue: field.defaultValue ?? undefined,
      computedKind,
      rollupSourceFieldId: field.rollupSourceFieldId ?? undefined,
      rollupAggregation: field.rollupAggregation ?? undefined,
      isComputed: computedKind !== CustomFieldComputedKind.NONE,
      createdAt: field.createdAt,
    };
  }
}
