import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { WorkCalendarService } from './work-calendar.service';

describe('WorkCalendarService', () => {
  let service: WorkCalendarService;
  const prisma = {
    workspaceMember: { findUnique: jest.fn() },
    workCalendar: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      (fn as (tx: typeof prisma) => Promise<unknown>)(prisma),
    ),
  };

  const ws = 'ws1';
  const uid = 'u1';
  const now = new Date();

  const calendarRow = {
    id: 'cal1',
    workspaceId: ws,
    name: 'Std',
    timeZone: 'UTC',
    weeklyPattern: { mon: 480 },
    exceptions: [],
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [WorkCalendarService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(WorkCalendarService);
  });

  it('listWorkspaceCalendars requires membership', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    await expect(service.listWorkspaceCalendars(ws, uid)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('listWorkspaceCalendars returns DTOs sorted query', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    prisma.workCalendar.findMany.mockResolvedValue([calendarRow]);

    const rows = await service.listWorkspaceCalendars(ws, uid);
    expect(rows[0].id).toBe('cal1');
    expect(prisma.workCalendar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: ws } }),
    );
  });

  it('create requires owner or admin', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    await expect(
      service.create(ws, uid, { name: 'X', timeZone: 'UTC' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create clears other defaults when isDefault true', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.workCalendar.create.mockResolvedValue(calendarRow);

    await service.create(ws, uid, {
      name: 'Std',
      isDefault: true,
    });

    expect(prisma.workCalendar.updateMany).toHaveBeenCalled();
    expect(prisma.workCalendar.create).toHaveBeenCalled();
  });

  it('findById throws when missing', async () => {
    prisma.workCalendar.findUnique.mockResolvedValue(null);
    await expect(service.findById('missing', uid)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delete requires admin', async () => {
    prisma.workCalendar.findUnique.mockResolvedValue(calendarRow);
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    await expect(service.delete('cal1', uid)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
