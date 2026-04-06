import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PmCrewService } from './pm-crew.service';
import { PrismaService } from '../common/prisma.service';

describe('PmCrewService', () => {
  const prisma = {
    pmHumanGate: { findMany: jest.fn(), update: jest.fn() },
    pmTask: { findMany: jest.fn(), groupBy: jest.fn() },
    pmTaskDependency: { findMany: jest.fn() },
    pmProject: { findMany: jest.fn() },
    pmAuditLog: { create: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        pmHumanGate: { update: prisma.pmHumanGate.update },
        pmAuditLog: { create: prisma.pmAuditLog.create },
      };
      return fn(tx);
    }),
  };

  let service: PmCrewService;
  const prevCrew = process.env.PM_CREW_ENABLED;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.PM_CREW_ENABLED = 'true';
    const moduleRef = await Test.createTestingModule({
      providers: [PmCrewService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PmCrewService);
  });

  afterEach(() => {
    if (prevCrew === undefined) delete process.env.PM_CREW_ENABLED;
    else process.env.PM_CREW_ENABLED = prevCrew;
  });

  describe('heartbeat', () => {
    it('no-ops when PM_CREW_ENABLED is not true', async () => {
      delete process.env.PM_CREW_ENABLED;
      await service.heartbeat();
      expect(prisma.pmHumanGate.findMany).not.toHaveBeenCalled();

      process.env.PM_CREW_ENABLED = 'false';
      await service.heartbeat();
      expect(prisma.pmHumanGate.findMany).not.toHaveBeenCalled();
    });

    it('marks stuck gates and writes SYSTEM_ALERT', async () => {
      const old = new Date(Date.now() - 3 * 60 * 60 * 1000);
      prisma.pmHumanGate.findMany.mockResolvedValue([
        {
          id: 'g1',
          projectId: 'p1',
          gateType: 'PHASE_GATE',
          createdAt: old,
        },
      ]);
      prisma.pmHumanGate.update.mockResolvedValue({});
      prisma.pmAuditLog.create.mockResolvedValue({});
      prisma.pmTask.findMany.mockResolvedValue([]);

      await service.heartbeat();

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.pmHumanGate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'g1' },
          data: { ageAlertSent: true },
        }),
      );
      expect(prisma.pmAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'SYSTEM_ALERT',
            actor: 'pm_crew',
          }),
        }),
      );
    });

    it('logs LARGE_PARALLEL_UNBLOCK when 5+ pending depend on completed task', async () => {
      prisma.pmHumanGate.findMany.mockResolvedValue([]);
      prisma.pmTask.findMany.mockResolvedValue([
        { id: 'done1', projectId: 'p1', title: 'Big' },
      ]);
      prisma.pmTaskDependency.findMany.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          dependsOnId: 'done1',
          task: { id: `t${i}`, status: 'PENDING', projectId: 'p1' },
        })),
      );

      await service.heartbeat();

      expect(prisma.pmAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'SYSTEM_ALERT',
            detail: expect.objectContaining({ kind: 'LARGE_PARALLEL_UNBLOCK' }),
          }),
        }),
      );
    });

    it('swallows P2021 (missing PM tables) and warns once', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      prisma.pmHumanGate.findMany.mockRejectedValue(
        new PrismaClientKnownRequestError('no table', {
          code: 'P2021',
          clientVersion: '1',
        }),
      );

      await service.heartbeat();
      await service.heartbeat();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/modelt pm tables are missing/i);
      warnSpy.mockRestore();
    });
  });

  describe('progressReport', () => {
    it('no-ops when PM_CREW_ENABLED is not true', async () => {
      delete process.env.PM_CREW_ENABLED;
      await service.progressReport();
      expect(prisma.pmProject.findMany).not.toHaveBeenCalled();
    });

    it('writes PROGRESS_REPORT per open project', async () => {
      prisma.pmProject.findMany.mockResolvedValue([{ id: 'p1', slug: 'app' }]);
      prisma.pmTask.groupBy.mockResolvedValue([
        { status: 'DONE', _count: { id: 3 } },
        { status: 'PENDING', _count: { id: 2 } },
      ]);
      prisma.pmAuditLog.create.mockResolvedValue({});

      await service.progressReport();

      expect(prisma.pmAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'PROGRESS_REPORT',
            projectId: 'p1',
            detail: expect.objectContaining({
              summary: expect.stringContaining('app'),
            }),
          }),
        }),
      );
    });
  });
});
