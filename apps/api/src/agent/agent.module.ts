import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { PrismaService } from '../common/prisma.service';
import { EventsGateway } from '../common/events.gateway';

@Module({
  controllers: [AgentController],
  providers: [AgentService, PrismaService, EventsGateway],
  exports: [AgentService],
})
export class AgentModule {}
