import {
  BadRequestException,
  Controller,
  NotFoundException,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { TaskService } from './task.service';
import { AttachmentService } from '../attachment/attachment.service';
import { JwtAuthGuard } from '../auth/guards';
import {
  TaskDto,
  CreateTaskRequest,
  UpdateTaskRequest,
  ReorderTasksRequest,
  AddTaskDependencyRequest,
  UpdateTaskDependencyScheduleRequest,
  CreateTaskAttachmentRequest,
  DuplicateTaskRequest,
  AddTaskGenericResourceAssignmentRequest,
  PatchTaskGenericResourceAssignmentRequest,
  AddTaskAssigneeRequest,
  PatchTaskAssigneeRequest,
  CreateTaskCostEntryRequest,
  TaskCostEntryDto,
  UpdateTaskCostEntryRequest,
} from '@vineroot/shared-types';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(
    private taskService: TaskService,
    private attachmentService: AttachmentService,
  ) {}

  @Get('projects/:projectId/tasks')
  async list(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
  ): Promise<TaskDto[]> {
    return this.taskService.listByProject(projectId, { status, assigneeId });
  }

  @Get('projects/:projectId/tasks/:taskId/cost-entries')
  async listCostEntries(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Request() req: any,
  ): Promise<TaskCostEntryDto[]> {
    return this.taskService.listTaskCostEntries(
      projectId,
      taskId,
      req.user.userId,
    );
  }

  @Post('projects/:projectId/tasks/:taskId/cost-entries')
  async createCostEntry(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Request() req: any,
    @Body() body: CreateTaskCostEntryRequest,
  ): Promise<TaskCostEntryDto> {
    return this.taskService.createTaskCostEntry(
      projectId,
      taskId,
      req.user.userId,
      body,
    );
  }

  @Patch('projects/:projectId/tasks/:taskId/cost-entries/:entryId')
  async patchCostEntry(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('entryId') entryId: string,
    @Request() req: any,
    @Body() body: UpdateTaskCostEntryRequest,
  ): Promise<TaskCostEntryDto> {
    return this.taskService.patchTaskCostEntry(
      projectId,
      taskId,
      entryId,
      req.user.userId,
      body,
    );
  }

  @Delete('projects/:projectId/tasks/:taskId/cost-entries/:entryId')
  async deleteCostEntry(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('entryId') entryId: string,
    @Request() req: any,
  ): Promise<void> {
    return this.taskService.deleteTaskCostEntry(
      projectId,
      taskId,
      entryId,
      req.user.userId,
    );
  }

  @Get('tasks/mine')
  async listMine(@Request() req: any): Promise<TaskDto[]> {
    return this.taskService.listMyTasks(req.user.userId);
  }

  @Post('tasks')
  async createTask(
    @Request() req: any,
    @Body() body: CreateTaskRequest,
  ): Promise<TaskDto> {
    return this.taskService.createWithOptionalProject(
      req.user.userId,
      req.user.workspaceId,
      body,
    );
  }

  @Post('projects/:projectId/tasks')
  async create(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Body() createTaskReq: CreateTaskRequest,
  ): Promise<TaskDto> {
    return this.taskService.create(projectId, req.user.userId, createTaskReq);
  }

  @Get('tasks/:id')
  async findOne(@Param('id') id: string): Promise<TaskDto | null> {
    return this.taskService.findById(id);
  }

  /** Must be registered before `tasks/:id` or PATCH …/tasks/reorder is handled as update(id=reorder). */
  @Patch('tasks/reorder')
  async reorder(@Body() req: ReorderTasksRequest): Promise<void> {
    return this.taskService.reorderTasks(req);
  }

  @Patch('tasks/:id')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: UpdateTaskRequest,
  ): Promise<TaskDto> {
    return this.taskService.update(id, req.user.userId, body);
  }

  @Post('tasks/:id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: DuplicateTaskRequest,
  ): Promise<TaskDto> {
    return this.taskService.duplicateTask(req.user.userId, id, body ?? {});
  }

  @Delete('tasks/:id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.taskService.delete(id);
  }

  @Post('tasks/:id/assignees')
  async addAssignee(
    @Param('id') taskId: string,
    @Request() req: any,
    @Body() body: AddTaskAssigneeRequest,
  ): Promise<TaskDto> {
    return this.taskService.addAssignee(taskId, req.user.userId, body);
  }

  @Patch('tasks/:id/assignees/:userId')
  patchAssignee(
    @Param('id') taskId: string,
    @Param('userId') userId: string,
    @Request() req: any,
    @Body() body: PatchTaskAssigneeRequest,
  ): Promise<TaskDto> {
    return this.taskService.patchAssignee(taskId, req.user.userId, userId, body);
  }

  @Delete('tasks/:id/assignees/:userId')
  async removeAssignee(
    @Param('id') taskId: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ): Promise<TaskDto> {
    return this.taskService.removeAssignee(taskId, req.user.userId, userId);
  }

  @Post('tasks/:id/generic-resource-assignments')
  addGenericResourceAssignment(
    @Param('id') taskId: string,
    @Request() req: any,
    @Body() body: AddTaskGenericResourceAssignmentRequest,
  ): Promise<TaskDto> {
    return this.taskService.addGenericResourceAssignment(
      taskId,
      req.user.userId,
      body,
    );
  }

  @Patch('tasks/:id/generic-resource-assignments/:genericResourceId')
  patchGenericResourceAssignment(
    @Param('id') taskId: string,
    @Param('genericResourceId') genericResourceId: string,
    @Request() req: any,
    @Body() body: PatchTaskGenericResourceAssignmentRequest,
  ): Promise<TaskDto> {
    return this.taskService.patchGenericResourceAssignment(
      taskId,
      req.user.userId,
      genericResourceId,
      body,
    );
  }

  @Delete('tasks/:id/generic-resource-assignments/:genericResourceId')
  removeGenericResourceAssignment(
    @Param('id') taskId: string,
    @Param('genericResourceId') genericResourceId: string,
    @Request() req: any,
  ): Promise<TaskDto> {
    return this.taskService.removeGenericResourceAssignment(
      taskId,
      req.user.userId,
      genericResourceId,
    );
  }

  @Post('tasks/:id/dependencies')
  async addDependency(
    @Param('id') taskId: string,
    @Request() req: any,
    @Body() body: AddTaskDependencyRequest,
  ): Promise<TaskDto> {
    return this.taskService.addDependency(req.user.userId, taskId, body);
  }

  @Patch('tasks/:id/dependencies/:blockingTaskId')
  async updateDependencyLag(
    @Param('id') taskId: string,
    @Param('blockingTaskId') blockingTaskId: string,
    @Request() req: any,
    @Body() body: UpdateTaskDependencyScheduleRequest,
  ): Promise<TaskDto> {
    return this.taskService.updateDependencyLag(req.user.userId, taskId, blockingTaskId, body);
  }

  @Delete('tasks/:id/dependencies/:blockingTaskId')
  async removeDependency(
    @Param('id') taskId: string,
    @Param('blockingTaskId') blockingTaskId: string,
    @Request() req: any,
  ): Promise<TaskDto> {
    return this.taskService.removeDependency(req.user.userId, taskId, blockingTaskId);
  }

  @Post('tasks/:id/attachments/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadAttachment(
    @Param('id') taskId: string,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<TaskDto> {
    if (!file) {
      throw new BadRequestException('Missing file');
    }
    await this.attachmentService.saveUploadedFile(taskId, req.user.userId, file);
    const dto = await this.taskService.findById(taskId);
    if (!dto) {
      throw new NotFoundException('Task not found');
    }
    await this.taskService.broadcastTaskUpdated(dto);
    return dto;
  }

  @Post('tasks/:id/attachments')
  async addAttachment(
    @Param('id') taskId: string,
    @Request() req: any,
    @Body() body: CreateTaskAttachmentRequest,
  ): Promise<TaskDto> {
    return this.taskService.addAttachment(req.user.userId, taskId, body);
  }

  @Delete('tasks/:id/attachments/:attachmentId')
  async deleteAttachment(
    @Param('id') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: any,
  ): Promise<TaskDto> {
    return this.taskService.deleteAttachment(req.user.userId, taskId, attachmentId);
  }
}
