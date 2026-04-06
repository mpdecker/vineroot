/**
 * Optional smoke test against a real DB with PM migrations applied.
 * Run: PM_ORCHESTRATOR_SECRET=test PM_INTEGRATION=1 npx jest src/pm/pm-orchestrator.integration.spec.ts
 */
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

const RUN = process.env.PM_INTEGRATION === '1' && process.env.PM_ORCHESTRATOR_SECRET;
const auth = process.env.PM_ORCHESTRATOR_SECRET ?? 'test-secret';
const describeIntegration = RUN ? describe : describe.skip;

describeIntegration('PmOrchestrator HTTP (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (!RUN) return;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/v1/pm/projects returns 401 without bearer', async () => {
    if (!RUN) return;
    await request(app.getHttpServer()).get('/api/v1/pm/projects').expect(401);
  });

  it('GET /api/v1/pm/projects returns 200 with bearer', async () => {
    if (!RUN) return;
    await request(app.getHttpServer())
      .get('/api/v1/pm/projects')
      .set('Authorization', `Bearer ${auth}`)
      .expect(200);
  });
});
