import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEventType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { TaskActivityLogService } from '../activity-log/task-activity-log.service';
import {
  CustomFieldDefinitionDto,
  CreateCustomFieldRequest,
  SetCustomFieldValueRequest,
  CustomFieldValueDto,
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
    const field = await this.prisma.customFieldDefinition.create({
      data: {
        workspaceId,
        name: req.name,
        type: req.type,
        options: req.options,
        isRequired: req.isRequired || false,
      },
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
    return {
      id: field.id,
      workspaceId: field.workspaceId,
      name: field.name,
      type: field.type,
      options: field.options,
      isRequired: field.isRequired,
      createdAt: field.createdAt,
    };
  }
}
