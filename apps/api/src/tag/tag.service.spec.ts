import { TagService } from './tag.service';

describe('TagService', () => {
  const prisma = {
    tag: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    taskTag: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: TagService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TagService(prisma as any);
  });

  it('create applies default color', async () => {
    prisma.tag.create.mockResolvedValue({
      id: 't1',
      workspaceId: 'ws1',
      name: 'x',
      color: '#6B7280',
      createdAt: new Date(),
    });

    const dto = await service.create('ws1', { name: 'x' });

    expect(prisma.tag.create).toHaveBeenCalledWith({
      data: { workspaceId: 'ws1', name: 'x', color: '#6B7280' },
    });
    expect(dto.color).toBe('#6B7280');
  });

  it('attachTagToTask creates join row', async () => {
    prisma.taskTag.create.mockResolvedValue({});
    await service.attachTagToTask('task1', 'tag1');
    expect(prisma.taskTag.create).toHaveBeenCalledWith({
      data: { taskId: 'task1', tagId: 'tag1' },
    });
  });
});
