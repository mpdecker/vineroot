import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { CustomFieldController } from './custom-field.controller';
import { CustomFieldService } from './custom-field.service';
import { JwtAuthGuard } from '../auth/guards';
import { CustomFieldType } from '@vineroot/shared-types';

describe('CustomFieldController (HTTP integration)', () => {
  let app: INestApplication;

  const customFieldService = {
    listByWorkspace: jest.fn(),
    createDefinition: jest.fn(),
    setValue: jest.fn(),
  };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: 'actor-1' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomFieldController],
      providers: [{ provide: CustomFieldService, useValue: customFieldService }],
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

  it('PUT .../tasks/:taskId/fields/:fieldId passes actor id and body', async () => {
    const now = new Date();
    customFieldService.setValue.mockResolvedValue({
      id: 'cv-1',
      taskId: 't1',
      fieldId: 'f1',
      value: { text: 'done' },
      field: {
        id: 'f1',
        workspaceId: 'ws-1',
        name: 'Status',
        type: CustomFieldType.TEXT,
        isRequired: false,
        createdAt: now,
      },
    });

    await request(app.getHttpServer())
      .put('/api/v1/workspaces/ws-1/custom-fields/tasks/t1/fields/f1')
      .send({ value: { text: 'done' } })
      .expect(200);

    expect(customFieldService.setValue).toHaveBeenCalledWith(
      't1',
      'f1',
      { value: { text: 'done' } },
      'actor-1',
    );
  });
});
