import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TagDto, CreateTagRequest } from '@vineroot/shared-types';

@Injectable()
export class TagService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, req: CreateTagRequest): Promise<TagDto> {
    const tag = await this.prisma.tag.create({
      data: {
        workspaceId,
        name: req.name,
        color: req.color || '#6B7280',
      },
    });
    return { id: tag.id, workspaceId: tag.workspaceId, name: tag.name, color: tag.color, createdAt: tag.createdAt };
  }

  async listByWorkspace(workspaceId: string): Promise<TagDto[]> {
    const tags = await this.prisma.tag.findMany({
      where: { workspaceId },
    });
    return tags.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      name: t.name,
      color: t.color,
      createdAt: t.createdAt,
    }));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tag.delete({ where: { id } });
  }

  async attachTagToTask(taskId: string, tagId: string): Promise<void> {
    await this.prisma.taskTag.create({
      data: { taskId, tagId },
    });
  }

  async detachTagFromTask(taskId: string, tagId: string): Promise<void> {
    await this.prisma.taskTag.delete({
      where: { taskId_tagId: { taskId, tagId } },
    });
  }
}
