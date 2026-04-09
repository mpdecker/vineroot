import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  WorkspaceGuard,
  WorkspaceAdminGuard,
  WorkspaceMemberWriteGuard,
} from './guards';
import { PrismaService } from '../common/prisma.service';

describe('WorkspaceGuard', () => {
  const prisma = {
    workspaceMember: { findUnique: jest.fn() },
  };

  let guard: WorkspaceGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new WorkspaceGuard(prisma as unknown as PrismaService);
  });

  function ctx(params: Record<string, string>, user?: { userId: string }) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params,
          user: user ?? { userId: 'u1' },
        }),
      }),
    } as ExecutionContext;
  }

  it('checks membership using workspaceId param', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    await expect(guard.canActivate(ctx({ workspaceId: 'ws-1' }))).resolves.toBe(true);

    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'u1' } },
    });
  });

  it('checks membership using id param (workspace routes)', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    await expect(guard.canActivate(ctx({ id: 'ws-1' }))).resolves.toBe(true);

    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'u1' } },
    });
  });

  it('returns true when no workspace id in params', async () => {
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when user missing', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ params: { id: 'ws-1' }, user: undefined }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws ForbiddenException when not a member', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(ctx({ id: 'ws-1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('WorkspaceAdminGuard', () => {
  const prisma = {
    workspaceMember: { findUnique: jest.fn() },
  };

  let guard: WorkspaceAdminGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new WorkspaceAdminGuard(prisma as unknown as PrismaService);
  });

  function ctx(params: Record<string, string>, user?: { userId: string }) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params,
          user: user ?? { userId: 'u1' },
        }),
      }),
    } as ExecutionContext;
  }

  it('allows owner using id param', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'OWNER' });

    await expect(guard.canActivate(ctx({ id: 'ws-1' }))).resolves.toBe(true);
  });

  it('allows admin using workspaceId param', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'ADMIN' });

    await expect(guard.canActivate(ctx({ workspaceId: 'ws-1' }))).resolves.toBe(true);
  });

  it('rejects member role', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

    await expect(guard.canActivate(ctx({ id: 'ws-1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('WorkspaceMemberWriteGuard', () => {
  let guard: WorkspaceMemberWriteGuard;

  beforeEach(() => {
    guard = new WorkspaceMemberWriteGuard();
  });

  function ctx(workspace: { role?: string } | undefined) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ workspace }),
      }),
    } as ExecutionContext;
  }

  it('allows OWNER, ADMIN, MEMBER', () => {
    expect(guard.canActivate(ctx({ role: 'OWNER' }))).toBe(true);
    expect(guard.canActivate(ctx({ role: 'ADMIN' }))).toBe(true);
    expect(guard.canActivate(ctx({ role: 'MEMBER' }))).toBe(true);
  });

  it('rejects GUEST', () => {
    expect(() => guard.canActivate(ctx({ role: 'GUEST' }))).toThrow(ForbiddenException);
  });

  it('rejects when workspace not on request', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
