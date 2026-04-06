import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { PortfolioResourceController } from './portfolio-resource.controller';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/guards';

describe('PortfolioResourceController (HTTP integration)', () => {
  let app: INestApplication;

  const portfolioService = {
    findByIdForUser: jest.fn(),
  };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: 'user-99' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [PortfolioResourceController],
      providers: [{ provide: PortfolioService, useValue: portfolioService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/portfolios/:id uses JWT user id', async () => {
    portfolioService.findByIdForUser.mockResolvedValue({
      id: 'pf-1',
      workspaceId: 'ws-1',
      name: 'P',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer()).get('/api/v1/portfolios/pf-1').expect(200);

    expect(portfolioService.findByIdForUser).toHaveBeenCalledWith('pf-1', 'user-99');
  });
});
