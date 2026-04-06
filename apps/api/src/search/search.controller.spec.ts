import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards';

describe('SearchController (HTTP)', () => {
  let app: INestApplication;
  const searchService = { search: jest.fn() };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: 'user-1' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: searchService }],
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

  it('GET /api/v1/search forwards q, workspaceId, and limit', async () => {
    searchService.search.mockResolvedValue({ tasks: [], projects: [], sections: [], tags: [] });

    await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: 'hello', workspaceId: 'ws-a', limit: '15' })
      .expect(200);

    expect(searchService.search).toHaveBeenCalledWith('user-1', 'hello', 'ws-a', 15);
  });

  it('GET /api/v1/search defaults limit when invalid', async () => {
    searchService.search.mockResolvedValue({ tasks: [], projects: [], sections: [], tags: [] });

    await request(app.getHttpServer())
      .get('/api/v1/search')
      .query({ q: 'hi', limit: 'nope' })
      .expect(200);

    expect(searchService.search).toHaveBeenCalledWith('user-1', 'hi', undefined, 20);
  });
});
