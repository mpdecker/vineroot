import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CustomFieldService } from './custom-field.service';
import { JwtAuthGuard } from '../auth/guards';
import {
  CustomFieldDefinitionDto,
  CreateCustomFieldRequest,
  SetCustomFieldValueRequest,
  CustomFieldValueDto,
  UpdateCustomFieldRequest,
} from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/custom-fields')
@UseGuards(JwtAuthGuard)
export class CustomFieldController {
  constructor(private customFieldService: CustomFieldService) {}

  @Get()
  async list(
    @Param('workspaceId') workspaceId: string,
  ): Promise<CustomFieldDefinitionDto[]> {
    return this.customFieldService.listByWorkspace(workspaceId);
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() req: CreateCustomFieldRequest,
  ): Promise<CustomFieldDefinitionDto> {
    return this.customFieldService.createDefinition(workspaceId, req);
  }

  @Patch(':fieldId')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('fieldId') fieldId: string,
    @Body() req: UpdateCustomFieldRequest,
  ): Promise<CustomFieldDefinitionDto> {
    return this.customFieldService.updateDefinition(workspaceId, fieldId, req);
  }

  @Put('tasks/:taskId/fields/:fieldId')
  async setValue(
    @Param('taskId') taskId: string,
    @Param('fieldId') fieldId: string,
    @Body() body: SetCustomFieldValueRequest,
    @Request() req: { user: { userId: string } },
  ): Promise<CustomFieldValueDto> {
    return this.customFieldService.setValue(taskId, fieldId, body, req.user.userId);
  }
}
