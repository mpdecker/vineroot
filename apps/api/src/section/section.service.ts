import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SectionDto, CreateSectionRequest, UpdateSectionRequest } from '@vineroot/shared-types';

@Injectable()
export class SectionService {
  constructor(private prisma: PrismaService) {}

  async create(projectId: string, req: CreateSectionRequest): Promise<SectionDto> {
    if (req.wipLimit != null) {
      if (!Number.isInteger(req.wipLimit) || req.wipLimit < 1) {
        throw new BadRequestException('wipLimit must be a positive integer or null');
      }
    }
    const agg = await this.prisma.section.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const nextOrder = (agg._max.sortOrder ?? -1) + 1;

    const section = await this.prisma.section.create({
      data: {
        projectId,
        name: req.name,
        color: req.color,
        sortOrder: nextOrder,
        wipLimit: req.wipLimit ?? undefined,
      },
    });
    return this.sectionToDto(section);
  }

  async listByProject(projectId: string): Promise<SectionDto[]> {
    const sections = await this.prisma.section.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    });
    return sections.map((s) => this.sectionToDto(s));
  }

  async update(id: string, req: UpdateSectionRequest): Promise<SectionDto> {
    if (req.wipLimit != null) {
      if (!Number.isInteger(req.wipLimit) || req.wipLimit < 1) {
        throw new BadRequestException('wipLimit must be a positive integer or null');
      }
    }
    const data: Record<string, unknown> = {};
    if (req.name !== undefined) data.name = req.name;
    if (req.color !== undefined) data.color = req.color;
    if (req.wipLimit !== undefined) data.wipLimit = req.wipLimit;
    const section = await this.prisma.section.update({
      where: { id },
      data: data as any,
    });
    return this.sectionToDto(section);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.section.delete({ where: { id } });
  }

  private sectionToDto(section: any): SectionDto {
    return {
      id: section.id,
      projectId: section.projectId,
      name: section.name,
      color: section.color,
      sortOrder: section.sortOrder,
      wipLimit: section.wipLimit ?? null,
      isDefault: section.isDefault,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }
}
