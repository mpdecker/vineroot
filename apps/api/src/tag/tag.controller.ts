import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TagService } from './tag.service';
import { JwtAuthGuard } from '../auth/guards';
import { TagDto, CreateTagRequest } from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/tags')
@UseGuards(JwtAuthGuard)
export class TagController {
  constructor(private tagService: TagService) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string): Promise<TagDto[]> {
    return this.tagService.listByWorkspace(workspaceId);
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() req: CreateTagRequest,
  ): Promise<TagDto> {
    return this.tagService.create(workspaceId, req);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.tagService.delete(id);
  }

  @Post('tasks/:taskId/tags/:tagId')
  async attachTag(
    @Param('taskId') taskId: string,
    @Param('tagId') tagId: string,
  ): Promise<void> {
    return this.tagService.attachTagToTask(taskId, tagId);
  }

  @Delete('tasks/:taskId/tags/:tagId')
  async detachTag(
    @Param('taskId') taskId: string,
    @Param('tagId') tagId: string,
  ): Promise<void> {
    return this.tagService.detachTagFromTask(taskId, tagId);
  }
}
