import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from '../common/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  const prisma = {
    task: {
      findUnique: jest.fn(),
    },
    workspaceMember: {
      findUnique: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  describe('listForTask', () => {
    it('throws NotFoundException when task is missing', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.listForTask('t1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when task is soft-deleted', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        deletedAt: new Date(),
        workspaceId: 'ws-1',
        project: null,
      });

      await expect(service.listForTask('t1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when task has no workspace context', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        deletedAt: null,
        workspaceId: null,
        project: { workspaceLinks: [] },
      });

      await expect(service.listForTask('t1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is not a workspace member', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        deletedAt: null,
        workspaceId: 'ws-1',
        project: null,
      });
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(service.listForTask('t1', 'u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('resolves workspace from project link when task.workspaceId is null', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        deletedAt: null,
        workspaceId: null,
        project: {
          workspaceLinks: [{ workspaceId: 'ws-from-project' }],
        },
      });
      prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'log-1' }]);

      const rows = await service.listForTask('t1', 'u1');

      expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: 'ws-from-project',
            userId: 'u1',
          },
        },
      });
      expect(rows).toEqual([{ id: 'log-1' }]);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { taskId: 't1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('returns audit rows when user has access via workspaceId on task', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        deletedAt: null,
        workspaceId: 'ws-1',
        project: null,
      });
      prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'm1' });
      prisma.auditLog.findMany.mockResolvedValue([]);

      await service.listForTask('t1', 'u1');

      expect(prisma.auditLog.findMany).toHaveBeenCalled();
    });
  });

  describe('listForWorkspace', () => {
    it('returns latest 100 audit entries for workspace', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: 'a' }]);

      const rows = await service.listForWorkspace('ws-1');

      expect(rows).toEqual([{ id: 'a' }]);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });
  });
});
