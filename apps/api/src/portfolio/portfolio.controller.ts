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
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';
import {
  PortfolioDto,
  CreatePortfolioRequest,
  UpdatePortfolioRequest,
  AddPortfolioItemRequest,
} from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/portfolios')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class PortfolioController {
  constructor(private portfolioService: PortfolioService) {}

  @Get()
  async list(
    @Param('workspaceId') workspaceId: string,
  ): Promise<PortfolioDto[]> {
    return this.portfolioService.listByWorkspace(workspaceId);
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() req: CreatePortfolioRequest,
  ): Promise<PortfolioDto> {
    return this.portfolioService.create(workspaceId, req);
  }

  @Get(':id')
  async findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ): Promise<PortfolioDto | null> {
    return this.portfolioService.findByIdInWorkspace(workspaceId, id);
  }

  @Patch(':id')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() req: UpdatePortfolioRequest,
  ): Promise<PortfolioDto> {
    return this.portfolioService.update(workspaceId, id, req);
  }

  @Delete(':id')
  async remove(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.portfolioService.deleteInWorkspace(workspaceId, id);
  }

  @Post(':id/items')
  async addItem(
    @Param('workspaceId') workspaceId: string,
    @Param('id') portfolioId: string,
    @Body() req: AddPortfolioItemRequest,
  ): Promise<PortfolioDto> {
    return this.portfolioService.addItem(workspaceId, portfolioId, req);
  }

  @Delete(':id/items/:projectId')
  async removeItem(
    @Param('workspaceId') workspaceId: string,
    @Param('id') portfolioId: string,
    @Param('projectId') projectId: string,
  ): Promise<void> {
    return this.portfolioService.removeItem(
      workspaceId,
      portfolioId,
      projectId,
    );
  }
}
