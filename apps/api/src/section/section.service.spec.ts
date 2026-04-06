import { BadRequestException } from '@nestjs/common';
import { SectionService } from './section.service';

describe('SectionService', () => {
  const prisma = {
    section: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: SectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SectionService(prisma as any);
  });

  it('create rejects non-integer wipLimit', async () => {
    await expect(
      service.create('p1', { name: 'A', wipLimit: 1.5 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create rejects wipLimit below 1', async () => {
    await expect(
      service.create('p1', { name: 'A', wipLimit: 0 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create assigns next sort order and maps dto', async () => {
    prisma.section.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    prisma.section.create.mockResolvedValue({
      id: 's1',
      projectId: 'p1',
      name: 'Col',
      color: null,
      sortOrder: 3,
      wipLimit: null,
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const dto = await service.create('p1', { name: 'Col' });

    expect(prisma.section.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p1', name: 'Col', sortOrder: 3 }),
    });
    expect(dto.id).toBe('s1');
    expect(dto.sortOrder).toBe(3);
    expect(dto.wipLimit).toBeNull();
  });

  it('update rejects invalid wipLimit', async () => {
    await expect(
      service.update('s1', { wipLimit: -1 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
