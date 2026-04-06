import { ForbiddenException } from '@nestjs/common';
import { SearchService } from './search.service';

function mockPrisma() {
  return {
    workspaceMember: { findUnique: jest.fn() },
    task: { findMany: jest.fn() },
    comment: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    section: { findMany: jest.fn() },
    tag: { findMany: jest.fn() },
  };
}

describe('SearchService', () => {
  let service: SearchService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new SearchService(prisma as any);
  });

  it('returns empty when query shorter than 2 chars', async () => {
    const r = await service.search('u1', 'a');
    expect(r).toEqual({ tasks: [], projects: [], sections: [], tags: [] });
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it('throws when workspaceId set and user is not a member', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(service.search('u1', 'ab', 'ws1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('runs scoped queries and returns shaped hits', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'm1' });
    const now = new Date();
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Hello world',
        description: null,
        status: 'READY',
        projectId: 'p1',
        sectionId: null,
        updatedAt: now,
        project: { name: 'Proj' },
        section: null,
      },
    ]);
    prisma.comment.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.section.findMany.mockResolvedValue([]);
    prisma.tag.findMany.mockResolvedValue([]);

    const r = await service.search('u1', 'hello', 'ws1', 10);

    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0]).toMatchObject({
      id: 't1',
      title: 'Hello world',
      matchKind: 'TITLE',
      projectName: 'Proj',
    });
    const tagCall = prisma.tag.findMany.mock.calls[0][0];
    expect(tagCall.where.AND).toHaveLength(2);
    expect(tagCall.where.AND[1]).toEqual({ workspaceId: 'ws1' });
  });
});
