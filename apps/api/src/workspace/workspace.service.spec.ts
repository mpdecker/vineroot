import { WorkspaceService } from './workspace.service';

describe('WorkspaceService', () => {
  const prisma = {
    workspace: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    workspaceMember: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), update: jest.fn() },
  };

  let service: WorkspaceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkspaceService(prisma as any);
  });

  const memberUser = {
    id: 'u1',
    email: 'a@b.com',
    displayName: 'A',
    passwordHash: 'secret-hash',
    avatarUrl: null,
    isAgent: false,
    agentTier: null,
    timezone: 'UTC',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const workspaceRow = {
    id: 'ws1',
    name: 'W',
    slug: 'w-abc',
    description: null,
    logoUrl: null,
    slackIncomingWebhookUrl: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [
      {
        id: 'wm1',
        workspaceId: 'ws1',
        userId: 'u1',
        role: 'OWNER',
        joinedAt: new Date(),
        user: memberUser,
      },
    ],
  };

  it('listByUser excludes deleted workspaces', async () => {
    prisma.workspace.findMany.mockResolvedValue([workspaceRow]);

    await service.listByUser('u1');

    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        members: { some: { userId: 'u1' } },
        deletedAt: null,
      },
      include: { members: { include: { user: true } } },
    });
  });

  it('findById returns null when deleted', async () => {
    prisma.workspace.findUnique.mockResolvedValue({
      ...workspaceRow,
      deletedAt: new Date(),
    });
    expect(await service.findById('ws1')).toBeNull();
  });

  it('inviteMember throws when user email not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.inviteMember('ws1', { email: 'missing@x.com', role: 'MEMBER' }),
    ).rejects.toThrow('User not found');
  });

  it('findById maps member users without password hash', async () => {
    prisma.workspace.findUnique.mockResolvedValue(workspaceRow);

    const dto = await service.findById('ws1');

    expect(dto?.members?.[0].user).not.toHaveProperty('passwordHash');
    expect(dto?.members?.[0].user.email).toBe('a@b.com');
    expect(dto?.members?.[0].user.displayName).toBe('A');
  });
});

