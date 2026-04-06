import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { JwtAuthGuard } from '../auth/guards';
import { CommentDto, CreateCommentRequest, UpdateCommentRequest } from '@vineroot/shared-types';

@Controller('api/v1/tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private commentService: CommentService) {}

  @Get()
  async list(
    @Param('taskId') taskId: string,
    @Request() req: any,
  ): Promise<CommentDto[]> {
    return this.commentService.listByTask(taskId, req.user.userId);
  }

  @Post()
  async create(
    @Param('taskId') taskId: string,
    @Request() req: any,
    @Body() createCommentReq: CreateCommentRequest,
  ): Promise<CommentDto> {
    return this.commentService.create(taskId, req.user.userId, createCommentReq);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: UpdateCommentRequest,
  ): Promise<CommentDto> {
    return this.commentService.update(id, req.user.userId, body);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any): Promise<void> {
    return this.commentService.delete(id, req.user.userId);
  }
}
