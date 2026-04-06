import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { JwtAuthGuard, WorkspaceGuard } from '../auth/guards';

describe('AuditController (HTTP integration)', () => {
  let app: INestApplication;
  const auditService = {
    listForTask: jest.fn(),
    listForWorkspace: jest.fn(),
  };

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
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: auditService }],
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

  it('GET tasks/:taskId/audit-logs passes user id', async () => {
    auditService.listForTask.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/tasks/t1/audit-logs')
      .expect(200);

    expect(auditService.listForTask).toHaveBeenCalledWith('t1', 'user-1');
  });

  it('GET workspaces/:id/audit-logs delegates to service', async () => {
    auditService.listForWorkspace.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces/ws-9/audit-logs')
      .expect(200);

    expect(auditService.listForWorkspace).toHaveBeenCalledWith('ws-9');
  });
});
