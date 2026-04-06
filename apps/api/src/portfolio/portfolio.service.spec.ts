import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PrismaService } from '../common/prisma.service';
import { ProjectService } from '../project/project.service';

describe('PortfolioService', () => {
  let service: PortfolioService;

  const prisma = {
    portfolio: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    portfolioItem: {
      create: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    projectWorkspace: { findUnique: jest.fn() },
    workspaceMember: { findUnique: jest.fn() },
  };

  const projectService = {
    toProjectDto: jest.fn((p: any) => ({
      id: p.id,
      name: p.name,
      workspaceIds: (p.workspaceLinks ?? []).map((l: any) => l.workspaceId),
      color: p.color,
      createdById: p.createdById,
      status: 'ACTIVE',
      isPrivate: false,
      isArchived: false,
      defaultView: 'list',
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };

  const now = new Date();
  const portfolioRow = {
    id: 'pf-1',
    workspaceId: 'ws-1',
    name: 'Roadmap',
    description: null,
    color: '#111',
    createdAt: now,
    updatedAt: now,
    items: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectService, useValue: projectService },
      ],
    }).compile();

    service = moduleRef.get(PortfolioService);
  });

  describe('create', () => {
    it('persists portfolio in workspace', async () => {
      prisma.portfolio.create.mockResolvedValue(portfolioRow);

      const dto = await service.create('ws-1', {
        name: 'Roadmap',
        description: 'Q1',
        color: '#111',
      });

      expect(prisma.portfolio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            workspaceId: 'ws-1',
            name: 'Roadmap',
            description: 'Q1',
            color: '#111',
          },
        }),
      );
      expect(dto.id).toBe('pf-1');
      expect(dto.workspaceId).toBe('ws-1');
    });
  });

  describe('addItem', () => {
    it('throws NotFound when portfolio missing in workspace', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      await expect(
        service.addItem('ws-1', 'pf-1', { projectId: 'p1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequest when project is not linked to workspace', async () => {
      prisma.portfolio.findFirst.mockResolvedValue({
        id: 'pf-1',
        workspaceId: 'ws-1',
      });
      prisma.projectWorkspace.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem('ws-1', 'pf-1', { projectId: 'p1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates item with next sortOrder and returns refreshed portfolio', async () => {
      prisma.portfolio.findFirst.mockResolvedValue({
        id: 'pf-1',
        workspaceId: 'ws-1',
      });
      prisma.projectWorkspace.findUnique.mockResolvedValue({
        projectId: 'p1',
        workspaceId: 'ws-1',
      });
      prisma.portfolioItem.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
      prisma.portfolioItem.create.mockResolvedValue({});
      const withItem = {
        ...portfolioRow,
        items: [
          {
            portfolioId: 'pf-1',
            projectId: 'p1',
            sortOrder: 3,
            addedAt: now,
            project: {
              id: 'p1',
              name: 'Proj',
              color: 'BLUE',
              createdById: 'u1',
              workspaceLinks: [{ workspaceId: 'ws-1' }],
              members: [],
              _count: { tasks: 1 },
            },
          },
        ],
      };
      prisma.portfolio.findFirst
        .mockResolvedValueOnce({ id: 'pf-1', workspaceId: 'ws-1' })
        .mockResolvedValueOnce(withItem);

      const dto = await service.addItem('ws-1', 'pf-1', { projectId: 'p1' });

      expect(prisma.portfolioItem.create).toHaveBeenCalledWith({
        data: { portfolioId: 'pf-1', projectId: 'p1', sortOrder: 3 },
      });
      expect(dto.items).toHaveLength(1);
      expect(projectService.toProjectDto).toHaveBeenCalled();
    });
  });

  describe('findByIdForUser', () => {
    it('returns null when portfolio does not exist', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(null);

      const dto = await service.findByIdForUser('missing', 'user-1');

      expect(dto).toBeNull();
    });

    it('throws Forbidden when user is not a workspace member', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRow);
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findByIdForUser('pf-1', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns dto when member', async () => {
      prisma.portfolio.findUnique.mockResolvedValue(portfolioRow);
      prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'wm' });

      const dto = await service.findByIdForUser('pf-1', 'user-1');

      expect(dto?.id).toBe('pf-1');
    });
  });

  describe('findByIdInWorkspace', () => {
    it('returns null when no portfolio in workspace', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      const dto = await service.findByIdInWorkspace('ws-1', 'pf-x');

      expect(dto).toBeNull();
    });

    it('returns mapped dto when found', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(portfolioRow);

      const dto = await service.findByIdInWorkspace('ws-1', 'pf-1');

      expect(dto?.id).toBe('pf-1');
    });
  });

  describe('update', () => {
    it('throws NotFound when portfolio missing', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      await expect(
        service.update('ws-1', 'pf-1', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates fields and returns dto', async () => {
      prisma.portfolio.findFirst.mockResolvedValue({ id: 'pf-1' });
      const updated = { ...portfolioRow, name: 'Renamed', items: [] };
      prisma.portfolio.update.mockResolvedValue(updated);

      const dto = await service.update('ws-1', 'pf-1', { name: 'Renamed' });

      expect(prisma.portfolio.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pf-1' },
          data: { name: 'Renamed' },
        }),
      );
      expect(dto.name).toBe('Renamed');
    });
  });

  describe('deleteInWorkspace', () => {
    it('throws NotFound when portfolio not in workspace', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteInWorkspace('ws-1', 'pf-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes portfolio', async () => {
      prisma.portfolio.findFirst.mockResolvedValue({ id: 'pf-1' });
      prisma.portfolio.delete.mockResolvedValue(portfolioRow);

      await service.deleteInWorkspace('ws-1', 'pf-1');

      expect(prisma.portfolio.delete).toHaveBeenCalledWith({ where: { id: 'pf-1' } });
    });
  });

  describe('removeItem', () => {
    it('throws NotFound when portfolio missing', async () => {
      prisma.portfolio.findFirst.mockResolvedValue(null);

      await expect(
        service.removeItem('ws-1', 'pf-1', 'p1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes portfolio item row', async () => {
      prisma.portfolio.findFirst.mockResolvedValue({ id: 'pf-1' });
      prisma.portfolioItem.delete.mockResolvedValue({});

      await service.removeItem('ws-1', 'pf-1', 'p1');

      expect(prisma.portfolioItem.delete).toHaveBeenCalledWith({
        where: { portfolioId_projectId: { portfolioId: 'pf-1', projectId: 'p1' } },
      });
    });
  });
});
