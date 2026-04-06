import { ConfigService } from '@nestjs/config';
import { AttachmentRetentionService } from './attachment-retention.service';
import { AttachmentStorageRouter } from './attachment-storage.router';

describe('AttachmentRetentionService', () => {
  const prisma = {
    attachment: {
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const storage = {
    removeStoredObject: jest.fn(),
  };

  let service: AttachmentRetentionService;

  function makeService(days: string) {
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'ATTACHMENT_RETENTION_DAYS') return days;
        return undefined;
      }),
    };
    return new AttachmentRetentionService(
      prisma as any,
      config as unknown as ConfigService,
      storage as unknown as AttachmentStorageRouter,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.attachment.delete.mockResolvedValue({});
    storage.removeStoredObject.mockResolvedValue(undefined);
  });

  it('purgeExpiredLocalFiles returns early when retention disabled', async () => {
    service = makeService('0');
    await service.purgeExpiredLocalFiles();
    expect(prisma.attachment.findMany).not.toHaveBeenCalled();
  });

  it('purgeExpiredLocalFiles removes storage then deletes rows', async () => {
    service = makeService('7');
    prisma.attachment.findMany.mockResolvedValue([
      { id: 'a1', storageKey: 'tasks/t1/f.bin' },
    ]);

    await service.purgeExpiredLocalFiles();

    expect(storage.removeStoredObject).toHaveBeenCalledWith('tasks/t1/f.bin');
    expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
