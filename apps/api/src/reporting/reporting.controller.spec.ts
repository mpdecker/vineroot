import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('ReportingController (HTTP integration)', () => {
  let app: INestApplication;
  const reportingService = {
    workspaceSummary: jest.fn(),
  };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: 'u1' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [{ provide: ReportingService, useValue: reportingService }],
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

  it('GET summary delegates to service', async () => {
    reportingService.workspaceSummary.mockResolvedValue({
      workspaceId: 'ws-1',
      tasksByStatus: {},
      openTaskCount: 0,
      completedLast30Days: 0,
      createdLast30Days: 0,
      workload: [],
    });

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws-1/reporting/summary')
      .expect(200);

    expect(reportingService.workspaceSummary).toHaveBeenCalledWith('ws-1');
  });
});
