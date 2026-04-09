import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import type {
  CreateWorkCalendarRequest,
  UpdateWorkCalendarRequest,
  WorkCalendarDto,
} from '@vineroot/shared-types';
import { defaultWeeklyPattern } from './schedule-calendar.util';

@Injectable()
export class WorkCalendarService {
  constructor(private prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    workspaceId: string;
    name: string;
    timeZone: string;
    weeklyPattern: unknown;
    exceptions: unknown;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): WorkCalendarDto {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      timeZone: row.timeZone,
      weeklyPattern: (row.weeklyPattern as Record<string, number>) ?? defaultWeeklyPattern(),
      exceptions: (row.exceptions as WorkCalendarDto['exceptions']) ?? [],
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async assertMember(userId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) throw new ForbiddenException('Not a workspace member');
  }

  private async assertWorkspaceAdmin(userId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m || (m.role !== 'OWNER' && m.role !== 'ADMIN')) {
      throw new ForbiddenException('Workspace owner or admin required');
    }
  }

  private async clearDefaultsInWorkspace(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    exceptCalendarId?: string,
  ) {
    await tx.workCalendar.updateMany({
      where: {
        workspaceId,
        ...(exceptCalendarId ? { id: { not: exceptCalendarId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  async listWorkspaceCalendars(
    workspaceId: string,
    userId: string,
  ): Promise<WorkCalendarDto[]> {
    await this.assertMember(userId, workspaceId);
    const rows = await this.prisma.workCalendar.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    workspaceId: string,
    userId: string,
    body: CreateWorkCalendarRequest,
  ): Promise<WorkCalendarDto> {
    await this.assertWorkspaceAdmin(userId, workspaceId);
    const isDefault = body.isDefault ?? false;
    const row = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await this.clearDefaultsInWorkspace(tx, workspaceId);
      }
      return tx.workCalendar.create({
        data: {
          workspaceId,
          name: body.name,
          timeZone: body.timeZone ?? 'UTC',
          weeklyPattern: (body.weeklyPattern ?? defaultWeeklyPattern()) as object,
          exceptions: (body.exceptions ?? []) as object,
          isDefault,
        },
      });
    });
    return this.toDto(row);
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<WorkCalendarDto> {
    const row = await this.prisma.workCalendar.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Calendar not found');
    await this.assertMember(userId, row.workspaceId);
    return this.toDto(row);
  }

  async update(
    id: string,
    userId: string,
    body: UpdateWorkCalendarRequest,
  ): Promise<WorkCalendarDto> {
    const row = await this.prisma.workCalendar.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Calendar not found');
    await this.assertWorkspaceAdmin(userId, row.workspaceId);

    const next = await this.prisma.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await this.clearDefaultsInWorkspace(tx, row.workspaceId, id);
      }
      return tx.workCalendar.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.timeZone !== undefined && { timeZone: body.timeZone }),
          ...(body.weeklyPattern !== undefined && {
            weeklyPattern: body.weeklyPattern as object,
          }),
          ...(body.exceptions !== undefined && {
            exceptions: body.exceptions as object,
          }),
          ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
        },
      });
    });
    return this.toDto(next);
  }

  async delete(id: string, userId: string): Promise<void> {
    const row = await this.prisma.workCalendar.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Calendar not found');
    await this.assertWorkspaceAdmin(userId, row.workspaceId);
    await this.prisma.workCalendar.delete({ where: { id } });
  }
}
