import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { GenericResourceService } from './generic-resource.service';

describe('GenericResourceService', () => {
  let service: GenericResourceService;
  const prisma = {
    workspaceMember: { findUnique: jest.fn() },
    workCalendar: { findFirst: jest.fn() },
    genericResource: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const ws = 'ws1';
  const uid = 'u1';
  const now = new Date();

  const row = {
    id: 'gr1',
    workspaceId: ws,
    name: 'Forklift',
    maxUnitsPercent: 200,
    standardRatePerHour: null,
    workCalendarId: null as string | null,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.workCalendar.findFirst.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [GenericResourceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(GenericResourceService);
  });

  it('list requires membership', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);
    await expect(service.list(ws, uid)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('list returns resources for workspace', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    prisma.genericResource.findMany.mockResolvedValue([row]);

    const out = await service.list(ws, uid);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Forklift');
    expect(out[0].maxUnitsPercent).toBe(200);
  });

  it('create requires admin', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    await expect(service.create(ws, uid, { name: 'X' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('create rejects empty name', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    await expect(service.create(ws, uid, { name: '  ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('create persists maxUnitsPercent', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.genericResource.create.mockResolvedValue(row);

    await service.create(ws, uid, { name: 'Forklift', maxUnitsPercent: 200 });
    expect(prisma.genericResource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: ws,
          name: 'Forklift',
          maxUnitsPercent: 200,
        }),
      }),
    );
  });

  it('create persists workCalendarId when calendar exists in workspace', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.workCalendar.findFirst.mockResolvedValue({ id: 'cal1' });
    prisma.genericResource.create.mockResolvedValue({ ...row, workCalendarId: 'cal1' });

    await service.create(ws, uid, { name: 'Forklift', workCalendarId: 'cal1' });
    expect(prisma.workCalendar.findFirst).toHaveBeenCalledWith({
      where: { id: 'cal1', workspaceId: ws },
    });
    expect(prisma.genericResource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workCalendarId: 'cal1',
        }),
      }),
    );
  });

  it('delete throws when missing', async () => {
    prisma.genericResource.findUnique.mockResolvedValue(null);
    await expect(service.delete('missing', uid)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('delete requires workspace admin', async () => {
    prisma.genericResource.findUnique.mockResolvedValue(row);
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
    await expect(service.delete('gr1', uid)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findById returns DTO for member', async () => {
    prisma.genericResource.findUnique.mockResolvedValue(row);
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    const dto = await service.findById('gr1', uid);
    expect(dto.id).toBe('gr1');
    expect(dto.maxUnitsPercent).toBe(200);
  });

  it('update applies partial fields', async () => {
    prisma.genericResource.findUnique.mockResolvedValue(row);
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.genericResource.update.mockResolvedValue({ ...row, name: 'Renamed', maxUnitsPercent: 120 });

    const dto = await service.update('gr1', uid, { name: 'Renamed', maxUnitsPercent: 120 });
    expect(dto.name).toBe('Renamed');
    expect(dto.maxUnitsPercent).toBe(120);
  });

  it('update with empty body returns existing row', async () => {
    prisma.genericResource.findUnique.mockResolvedValue(row);
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const dto = await service.update('gr1', uid, {});
    expect(dto.name).toBe('Forklift');
    expect(prisma.genericResource.update).not.toHaveBeenCalled();
  });

  it('update rejects invalid maxUnitsPercent', async () => {
    prisma.genericResource.findUnique.mockResolvedValue(row);
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });

    await expect(service.update('gr1', uid, { maxUnitsPercent: 0 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
