import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { PublicIntakeFormController } from './public-intake-form.controller';
import { ProjectIntakeFormService } from './project-intake-form.service';

describe('PublicIntakeFormController (HTTP)', () => {
  let app: INestApplication;
  const intakeFormService = {
    getPublicByToken: jest.fn(),
    submitPublic: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [PublicIntakeFormController],
      providers: [{ provide: ProjectIntakeFormService, useValue: intakeFormService }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /:token trims token and returns form', async () => {
    const dto = {
      projectName: 'P',
      formName: 'F',
      description: null,
      fields: [],
    };
    intakeFormService.getPublicByToken.mockResolvedValue(dto);

    const res = await request(app.getHttpServer())
      .get('/api/v1/public/intake-forms/  abc  ')
      .expect(200);

    expect(res.body).toEqual(dto);
    expect(intakeFormService.getPublicByToken).toHaveBeenCalledWith('abc');
  });

  it('POST /:token/submit rejects missing values object', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/public/intake-forms/tok/submit')
      .send({})
      .expect(400);
  });

  it('POST /:token/submit coerces values to strings', async () => {
    intakeFormService.submitPublic.mockResolvedValue({ success: true });

    await request(app.getHttpServer())
      .post('/api/v1/public/intake-forms/tok/submit')
      .send({ values: { a: 1, b: null, c: 'x' } })
      .expect(201);

    expect(intakeFormService.submitPublic).toHaveBeenCalledWith(
      'tok',
      {
        a: '1',
        b: '',
        c: 'x',
      },
      undefined,
    );
  });

  it('POST /:token/submit forwards captchaToken', async () => {
    intakeFormService.submitPublic.mockResolvedValue({ success: true });

    await request(app.getHttpServer())
      .post('/api/v1/public/intake-forms/tok/submit')
      .send({ values: { a: 'x' }, captchaToken: 'tok123' })
      .expect(201);

    expect(intakeFormService.submitPublic).toHaveBeenCalledWith(
      'tok',
      { a: 'x' },
      'tok123',
    );
  });
});
