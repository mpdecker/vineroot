import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { buildProjectCfdSeries } from '../project/project-cfd.util';
import {
  resolvePortfolioActiveSprints,
  resolvePortfolioSprintVelocity,
} from './portfolio-sprint-widgets.util';
import type {
  DashboardDto,
  DashboardWidgetDto,
  DashboardWidgetType,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  CreateDashboardWidgetRequest,
  UpdateDashboardWidgetRequest,
} from '@vineroot/shared-types';

const WIDGET_TYPES: DashboardWidgetType[] = [
  'TASKS_BY_STATUS',
  'PROJECT_SUMMARY',
  'PROJECT_CFD',
  'PORTFOLIO_ACTIVE_SPRINTS',
  'PORTFOLIO_SPRINT_VELOCITY',
  'NUMBER_METRIC',
  'AGENT_SLOT',
  'TEXT_NOTE',
];

const widgetsOrdered = { orderBy: { sortOrder: 'asc' as const } } as const;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private assertWidgetType(t: string): asserts t is DashboardWidgetType {
    if (!WIDGET_TYPES.includes(t as DashboardWidgetType)) {
      throw new BadRequestException(
        `Invalid widget type. Allowed: ${WIDGET_TYPES.join(', ')}`,
      );
    }
  }

  private widgetToDto(w: any, resolved?: Record<string, unknown>): DashboardWidgetDto {
    return {
      id: w.id,
      dashboardId: w.dashboardId,
      type: w.type as DashboardWidgetType,
      title: w.title,
      sortOrder: w.sortOrder,
      gridX: w.gridX,
      gridY: w.gridY,
      gridW: w.gridW,
      gridH: w.gridH,
      config: (w.config as Record<string, unknown>) ?? {},
      ...(resolved !== undefined ? { resolved } : {}),
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }

  private dashboardToDto(d: any, includeWidgets = false): DashboardDto {
    const widgets = d.widgets as any[] | undefined;
    const widgetCount = widgets?.length ?? d._count?.widgets ?? 0;
    return {
      id: d.id,
      workspaceId: d.workspaceId,
      name: d.name,
      description: d.description ?? undefined,
      color: d.color ?? undefined,
      createdById: d.createdById,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      layoutMeta: (d.layoutMeta as Record<string, unknown>) ?? undefined,
      widgetCount,
      ...(includeWidgets && widgets?.length
        ? { widgets: widgets.map((w) => this.widgetToDto(w)) }
        : {}),
    };
  }

  async list(workspaceId: string): Promise<DashboardDto[]> {
    const rows = await this.prisma.dashboard.findMany({
      where: { workspaceId },
      include: { _count: { select: { widgets: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((d) => this.dashboardToDto(d, false));
  }

  async create(
    workspaceId: string,
    userId: string,
    req: CreateDashboardRequest,
  ): Promise<DashboardDto> {
    const d = await this.prisma.dashboard.create({
      data: {
        workspaceId,
        createdById: userId,
        name: req.name,
        description: req.description,
        color: req.color,
        layoutMeta: req.layoutMeta === undefined ? undefined : (req.layoutMeta as object),
      },
      include: { widgets: widgetsOrdered },
    });
    return this.dashboardToDto(d, false);
  }

  async findByIdInWorkspace(
    workspaceId: string,
    id: string,
    withResolved: boolean,
  ): Promise<DashboardDto | null> {
    const d = await this.prisma.dashboard.findFirst({
      where: { id, workspaceId },
      include: { widgets: widgetsOrdered },
    });
    if (!d) return null;
    if (!withResolved) {
      return this.dashboardToDto(d, true);
    }
    const widgets: DashboardWidgetDto[] = [];
    for (const w of d.widgets) {
      const resolved = await this.resolveWidget(workspaceId, w.type, w.config);
      widgets.push(this.widgetToDto(w, resolved));
    }
    const base = this.dashboardToDto(d, false);
    return { ...base, widgets, widgetCount: widgets.length };
  }

  async update(
    workspaceId: string,
    id: string,
    req: UpdateDashboardRequest,
  ): Promise<DashboardDto> {
    const existing = await this.prisma.dashboard.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException('Dashboard not found');
    const d = await this.prisma.dashboard.update({
      where: { id },
      data: {
        ...(req.name !== undefined && { name: req.name }),
        ...(req.description !== undefined && { description: req.description }),
        ...(req.color !== undefined && { color: req.color }),
        ...(req.layoutMeta !== undefined && {
          layoutMeta: req.layoutMeta as object,
        }),
      },
      include: { widgets: widgetsOrdered },
    });
    return this.dashboardToDto(d, true);
  }

  async deleteInWorkspace(workspaceId: string, id: string): Promise<void> {
    const existing = await this.prisma.dashboard.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException('Dashboard not found');
    await this.prisma.dashboard.delete({ where: { id } });
  }

  async addWidget(
    workspaceId: string,
    dashboardId: string,
    req: CreateDashboardWidgetRequest,
  ): Promise<DashboardWidgetDto> {
    await this.ensureDashboard(workspaceId, dashboardId);
    this.assertWidgetType(req.type);
    const w = await this.prisma.dashboardWidget.create({
      data: {
        dashboardId,
        type: req.type,
        title: req.title,
        sortOrder: req.sortOrder ?? 0,
        gridX: req.gridX ?? 0,
        gridY: req.gridY ?? 0,
        gridW: req.gridW ?? 4,
        gridH: req.gridH ?? 2,
        config: (req.config ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.widgetToDto(w);
  }

  async updateWidget(
    workspaceId: string,
    dashboardId: string,
    widgetId: string,
    req: UpdateDashboardWidgetRequest,
  ): Promise<DashboardWidgetDto> {
    await this.ensureDashboard(workspaceId, dashboardId);
    const w = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
    });
    if (!w) throw new NotFoundException('Widget not found');
    const next = await this.prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: {
        ...(req.title !== undefined && { title: req.title }),
        ...(req.sortOrder !== undefined && { sortOrder: req.sortOrder }),
        ...(req.gridX !== undefined && { gridX: req.gridX }),
        ...(req.gridY !== undefined && { gridY: req.gridY }),
        ...(req.gridW !== undefined && { gridW: req.gridW }),
        ...(req.gridH !== undefined && { gridH: req.gridH }),
        ...(req.config !== undefined && {
          config: req.config as Prisma.InputJsonValue,
        }),
      },
    });
    return this.widgetToDto(next);
  }

  async removeWidget(
    workspaceId: string,
    dashboardId: string,
    widgetId: string,
  ): Promise<void> {
    await this.ensureDashboard(workspaceId, dashboardId);
    const w = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, dashboardId },
    });
    if (!w) throw new NotFoundException('Widget not found');
    await this.prisma.dashboardWidget.delete({ where: { id: widgetId } });
  }

  private async ensureDashboard(
    workspaceId: string,
    dashboardId: string,
  ): Promise<void> {
    const d = await this.prisma.dashboard.findFirst({
      where: { id: dashboardId, workspaceId },
    });
    if (!d) throw new NotFoundException('Dashboard not found');
  }

  private async resolveWidget(
    workspaceId: string,
    type: string,
    configJson: unknown,
  ): Promise<Record<string, unknown>> {
    const config =
      configJson && typeof configJson === 'object'
        ? (configJson as Record<string, unknown>)
        : {};

    switch (type) {
      case 'TASKS_BY_STATUS': {
        const projectIds = config.projectIds as string[] | undefined;
        const where: Prisma.TaskWhereInput = {
          deletedAt: null,
        };
        if (projectIds?.length) {
          where.AND = [
            { projectId: { in: projectIds } },
            {
              project: {
                workspaceLinks: { some: { workspaceId } },
                deletedAt: null,
              },
            },
          ];
        } else {
          where.OR = [
            { workspaceId },
            {
              project: {
                workspaceLinks: { some: { workspaceId } },
                deletedAt: null,
              },
            },
          ];
        }
        const rows = await this.prisma.task.groupBy({
          by: ['status'],
          where,
          _count: { _all: true },
        });
        return {
          buckets: rows.map((r) => ({
            status: r.status,
            count: r._count._all,
          })),
        };
      }
      case 'PROJECT_SUMMARY': {
        const projectId = config.projectId as string | undefined;
        if (!projectId) {
          return { error: 'Add projectId in widget config' };
        }
        const p = await this.prisma.project.findFirst({
          where: {
            id: projectId,
            deletedAt: null,
            workspaceLinks: { some: { workspaceId } },
          },
          include: {
            _count: {
              select: {
                tasks: { where: { deletedAt: null } },
              },
            },
          },
        });
        if (!p) return { error: 'Project not found in workspace' };
        const completed = await this.prisma.task.count({
          where: {
            projectId,
            deletedAt: null,
            status: 'DONE',
          },
        });
        const total = p._count.tasks;
        return {
          projectId: p.id,
          projectName: p.name,
          totalTasks: total,
          completedTasks: completed,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      }
      case 'PROJECT_CFD': {
        const projectId = config.projectId as string | undefined;
        if (!projectId) {
          return { error: 'Add projectId in widget config' };
        }
        const p = await this.prisma.project.findFirst({
          where: {
            id: projectId,
            deletedAt: null,
            workspaceLinks: { some: { workspaceId } },
          },
        });
        if (!p) return { error: 'Project not found in workspace' };
        const to = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - 89);
        const { days, statusOrder } = await buildProjectCfdSeries(
          this.prisma,
          projectId,
          from,
          to,
        );
        return { projectId, days, statusOrder };
      }
      case 'PORTFOLIO_ACTIVE_SPRINTS': {
        const portfolioId = config.portfolioId as string | undefined;
        if (!portfolioId) {
          return { error: 'Add portfolioId in widget config' };
        }
        const out = await resolvePortfolioActiveSprints(
          this.prisma,
          workspaceId,
          portfolioId,
        );
        return { ...out } as Record<string, unknown>;
      }
      case 'PORTFOLIO_SPRINT_VELOCITY': {
        const portfolioId = config.portfolioId as string | undefined;
        if (!portfolioId) {
          return { error: 'Add portfolioId in widget config' };
        }
        const takeRaw = Number(config.take ?? 6);
        const out = await resolvePortfolioSprintVelocity(
          this.prisma,
          workspaceId,
          portfolioId,
          Number.isFinite(takeRaw) ? takeRaw : 6,
        );
        return { ...out } as Record<string, unknown>;
      }
      case 'NUMBER_METRIC':
        return {
          value: Number(config.value ?? 0),
          label: String(config.label ?? 'Metric'),
        };
      case 'AGENT_SLOT':
        return {
          state: 'ready',
          slotKey: String(config.slotKey ?? 'default'),
          hint:
            String(
              config.description ??
                'Reserved for agent-generated KPIs, narratives, and alerts.',
            ),
        };
      case 'TEXT_NOTE':
        return { body: String(config.body ?? '') };
      default:
        return {};
    }
  }
}
