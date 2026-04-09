import { Test } from '@nestjs/testing';
import { GoalService } from './goal.service';
import { PrismaService } from '../common/prisma.service';
import { GoalMetricComputeService } from './goal-metric-compute.service';
import { GoalStatus } from '@prisma/client';

describe('GoalService', () => {
  let service: GoalService;
  const goalMetricCompute = {
    computeAndPersist: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    goal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    goalMetric: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const now = new Date();
  const goalRow = {
    id: 'g1',
    workspaceId: 'ws-1',
    ownerId: null,
    name: 'Ship v1',
    description: null,
    status: GoalStatus.NO_STATUS,
    startDate: null,
    dueDate: null,
    createdAt: now,
    updatedAt: now,
    metrics: [],
    owner: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GoalService,
        { provide: PrismaService, useValue: prisma },
        { provide: GoalMetricComputeService, useValue: goalMetricCompute },
      ],
    }).compile();
    service = moduleRef.get(GoalService);
  });

  describe('deleteGoal', () => {
    it('deletes when goal exists in workspace', async () => {
      prisma.goal.findFirst.mockResolvedValue({ id: 'g1', workspaceId: 'ws-1' });
      prisma.goal.delete.mockResolvedValue(goalRow);

      await service.deleteGoal('g1', 'ws-1');

      expect(prisma.goal.findFirst).toHaveBeenCalledWith({
        where: { id: 'g1', workspaceId: 'ws-1' },
      });
      expect(prisma.goal.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
    });

    it('no-op when goal not in workspace', async () => {
      prisma.goal.findFirst.mockResolvedValue(null);

      await service.deleteGoal('g1', 'ws-1');

      expect(prisma.goal.delete).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates goal with workspace id', async () => {
      prisma.goal.create.mockResolvedValue(goalRow);

      const dto = await service.create('ws-1', { name: 'Ship v1' });

      expect(prisma.goal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: 'ws-1',
            name: 'Ship v1',
          }),
        }),
      );
      expect(dto.id).toBe('g1');
      expect(dto.workspaceId).toBe('ws-1');
    });
  });
});
