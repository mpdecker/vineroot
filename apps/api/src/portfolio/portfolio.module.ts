import { Module } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioResourceController } from './portfolio-resource.controller';
import { PrismaService } from '../common/prisma.service';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [ProjectModule],
  controllers: [PortfolioController, PortfolioResourceController],
  providers: [PortfolioService, PrismaService],
})
export class PortfolioModule {}
