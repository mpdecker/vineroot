import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('PortfolioController (HTTP integration)', () => {
  let app: INestApplication;

  const portfolioService = {
    listByWorkspace: jest.fn(),
    create: jest.fn(),
    findByIdInWorkspace: jest.fn(),
    update: jest.fn(),
    deleteInWorkspace: jest.fn(),
    addItem: jest.fn(),
    removeItem: jest.fn(),
  };

  const allowGuard: CanActivate = { canActivate: () => true };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [
        { provide: PortfolioService, useValue: portfolioService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .overrideGuard(WorkspaceGuard)
      .useValue(allowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/workspaces/:workspaceId/portfolios delegates to listByWorkspace', async () => {
    portfolioService.listByWorkspace.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws-9/portfolios')
      .expect(200);

    expect(portfolioService.listByWorkspace).toHaveBeenCalledWith('ws-9');
  });

  it('POST /api/v1/workspaces/:workspaceId/portfolios creates portfolio', async () => {
    portfolioService.create.mockResolvedValue({
      id: 'pf-1',
      workspaceId: 'ws-9',
      name: 'N',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws-9/portfolios')
      .send({ name: 'N', description: 'd' })
      .expect(201);

    expect(portfolioService.create).toHaveBeenCalledWith('ws-9', {
      name: 'N',
      description: 'd',
    });
  });

  it('GET /api/v1/workspaces/:workspaceId/portfolios/:id loads one', async () => {
    portfolioService.findByIdInWorkspace.mockResolvedValue({ id: 'pf-1' });

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws-9/portfolios/pf-1')
      .expect(200);

    expect(portfolioService.findByIdInWorkspace).toHaveBeenCalledWith('ws-9', 'pf-1');
  });

  it('DELETE /api/v1/workspaces/:workspaceId/portfolios/:id removes portfolio', async () => {
    portfolioService.deleteInWorkspace.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws-9/portfolios/pf-1')
      .expect(200);

    expect(portfolioService.deleteInWorkspace).toHaveBeenCalledWith('ws-9', 'pf-1');
  });

  it('POST .../portfolios/:id/items adds project', async () => {
    portfolioService.addItem.mockResolvedValue({ id: 'pf-1', items: [] });

    await request(app.getHttpServer())
      .post('/api/v1/workspaces/ws-9/portfolios/pf-1/items')
      .send({ projectId: 'p1' })
      .expect(201);

    expect(portfolioService.addItem).toHaveBeenCalledWith('ws-9', 'pf-1', {
      projectId: 'p1',
    });
  });

  it('DELETE .../items/:projectId removes project from portfolio', async () => {
    portfolioService.removeItem.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/v1/workspaces/ws-9/portfolios/pf-1/items/p1')
      .expect(200);

    expect(portfolioService.removeItem).toHaveBeenCalledWith('ws-9', 'pf-1', 'p1');
  });
});
