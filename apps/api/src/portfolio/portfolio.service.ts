import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ProjectService } from '../project/project.service';
import {
  PortfolioDto,
  CreatePortfolioRequest,
  UpdatePortfolioRequest,
  AddPortfolioItemRequest,
  PortfolioItemDto,
} from '@vineroot/shared-types';

const itemsInclude = {
  orderBy: { sortOrder: 'asc' as const },
  include: {
    project: {
      include: {
        workspaceLinks: { select: { workspaceId: true } },
        members: { include: { user: true } },
        _count: { select: { tasks: true } },
      },
    },
  },
} as const;

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    private projectService: ProjectService,
  ) {}

  async create(
    workspaceId: string,
    req: CreatePortfolioRequest,
  ): Promise<PortfolioDto> {
    const portfolio = await this.prisma.portfolio.create({
      data: {
        workspaceId,
        name: req.name,
        description: req.description,
        color: req.color,
      },
      include: { items: itemsInclude },
    });
    return this.portfolioToDto(portfolio as any);
  }

  async listByWorkspace(workspaceId: string): Promise<PortfolioDto[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { workspaceId },
      include: { items: itemsInclude },
      orderBy: { updatedAt: 'desc' },
    });
    return portfolios.map((p) => this.portfolioToDto(p as any));
  }

  async findByIdInWorkspace(
    workspaceId: string,
    id: string,
  ): Promise<PortfolioDto | null> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id, workspaceId },
      include: { items: itemsInclude },
    });
    if (!portfolio) return null;
    return this.portfolioToDto(portfolio as any);
  }

  /** Load portfolio by id if the user is a member of its workspace. */
  async findByIdForUser(
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioDto | null> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { items: itemsInclude },
    });
    if (!portfolio) return null;
    const m = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: portfolio.workspaceId,
          userId,
        },
      },
    });
    if (!m) {
      throw new ForbiddenException('You do not have access to this portfolio');
    }
    return this.portfolioToDto(portfolio as any);
  }

  async update(
    workspaceId: string,
    id: string,
    req: UpdatePortfolioRequest,
  ): Promise<PortfolioDto> {
    const existing = await this.prisma.portfolio.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Portfolio not found');
    }
    const portfolio = await this.prisma.portfolio.update({
      where: { id },
      data: req,
      include: { items: itemsInclude },
    });
    return this.portfolioToDto(portfolio as any);
  }

  async deleteInWorkspace(workspaceId: string, id: string): Promise<void> {
    const existing = await this.prisma.portfolio.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Portfolio not found');
    }
    await this.prisma.portfolio.delete({ where: { id } });
  }

  async addItem(
    workspaceId: string,
    portfolioId: string,
    req: AddPortfolioItemRequest,
  ): Promise<PortfolioDto> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, workspaceId },
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }

    const link = await this.prisma.projectWorkspace.findUnique({
      where: {
        projectId_workspaceId: {
          projectId: req.projectId,
          workspaceId: portfolio.workspaceId,
        },
      },
    });
    if (!link) {
      throw new BadRequestException(
        'Project must be linked to this workspace before it can be added to a portfolio',
      );
    }

    const maxOrder = await this.prisma.portfolioItem.aggregate({
      where: { portfolioId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    await this.prisma.portfolioItem.create({
      data: {
        portfolioId,
        projectId: req.projectId,
        sortOrder: nextOrder,
      },
    });

    const updated = await this.findByIdInWorkspace(workspaceId, portfolioId);
    if (!updated) throw new NotFoundException('Portfolio not found');
    return updated;
  }

  async removeItem(
    workspaceId: string,
    portfolioId: string,
    projectId: string,
  ): Promise<void> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, workspaceId },
    });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
    await this.prisma.portfolioItem.delete({
      where: { portfolioId_projectId: { portfolioId, projectId } },
    });
  }

  private portfolioToDto(portfolio: any): PortfolioDto {
    const items: PortfolioItemDto[] | undefined = portfolio.items?.map(
      (it: any) => ({
        portfolioId: it.portfolioId,
        projectId: it.projectId,
        sortOrder: it.sortOrder,
        addedAt: it.addedAt,
        project: it.project
          ? this.projectService.toProjectDto(it.project)
          : undefined,
      }),
    );

    return {
      id: portfolio.id,
      workspaceId: portfolio.workspaceId,
      name: portfolio.name,
      description: portfolio.description,
      color: portfolio.color,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
      itemCount: items?.length ?? portfolio.items?.length ?? 0,
      items,
    };
  }
}
