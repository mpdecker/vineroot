import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ScheduleProjectService } from './schedule-project.service';
import type {
  AddProjectToScheduleProgramRequest,
  CreateScheduleProgramRequest,
  ScheduleProgramDto,
  ScheduleProgramRollupDto,
  ScheduleProgramRollupProjectRowDto,
} from '@vineroot/shared-types';

@Injectable()
export class ScheduleProgramService {
  constructor(
    private prisma: PrismaService,
    private scheduleProject: ScheduleProjectService,
  ) {}

  async list(workspaceId: string, userId: string): Promise<ScheduleProgramDto[]> {
    await this.assertMember(userId, workspaceId);
    const rows = await this.prisma.scheduleProgram.findMany({
      where: { workspaceId },
      include: { projects: { select: { projectId: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      projectIds: r.projects.map((p) => p.projectId),
    }));
  }

  async create(
    workspaceId: string,
    userId: string,
    body: CreateScheduleProgramRequest,
  ): Promise<ScheduleProgramDto> {
    await this.assertMember(userId, workspaceId);
    const r = await this.prisma.scheduleProgram.create({
      data: { workspaceId, name: body.name },
    });
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      projectIds: [],
    };
  }

  async addProject(
    programId: string,
    userId: string,
    body: AddProjectToScheduleProgramRequest,
  ): Promise<ScheduleProgramDto> {
    const prog = await this.prisma.scheduleProgram.findUnique({
      where: { id: programId },
    });
    if (!prog) throw new NotFoundException('Program not found');
    await this.assertMember(userId, prog.workspaceId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: body.projectId,
        deletedAt: null,
        workspaceLinks: { some: { workspaceId: prog.workspaceId } },
      },
    });
    if (!project) {
      throw new BadRequestException(
        'Project not found or not linked to this program workspace',
      );
    }

    await this.prisma.scheduleProgramProject.upsert({
      where: {
        programId_projectId: { programId, projectId: body.projectId },
      },
      create: { programId, projectId: body.projectId },
      update: {},
    });

    return this.findById(programId, userId);
  }

  async removeProject(
    programId: string,
    projectId: string,
    userId: string,
  ): Promise<ScheduleProgramDto> {
    const prog = await this.prisma.scheduleProgram.findUnique({
      where: { id: programId },
    });
    if (!prog) throw new NotFoundException('Program not found');
    await this.assertMember(userId, prog.workspaceId);
    await this.prisma.scheduleProgramProject.deleteMany({
      where: { programId, projectId },
    });
    return this.findById(programId, userId);
  }

  async findById(programId: string, userId: string): Promise<ScheduleProgramDto> {
    const r = await this.prisma.scheduleProgram.findUnique({
      where: { id: programId },
      include: { projects: { select: { projectId: true } } },
    });
    if (!r) throw new NotFoundException('Program not found');
    await this.assertMember(userId, r.workspaceId);
    return {
      id: r.id,
      workspaceId: r.workspaceId,
      name: r.name,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      projectIds: r.projects.map((p) => p.projectId),
    };
  }

  /**
   * Aggregated schedule roll-up for all linked projects: date span, critical tasks per project,
   * and program-level bounds. Skips projects the user cannot open (same as CPM access).
   */
  async scheduleRollup(
    programId: string,
    userId: string,
  ): Promise<ScheduleProgramRollupDto> {
    const prog = await this.findById(programId, userId);
    const projectIds = prog.projectIds ?? [];
    const projects: ScheduleProgramRollupProjectRowDto[] = [];

    for (const projectId of projectIds) {
      try {
        const cp = await this.scheduleProject.getCriticalPath(projectId, userId);
        const p = await this.prisma.project.findFirst({
          where: { id: projectId, deletedAt: null },
          select: { name: true, startDate: true, dueDate: true },
        });
        const agg = await this.prisma.task.aggregate({
          where: {
            projectId,
            deletedAt: null,
            isTemplate: false,
          },
          _min: { startDate: true },
          _max: { dueDate: true },
        });
        const earliestStart =
          agg._min.startDate ?? p?.startDate ?? null;
        const latestFinish = agg._max.dueDate ?? p?.dueDate ?? null;

        projects.push({
          projectId,
          projectName: p?.name ?? projectId,
          earliestStart: earliestStart
            ? earliestStart.toISOString()
            : null,
          latestFinish: latestFinish ? latestFinish.toISOString() : null,
          criticalTaskCount: cp.criticalTaskIds.length,
          criticalTaskIds: cp.criticalTaskIds,
        });
      } catch (e) {
        if (e instanceof NotFoundException) continue;
        throw e;
      }
    }

    let programEarliestStart: string | null = null;
    let programLatestFinish: string | null = null;
    for (const row of projects) {
      if (row.earliestStart) {
        if (
          !programEarliestStart ||
          row.earliestStart < programEarliestStart
        ) {
          programEarliestStart = row.earliestStart;
        }
      }
      if (row.latestFinish) {
        if (
          !programLatestFinish ||
          row.latestFinish > programLatestFinish
        ) {
          programLatestFinish = row.latestFinish;
        }
      }
    }

    return {
      programId,
      projects,
      programEarliestStart,
      programLatestFinish,
    };
  }

  /** Returns program id if both projects are in the same schedule program (same workspace). */
  async findSharedProgramForProjects(
    projectIdA: string,
    projectIdB: string,
  ): Promise<string | null> {
    if (projectIdA === projectIdB) return null;
    const links = await this.prisma.scheduleProgramProject.findMany({
      where: { projectId: { in: [projectIdA, projectIdB] } },
    });
    const byProg = new Map<string, Set<string>>();
    for (const l of links) {
      if (!byProg.has(l.programId)) byProg.set(l.programId, new Set());
      byProg.get(l.programId)!.add(l.projectId);
    }
    for (const [pid, set] of byProg) {
      if (set.has(projectIdA) && set.has(projectIdB)) return pid;
    }
    return null;
  }

  private async assertMember(userId: string, workspaceId: string) {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) throw new ForbiddenException('Not a workspace member');
  }
}
