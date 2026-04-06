import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentService } from './attachment.service';
import { AttachmentStorageRouter } from './attachment-storage.router';

describe('AttachmentService', () => {
  const prisma = {
    task: { findUnique: jest.fn() },
    workspaceMember: { findUnique: jest.fn() },
    attachment: { findUnique: jest.fn(), create: jest.fn() },
  };

  const taskActivityLog = { log: jest.fn() };
  const config = {
    get: jest.fn(() => undefined),
  };

  const storage = {
    removeStoredObject: jest.fn(),
    saveUpload: jest.fn(),
    rollbackUpload: jest.fn(),
    resolveDownload: jest.fn(),
  };

  let service: AttachmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AttachmentService(
      prisma as any,
      taskActivityLog as any,
      config as unknown as ConfigService,
      storage as unknown as AttachmentStorageRouter,
    );
  });

  const accessibleTask = {
    id: 'task1',
    deletedAt: null,
    workspaceId: 'ws1',
    projectId: 'p1',
    project: {
      workspaceLinks: [{ workspaceId: 'ws1' }],
    },
  };

  it('resolveDownload redirects for link storageKey', async () => {
    prisma.attachment.findUnique.mockResolvedValue({
      id: 'a1',
      taskId: 'task1',
      storageKey: 'link:https://x',
      url: 'https://example.com/f',
      mimeType: 'application/pdf',
      filename: 'f.pdf',
    });
    prisma.task.findUnique.mockResolvedValue(accessibleTask);
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'm1' });

    const r = await service.resolveDownload('a1', 'u1');
    expect(r).toEqual({ kind: 'redirect', url: 'https://example.com/f' });
    expect(storage.resolveDownload).not.toHaveBeenCalled();
  });

  it('resolveDownload delegates to storage for local keys', async () => {
    prisma.attachment.findUnique.mockResolvedValue({
      id: 'a1',
      taskId: 'task1',
      storageKey: 'tasks/task1/x.bin',
      url: '/x',
      mimeType: 'application/octet-stream',
      filename: 'x.bin',
    });
    prisma.task.findUnique.mockResolvedValue(accessibleTask);
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'm1' });
    storage.resolveDownload.mockRejectedValue(new NotFoundException('File no longer on server'));

    await expect(service.resolveDownload('a1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.resolveDownload).toHaveBeenCalledWith(
      'tasks/task1/x.bin',
      'application/octet-stream',
      'x.bin',
    );
  });

  it('removeLocalStoredFile delegates to storage router', async () => {
    storage.removeStoredObject.mockResolvedValue(undefined);
    await service.removeLocalStoredFile('tasks/t1/f');
    expect(storage.removeStoredObject).toHaveBeenCalledWith('tasks/t1/f');
  });

  it('removeLocalStoredFile no-ops link keys via router', async () => {
    await service.removeLocalStoredFile('link:x');
    expect(storage.removeStoredObject).toHaveBeenCalledWith('link:x');
  });
});
