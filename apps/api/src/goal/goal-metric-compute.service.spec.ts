import { NotFoundException } from '@nestjs/common';
import { GoalMetricComputeService } from './goal-metric-compute.service';
import { PrismaService } from '../common/prisma.service';

describe('GoalMetricComputeService', () => {
  it('recomputeAllWorkspaces coalesces concurrent calls into one run', async () => {
    const prisma = {
      workspace: {
        findMany: jest.fn().mockResolvedValue([{ id: 'ws-a' }]),
      },
    } as unknown as PrismaService;

    const service = new GoalMetricComputeService(prisma);
    let innerRuns = 0;
    jest.spyOn(service, 'recomputeAllComputedInWorkspace').mockImplementation(async () => {
      innerRuns += 1;
      await new Promise((r) => setTimeout(r, 25));
    });

    await Promise.all([
      service.recomputeAllWorkspaces(),
      service.recomputeAllWorkspaces(),
    ]);

    expect(innerRuns).toBe(1);
    expect(prisma.workspace.findMany).toHaveBeenCalledTimes(1);
  });

  it('recomputeMetricInWorkspace throws when metric not in workspace', async () => {
    const prisma = {
      goalMetric: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const service = new GoalMetricComputeService(prisma);
    await expect(
      service.recomputeMetricInWorkspace('ws1', 'missing-metric'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
