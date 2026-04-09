import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import type {
  WorkspaceReportingSummaryDto,
  WorkspaceReportingFilters,
  ReportingSavedViewDto,
  CreateReportingSavedViewRequest,
  UpdateReportingSavedViewRequest,
} from '@vineroot/shared-types';
import {
  computeWorkspaceReportingSummary,
  summaryToCsv,
} from './workspace-reporting.util';

@Injectable()
export class ReportingService {
  constructor(private prisma: PrismaService) {}

  async workspaceSummary(
    workspaceId: string,
    filters?: WorkspaceReportingFilters,
  ): Promise<WorkspaceReportingSummaryDto> {
    return computeWorkspaceReportingSummary(this.prisma, workspaceId, filters);
  }

  summaryToCsvString(summary: WorkspaceReportingSummaryDto): string {
    return summaryToCsv(summary);
  }

  private savedViewToDto(row: {
    id: string;
    workspaceId: string;
    createdById: string;
    name: string;
    sortOrder: number;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): ReportingSavedViewDto {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      createdById: row.createdById,
      name: row.name,
      sortOrder: row.sortOrder,
      config: (row.config ?? {}) as ReportingSavedViewDto['config'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listSavedViews(workspaceId: string): Promise<ReportingSavedViewDto[]> {
    const rows = await this.prisma.reportingSavedView.findMany({
      where: { workspaceId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => this.savedViewToDto(r));
  }

  async createSavedView(
    workspaceId: string,
    userId: string,
    req: CreateReportingSavedViewRequest,
  ): Promise<ReportingSavedViewDto> {
    const row = await this.prisma.reportingSavedView.create({
      data: {
        workspaceId,
        createdById: userId,
        name: req.name.trim(),
        sortOrder: req.sortOrder ?? 0,
        config: (req.config ?? {}) as object,
      },
    });
    return this.savedViewToDto(row);
  }

  async updateSavedView(
    workspaceId: string,
    viewId: string,
    req: UpdateReportingSavedViewRequest,
  ): Promise<ReportingSavedViewDto> {
    const existing = await this.prisma.reportingSavedView.findFirst({
      where: { id: viewId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Saved view not found');
    }
    const data: {
      name?: string;
      sortOrder?: number;
      config?: object;
    } = {};
    if (req.name !== undefined) data.name = req.name.trim();
    if (req.sortOrder !== undefined) data.sortOrder = req.sortOrder;
    if (req.config !== undefined) data.config = req.config as object;
    const row = await this.prisma.reportingSavedView.update({
      where: { id: viewId },
      data,
    });
    return this.savedViewToDto(row);
  }

  async deleteSavedView(workspaceId: string, viewId: string): Promise<void> {
    const existing = await this.prisma.reportingSavedView.findFirst({
      where: { id: viewId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Saved view not found');
    }
    await this.prisma.reportingSavedView.delete({ where: { id: viewId } });
  }
}
