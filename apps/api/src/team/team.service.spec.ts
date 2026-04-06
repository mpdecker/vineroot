import { TeamService } from './team.service';

describe('TeamService', () => {
  const prisma = {
    team: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: TeamService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TeamService(prisma as any);
  });

  const teamRow = {
    id: 'tm1',
    workspaceId: 'ws1',
    name: 'Squad',
    description: null,
    color: null,
    emoji: null,
    isPrivate: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [],
  };

  it('create defaults isPrivate false', async () => {
    prisma.team.create.mockResolvedValue(teamRow);

    await service.create('ws1', { name: 'Squad' });

    expect(prisma.team.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'ws1',
        name: 'Squad',
        description: undefined,
        color: undefined,
        emoji: undefined,
        isPrivate: false,
      },
      include: { members: { include: { user: true } } },
    });
  });

  it('findById returns null when soft-deleted', async () => {
    prisma.team.findUnique.mockResolvedValue({ ...teamRow, deletedAt: new Date() });
    const r = await service.findById('tm1');
    expect(r).toBeNull();
  });

  it('delete soft-deletes', async () => {
    prisma.team.update.mockResolvedValue(teamRow);
    await service.delete('tm1');
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'tm1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
