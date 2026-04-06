import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { Readable } from 'stream';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { JwtAuthGuard } from '../auth/guards';

describe('AttachmentController (HTTP)', () => {
  let app: INestApplication;
  const attachmentService = {
    resolveDownload: jest.fn(),
  };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      context.switchToHttp().getRequest().user = { userId: 'u1' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AttachmentController],
      providers: [{ provide: AttachmentService, useValue: attachmentService }],
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

  it('GET /:id/content redirects when service returns redirect', async () => {
    attachmentService.resolveDownload.mockResolvedValue({
      kind: 'redirect',
      url: 'https://cdn.example.com/file.pdf',
    });

    await request(app.getHttpServer())
      .get('/api/v1/attachments/att-1/content')
      .expect(302)
      .expect('Location', 'https://cdn.example.com/file.pdf');

    expect(attachmentService.resolveDownload).toHaveBeenCalledWith('att-1', 'u1');
  });

  it('GET /:id/content streams file when local', async () => {
    attachmentService.resolveDownload.mockResolvedValue({
      kind: 'file',
      stream: Readable.from(['hello']),
      mimeType: 'text/plain',
      filename: 'note.txt',
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/attachments/att-1/content')
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toBe('hello');
  });
});
