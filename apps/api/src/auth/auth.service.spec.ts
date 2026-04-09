import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workCalendar: {
      findFirst: jest.fn(),
    },
    workspace: {
      create: jest.fn(),
    },
    workspaceMember: {
      findFirst: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('jwt-access'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(bcrypt.compare).mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('register rejects duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    await expect(
      service.register({
        email: 'a@b.com',
        password: 'secret',
        displayName: 'A',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('login rejects unknown user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@b.com', password: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login rejects invalid password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'stored',
    });
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);
    prisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: 'ws-1',
      role: 'OWNER',
    });

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  const fullUserRow = {
    id: 'u1',
    email: 'a@b.com',
    displayName: 'A',
    passwordHash: 'stored',
    avatarUrl: null as string | null,
    isAgent: false,
    agentTier: null as string | null,
    timezone: 'UTC',
    workCalendarId: null as string | null,
    resourceStandardRatePerHour: null,
    resourceOvertimeRatePerHour: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('updateProfile returns current user without update when body empty', async () => {
    prisma.user.findUnique.mockResolvedValue(fullUserRow);

    const u = await service.updateProfile('u1', {});

    expect(u.displayName).toBe('A');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updateProfile throws when user missing and body empty', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.updateProfile('u1', {})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updateProfile trims and updates fields', async () => {
    prisma.user.update.mockResolvedValue({
      ...fullUserRow,
      displayName: 'B',
      timezone: 'America/Los_Angeles',
    });

    const u = await service.updateProfile('u1', {
      displayName: '  B  ',
      timezone: ' America/Los_Angeles ',
    });

    expect(u.displayName).toBe('B');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { displayName: 'B', timezone: 'America/Los_Angeles' },
    });
  });

  it('updateProfile rejects work calendar outside user workspaces', async () => {
    prisma.workCalendar.findFirst.mockResolvedValue(null);

    await expect(
      service.updateProfile('u1', { workCalendarId: 'cal-bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updateProfile sets work calendar and rates when valid', async () => {
    prisma.workCalendar.findFirst.mockResolvedValue({ id: 'cal-1' });
    prisma.user.update.mockResolvedValue({
      ...fullUserRow,
      workCalendarId: 'cal-1',
      resourceStandardRatePerHour: 100,
      resourceOvertimeRatePerHour: null,
    });

    const u = await service.updateProfile('u1', {
      workCalendarId: 'cal-1',
      resourceStandardRatePerHour: 100,
      resourceOvertimeRatePerHour: null,
    });

    expect(prisma.user.update).toHaveBeenCalled();
    expect(u.workCalendarId).toBe('cal-1');
    expect(u.resourceStandardRatePerHour).toBe(100);
  });

  it('changePassword rejects wrong current password', async () => {
    prisma.user.findUnique.mockResolvedValue(fullUserRow);
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      service.changePassword('u1', 'wrong', 'newpassword12'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('changePassword updates hash when current password valid', async () => {
    prisma.user.findUnique.mockResolvedValue(fullUserRow);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await service.changePassword('u1', 'ok', 'newpassword12');

    expect(res.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'hashed-password' },
    });
  });
});
