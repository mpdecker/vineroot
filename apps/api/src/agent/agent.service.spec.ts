import { UnauthorizedException } from '@nestjs/common';
import { TaskStatus, ReviewGate, ActorTier } from '@prisma/client';
import { AgentService } from './agent.service';

describe('AgentService', () => {
  const tx = {
    task: {
      update: jest.fn().mockResolvedValue({ id: 't1', status: TaskStatus.IN_REVIEW }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    agentToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    task: { findUnique: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(tx)),
    auditLog: { create: jest.fn() },
    workspaceMember: { findMany: jest.fn() },
    notification: { create: jest.fn() },
  };

  const gateway = { emitToWorkspace: jest.fn() };

  let service: AgentService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: any) => fn(tx));
    tx.task.update.mockResolvedValue({ id: 't1', status: TaskStatus.IN_REVIEW });
    service = new AgentService(prisma as any, gateway as any);
  });

  describe('validateToken', () => {
    it('throws when token not found', async () => {
      prisma.agentToken.findFirst.mockResolvedValue(null);
      await expect(service.validateToken('bad')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when token expired', async () => {
      prisma.agentToken.findFirst.mockResolvedValue({
        id: '1',
        token: 't',
        expiresAt: new Date(Date.now() - 1000),
        isActive: true,
      });
      await expect(service.validateToken('t')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('updates lastUsedAt on success', async () => {
      const row = {
        id: 'at1',
        token: 'tok',
        expiresAt: null,
        isActive: true,
      };
      prisma.agentToken.findFirst.mockResolvedValue(row);
      prisma.agentToken.update.mockResolvedValue(row);

      const r = await service.validateToken('tok');

      expect(r.id).toBe('at1');
      expect(prisma.agentToken.update).toHaveBeenCalledWith({
        where: { id: 'at1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });

  describe('listTokens', () => {
    it('masks full token', async () => {
      prisma.agentToken.findMany.mockResolvedValue([
        {
          id: '1',
          name: 'n',
          token: '0123456789abcdef',
          actorTier: ActorTier.CLAUDE_SONNET,
          scope: [],
          isActive: true,
          lastUsedAt: null,
          expiresAt: null,
          createdAt: new Date(),
        },
      ]);

      const [row] = await service.listTokens('ws1');
      expect(row.token).toBe('01234567...cdef');
    });
  });

  describe('getReadyTasks', () => {
    it('omits tasks blocked by incomplete dependencies', async () => {
      prisma.task.findMany.mockResolvedValue([
        {
          id: 't1',
          blockedBy: [
            {
              blockingTask: { id: 'b1', title: 'B', status: TaskStatus.IN_PROGRESS },
            },
          ],
        },
        {
          id: 't2',
          blockedBy: [
            { blockingTask: { id: 'b2', title: 'B2', status: TaskStatus.DONE } },
          ],
        },
      ]);

      const tasks = await service.getReadyTasks(ActorTier.CLAUDE_SONNET, 'ws1');
      expect(tasks.map((t) => t.id)).toEqual(['t2']);
    });
  });

  describe('completeTask', () => {
    it('sets IN_REVIEW when reviewGate requires it', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        workspaceId: 'ws1',
        reviewGate: ReviewGate.HUMAN_SIGNOFF,
      });

      const token = { id: 'a', name: 'n', actorTier: ActorTier.CLAUDE_SONNET };
      await service.completeTask('t1', token, { output: { x: 1 } });

      expect(tx.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: TaskStatus.IN_REVIEW }),
        }),
      );
      expect(gateway.emitToWorkspace).toHaveBeenCalledWith(
        'ws1',
        'task:completed',
        expect.any(Object),
      );
    });
  });
});
