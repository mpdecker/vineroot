import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SectionService } from './section.service';
import { JwtAuthGuard } from '../auth/guards';
import { SectionDto, CreateSectionRequest, UpdateSectionRequest } from '@vineroot/shared-types';

@Controller('api/v1/projects/:projectId/sections')
@UseGuards(JwtAuthGuard)
export class SectionController {
  constructor(private sectionService: SectionService) {}

  @Get()
  async list(@Param('projectId') projectId: string): Promise<SectionDto[]> {
    return this.sectionService.listByProject(projectId);
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() req: CreateSectionRequest,
  ): Promise<SectionDto> {
    return this.sectionService.create(projectId, req);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() req: UpdateSectionRequest,
  ): Promise<SectionDto> {
    return this.sectionService.update(id, req);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.sectionService.delete(id);
  }
}
