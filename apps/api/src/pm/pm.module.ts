import { Module } from '@nestjs/common';
import { PmController } from './pm.controller';
import { PmService } from './pm.service';
import { PmOrchestratorGuard } from './pm-orchestrator.guard';
import { PmCrewService } from './pm-crew.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [PmController],
  providers: [PmService, PmOrchestratorGuard, PmCrewService, PrismaService],
  exports: [PmService, PmCrewService],
})
export class PmModule {}
