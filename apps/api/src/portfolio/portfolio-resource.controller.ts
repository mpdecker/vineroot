import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/guards';
import { PortfolioDto } from '@vineroot/shared-types';

/**
 * Resolve a portfolio by id using JWT + workspace membership (no workspace id in URL).
 */
@Controller('api/v1/portfolios')
@UseGuards(JwtAuthGuard)
export class PortfolioResourceController {
  constructor(private portfolioService: PortfolioService) {}

  @Get(':id')
  async findOne(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ): Promise<PortfolioDto | null> {
    return this.portfolioService.findByIdForUser(id, req.user.userId);
  }
}
