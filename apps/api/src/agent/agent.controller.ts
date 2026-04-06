import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  AgentService,
  CreateAgentTokenDto,
  ClaimTaskDto,
  CompleteTaskDto,
  FailTaskDto,
} from './agent.service';
import { JwtAuthGuard } from '../auth/guards';
import { AgentTokenGuard } from './agent-token.guard';

@Controller('api/v1')
export class AgentController {
  constructor(private agentService: AgentService) {}

  // Token Management Routes (JwtAuthGuard)
  @Get('workspaces/:workspaceId/agent/tokens')
  @UseGuards(JwtAuthGuard)
  async listTokens(
    @Param('workspaceId') workspaceId: string,
    @Request() req: any,
  ) {
    return await this.agentService.listTokens(workspaceId);
  }

  @Post('workspaces/:workspaceId/agent/tokens')
  @UseGuards(JwtAuthGuard)
  async createToken(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateAgentTokenDto,
    @Request() req: any,
  ) {
    return await this.agentService.createToken(workspaceId, req.user.userId, dto);
  }

  @Delete('workspaces/:workspaceId/agent/tokens/:id')
  @UseGuards(JwtAuthGuard)
  async revokeToken(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return await this.agentService.revokeToken(id, workspaceId);
  }

  // Agent Task Routes (AgentTokenGuard)
  @Get('agent/tasks')
  @UseGuards(AgentTokenGuard)
  async getReadyTasks(@Request() req: any) {
    return await this.agentService.getReadyTasks(
      req.agentToken.actorTier,
      req.agentToken.workspaceId,
    );
  }

  @Post('agent/tasks/:id/claim')
  @UseGuards(AgentTokenGuard)
  async claimTask(@Param('id') id: string, @Request() req: any) {
    return await this.agentService.claimTask(id, req.agentToken);
  }

  @Post('agent/tasks/:id/complete')
  @UseGuards(AgentTokenGuard)
  async completeTask(
    @Param('id') id: string,
    @Body() dto: CompleteTaskDto,
    @Request() req: any,
  ) {
    return await this.agentService.completeTask(id, req.agentToken, dto);
  }

  @Post('agent/tasks/:id/fail')
  @UseGuards(AgentTokenGuard)
  async failTask(
    @Param('id') id: string,
    @Body() dto: FailTaskDto,
    @Request() req: any,
  ) {
    return await this.agentService.failTask(id, req.agentToken, dto);
  }
}
