import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  AutomationService,
  CreateAutomationDto,
  UpdateAutomationDto,
} from './automation.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import { AutomationTriggerType } from '@prisma/client';

@Controller('api/v1/workspaces/:workspaceId/automations')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class AutomationController {
  constructor(private automationService: AutomationService) {}

  @Get()
  async list(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
  ) {
    return await this.automationService.findAll(workspaceId);
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateAutomationDto,
    @Request() req: any,
  ) {
    return await this.automationService.create(workspaceId, dto);
  }

  @Get(':id')
  async getOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return await this.automationService.findOne(id, workspaceId);
  }

  @Patch(':id')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationDto,
    @Request() req: any,
  ) {
    return await this.automationService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return await this.automationService.remove(id, workspaceId);
  }

  @Post(':id/toggle')
  async toggle(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return await this.automationService.toggleActive(id, workspaceId);
  }

  @Post(':id/test')
  async test(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() body: { triggerType: AutomationTriggerType },
    @Request() req: any,
  ) {
    // For testing, create a mock task
    const mockTask = {
      id: 'test-task-id',
      title: 'Test Task',
      status: 'READY',
      workspaceId,
      dueDate: new Date(),
      description: 'Mock task for automation testing',
    };

    const result = await this.automationService.evaluate(
      mockTask.id,
      body.triggerType,
      undefined,
      mockTask,
    );

    return {
      testRun: true,
      trigger: body.triggerType,
      mockTask,
      matchedAutomations: result.matchedAutomations,
    };
  }
}
