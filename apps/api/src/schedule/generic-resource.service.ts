import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import type {
  CreateGenericResourceRequest,
  GenericResourceDto,
  UpdateGenericResourceRequest,
} from '@vineroot/shared-types';

const MAX_UNITS = 10_000;

@Injectable()
export class GenericResourceService {
  constructor(private prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    workspaceId: string;
    name: string;
    maxUnitsPercent: number;
    standardRatePerHour: Prisma.Decimal | null;
    workCalendarId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): GenericResourceDto {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      maxUnitsPercent: row.maxUnitsPercent,
      standardRatePerHour:
        row.standardRatePerHour != null ? Number(row.standardRatePerHour) : null,
      workCalendarId: row.workCalendarId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** undefined = omit; null = clear. */
  private async resolveOptionalResourceWorkCalendarId(
    workspaceId: string,
    workCalendarId: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (workCalendarId === undefined) return undefined;
    if (workCalendarId === null) return null;
    const cal = await this.prisma.workCalendar.findFirst({
      where: { id: workCalendarId, workspaceId },
    });
    if (!cal) {
      throw new BadRequestException(
        'workCalendarId must reference a work calendar in this workspace',
      );
    }
    return cal.id;
  }

  private optionalHourlyRate(
    v: number | null | undefined,
  ): Prisma.Decimal | null | undefined {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (!Number.isFinite(v) || v < 0) {
      throw new BadRequestException('standardRatePerHour must be a non-negative number');
    }
    return new Prisma.Decimal(v);
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

  private normalizeMaxUnits(n: number): number {
    if (!Number.isFinite(n) || n <= 0 || n > MAX_UNITS) {
      throw new BadRequestException(
        `maxUnitsPercent must be between 0 exclusive and ${MAX_UNITS}`,
      );
    }
    return n;
  }

  async list(
    workspaceId: string,
    userId: string,
  ): Promise<GenericResourceDto[]> {
    await this.assertMember(userId, workspaceId);
    const rows = await this.prisma.genericResource.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(
    workspaceId: string,
    userId: string,
    body: CreateGenericResourceRequest,
  ): Promise<GenericResourceDto> {
    await this.assertWorkspaceAdmin(userId, workspaceId);
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const maxUnits = this.normalizeMaxUnits(body.maxUnitsPercent ?? 100);
    const rate = this.optionalHourlyRate(body.standardRatePerHour);
    const calId = await this.resolveOptionalResourceWorkCalendarId(
      workspaceId,
      body.workCalendarId,
    );
    const row = await this.prisma.genericResource.create({
      data: {
        workspaceId,
        name,
        maxUnitsPercent: maxUnits,
        ...(rate !== undefined ? { standardRatePerHour: rate } : {}),
        ...(calId !== undefined && calId !== null ? { workCalendarId: calId } : {}),
      },
    });
    return this.toDto(row);
  }

  async findById(
    resourceId: string,
    userId: string,
  ): Promise<GenericResourceDto> {
    const row = await this.prisma.genericResource.findUnique({
      where: { id: resourceId },
    });
    if (!row) throw new NotFoundException('Generic resource not found');
    await this.assertMember(userId, row.workspaceId);
    return this.toDto(row);
  }

  async update(
    resourceId: string,
    userId: string,
    body: UpdateGenericResourceRequest,
  ): Promise<GenericResourceDto> {
    const row = await this.prisma.genericResource.findUnique({
      where: { id: resourceId },
    });
    if (!row) throw new NotFoundException('Generic resource not found');
    await this.assertWorkspaceAdmin(userId, row.workspaceId);
    const data: {
      name?: string;
      maxUnitsPercent?: number;
      standardRatePerHour?: Prisma.Decimal | null;
      workCalendarId?: string | null;
    } = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('name cannot be empty');
      data.name = name;
    }
    if (body.maxUnitsPercent !== undefined) {
      data.maxUnitsPercent = this.normalizeMaxUnits(body.maxUnitsPercent);
    }
    if (body.standardRatePerHour !== undefined) {
      data.standardRatePerHour = this.optionalHourlyRate(
        body.standardRatePerHour,
      ) as Prisma.Decimal | null;
    }
    if (body.workCalendarId !== undefined) {
      data.workCalendarId = await this.resolveOptionalResourceWorkCalendarId(
        row.workspaceId,
        body.workCalendarId,
      );
    }
    if (Object.keys(data).length === 0) {
      return this.toDto(row);
    }
    const next = await this.prisma.genericResource.update({
      where: { id: resourceId },
      data,
    });
    return this.toDto(next);
  }

  async delete(resourceId: string, userId: string): Promise<void> {
    const row = await this.prisma.genericResource.findUnique({
      where: { id: resourceId },
    });
    if (!row) throw new NotFoundException('Generic resource not found');
    await this.assertWorkspaceAdmin(userId, row.workspaceId);
    await this.prisma.genericResource.delete({ where: { id: resourceId } });
  }
}
