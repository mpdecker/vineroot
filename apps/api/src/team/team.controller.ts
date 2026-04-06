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
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../auth/guards';
import { TeamDto, CreateTeamRequest, UpdateTeamRequest } from '@vineroot/shared-types';

@Controller('api/v1/workspaces/:workspaceId/teams')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private teamService: TeamService) {}

  @Get()
  async list(@Param('workspaceId') workspaceId: string): Promise<TeamDto[]> {
    return this.teamService.listByWorkspace(workspaceId);
  }

  @Post()
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() req: CreateTeamRequest,
  ): Promise<TeamDto> {
    return this.teamService.create(workspaceId, req);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<TeamDto | null> {
    return this.teamService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() req: UpdateTeamRequest,
  ): Promise<TeamDto> {
    return this.teamService.update(id, req);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return this.teamService.delete(id);
  }
}
