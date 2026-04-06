import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../common/prisma.service';
import { pmHttpError } from './pm.errors';
import type {
  PmProjectDto,
  PmTaskDto,
  PmTaskDetailDto,
  PmTaskArtifactDto,
  PmTaskRunDto,
  PmTaskDependencyRowDto,
  PmHumanGateDto,
  PmAuditLogDto,
} from '@vineroot/shared-types';
import type {
  PmPatchTaskStatusDto,
  PmCreateTaskArtifactDto,
  PmTasksBatchDto,
  PmCreateHumanGateDto,
  PmResolveHumanGateDto,
  PmPatchProjectStatusDto,
  PmAppendAuditDto,
} from './dto/pm.dto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(id: string, label = 'id'): void {
  if (!UUID_RE.test(id)) {
    throw pmHttpError(`Invalid ${label}`, 'INVALID_UUID');
  }
}

/** Raw row from get_ready_tasks() — Postgres lowercases unquoted identifiers */
type RawPmTaskRow = {
  id: string;
  project_id: string;
  phase: number;
  implementation_phase: string | null;
  title: string;
  description: string;
  actor_tier: string;
  domain: string;
  complexity: string;
  estimated_minutes: number;
  timeout_minutes: number;
  parallel_group: string | null;
  status: string;
  priority: number;
  review_gate: string;
  acceptance_criteria: unknown;
  context_refs: unknown;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class PmService {
  constructor(private readonly prisma: PrismaService) {}

  private rowToTaskDto(row: RawPmTaskRow): PmTaskDto {
    return {
      id: row.id,
      project_id: row.project_id,
      phase: row.phase,
      implementation_phase: row.implementation_phase,
      title: row.title,
      description: row.description,
      actor_tier: row.actor_tier,
      domain: row.domain,
      complexity: row.complexity,
      estimated_minutes: row.estimated_minutes,
      timeout_minutes: row.timeout_minutes,
      parallel_group: row.parallel_group,
      status: row.status,
      priority: row.priority,
      review_gate: row.review_gate,
      acceptance_criteria: Array.isArray(row.acceptance_criteria)
        ? row.acceptance_criteria
        : [],
      context_refs: Array.isArray(row.context_refs) ? row.context_refs : [],
      notes: row.notes,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  private prismaTaskToDto(t: {
    id: string;
    projectId: string;
    phase: number;
    implementationPhase: string | null;
    title: string;
    description: string;
    actorTier: string;
    domain: string;
    complexity: string;
    estimatedMinutes: number;
    timeoutMinutes: number;
    parallelGroup: string | null;
    status: string;
    priority: number;
    reviewGate: string;
    acceptanceCriteria: Prisma.JsonValue;
    contextRefs: Prisma.JsonValue;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): PmTaskDto {
    return {
      id: t.id,
      project_id: t.projectId,
      phase: t.phase,
      implementation_phase: t.implementationPhase,
      title: t.title,
      description: t.description,
      actor_tier: t.actorTier,
      domain: t.domain,
      complexity: t.complexity,
      estimated_minutes: t.estimatedMinutes,
      timeout_minutes: t.timeoutMinutes,
      parallel_group: t.parallelGroup,
      status: t.status,
      priority: t.priority,
      review_gate: t.reviewGate,
      acceptance_criteria: Array.isArray(t.acceptanceCriteria)
        ? t.acceptanceCriteria
        : [],
      context_refs: Array.isArray(t.contextRefs) ? t.contextRefs : [],
      notes: t.notes,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    };
  }

  private prismaProjectToDto(p: {
    id: string;
    slug: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    ideaBriefPath: string | null;
    planPath: string | null;
    designDocPath: string | null;
    repoUrl: string | null;
    metadata: Prisma.JsonValue;
  }): PmProjectDto {
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      status: p.status,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
      idea_brief_path: p.ideaBriefPath,
      plan_path: p.planPath,
      design_doc_path: p.designDocPath,
      repo_url: p.repoUrl,
      metadata:
        typeof p.metadata === 'object' && p.metadata !== null && !Array.isArray(p.metadata)
          ? (p.metadata as Record<string, unknown>)
          : {},
    };
  }

  private artifactToDto(a: {
    id: string;
    taskId: string;
    artifactType: string;
    name: string;
    path: string | null;
    url: string | null;
    content: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }): PmTaskArtifactDto {
    return {
      id: a.id,
      task_id: a.taskId,
      artifact_type: a.artifactType,
      name: a.name,
      path: a.path,
      url: a.url,
      content: a.content,
      metadata:
        typeof a.metadata === 'object' && a.metadata !== null && !Array.isArray(a.metadata)
          ? (a.metadata as Record<string, unknown>)
          : {},
      created_at: a.createdAt.toISOString(),
    };
  }

  private runToDto(r: {
    id: string;
    taskId: string;
    runNumber: number;
    actorTier: string;
    actorDetail: string | null;
    startedAt: Date;
    completedAt: Date | null;
    outcome: string | null;
    failureReason: string | null;
    outputSummary: string | null;
    artifactIds: Prisma.JsonValue;
  }): PmTaskRunDto {
    return {
      id: r.id,
      task_id: r.taskId,
      run_number: r.runNumber,
      actor_tier: r.actorTier,
      actor_detail: r.actorDetail,
      started_at: r.startedAt.toISOString(),
      completed_at: r.completedAt?.toISOString() ?? null,
      outcome: r.outcome,
      failure_reason: r.failureReason,
      output_summary: r.outputSummary,
      artifact_ids: Array.isArray(r.artifactIds) ? r.artifactIds : [],
    };
  }

  private gateToDto(g: {
    id: string;
    projectId: string;
    gateType: string;
    originatingTaskId: string | null;
    blockingTaskId: string | null;
    contextSummary: string;
    failureHistory: Prisma.JsonValue;
    decisionOptions: Prisma.JsonValue;
    recommendedOption: string | null;
    decision: string | null;
    decisionNotes: string | null;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
    ageAlertSent: boolean;
  }): PmHumanGateDto {
    return {
      id: g.id,
      project_id: g.projectId,
      gate_type: g.gateType,
      originating_task_id: g.originatingTaskId,
      blocking_task_id: g.blockingTaskId,
      context_summary: g.contextSummary,
      failure_history: Array.isArray(g.failureHistory) ? g.failureHistory : [],
      decision_options: Array.isArray(g.decisionOptions) ? g.decisionOptions : [],
      recommended_option: g.recommendedOption,
      decision: g.decision,
      decision_notes: g.decisionNotes,
      status: g.status,
      created_at: g.createdAt.toISOString(),
      resolved_at: g.resolvedAt?.toISOString() ?? null,
      age_alert_sent: g.ageAlertSent,
    };
  }

  private auditToDto(a: {
    id: string;
    projectId: string | null;
    taskId: string | null;
    gateId: string | null;
    eventType: string;
    actor: string | null;
    fromValue: string | null;
    toValue: string | null;
    detail: Prisma.JsonValue;
    createdAt: Date;
  }): PmAuditLogDto {
    return {
      id: a.id,
      project_id: a.projectId,
      task_id: a.taskId,
      gate_id: a.gateId,
      event_type: a.eventType,
      actor: a.actor,
      from_value: a.fromValue,
      to_value: a.toValue,
      detail:
        typeof a.detail === 'object' && a.detail !== null && !Array.isArray(a.detail)
          ? (a.detail as Record<string, unknown>)
          : {},
      created_at: a.createdAt.toISOString(),
    };
  }

  async listPmProjects(): Promise<PmProjectDto[]> {
    const rows = await this.prisma.pmProject.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((p) => this.prismaProjectToDto(p));
  }

  async createPmProject(slug: string, name: string): Promise<PmProjectDto> {
    try {
      const p = await this.prisma.pmProject.create({
        data: { slug, name },
      });
      return this.prismaProjectToDto(p);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw pmHttpError(
          'Project slug already exists',
          'DUPLICATE_SLUG',
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }
  }

  async getReadyTasks(projectId: string): Promise<PmTaskDto[]> {
    if (!projectId?.trim()) {
      throw pmHttpError('project_id is required', 'INVALID_QUERY');
    }
    assertUuid(projectId, 'project_id');
    const project = await this.prisma.pmProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException({ error: 'Project not found', code: 'NOT_FOUND' });
    }

    const rows = await this.prisma.$queryRawUnsafe<RawPmTaskRow[]>(
      'SELECT * FROM get_ready_tasks($1::uuid)',
      projectId,
    );
    return rows.map((r) => this.rowToTaskDto(r));
  }

  async getTaskById(id: string): Promise<PmTaskDetailDto> {
    const task = await this.prisma.pmTask.findUnique({
      where: { id },
      include: {
        artifacts: { orderBy: { createdAt: 'desc' } },
        runs: { orderBy: { runNumber: 'desc' }, take: 1 },
      },
    });
    if (!task) {
      throw new NotFoundException({ error: 'Task not found', code: 'NOT_FOUND' });
    }
    const latestRun = task.runs[0];
    return {
      ...this.prismaTaskToDto(task),
      artifacts: task.artifacts.map((a) => this.artifactToDto(a)),
      latest_run: latestRun ? this.runToDto(latestRun) : null,
    };
  }

  async patchTaskStatus(
    taskId: string,
    body: PmPatchTaskStatusDto,
  ): Promise<PmTaskDto> {
    const existing = await this.prisma.pmTask.findUnique({ where: { id: taskId } });
    if (!existing) {
      throw new NotFoundException({ error: 'Task not found', code: 'NOT_FOUND' });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.pmTask.update({
        where: { id: taskId },
        data: { status: body.status },
      });
      await tx.pmAuditLog.create({
        data: {
          projectId: existing.projectId,
          taskId,
          eventType: 'TASK_STATUS_CHANGE',
          actor: body.actor ?? 'orchestrator',
          fromValue: existing.status,
          toValue: body.status,
          detail: body.detail
            ? { message: body.detail }
            : {},
        },
      });
      return t;
    });

    return this.prismaTaskToDto(updated);
  }

  async createTaskArtifact(
    taskId: string,
    body: PmCreateTaskArtifactDto,
  ): Promise<PmTaskArtifactDto> {
    const task = await this.prisma.pmTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException({ error: 'Task not found', code: 'NOT_FOUND' });
    }

    const artifact = await this.prisma.$transaction(async (tx) => {
      const a = await tx.pmTaskArtifact.create({
        data: {
          taskId,
          artifactType: body.artifact_type,
          name: body.name,
          path: body.path,
          url: body.url,
          content: body.content,
          metadata: (body.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
      await tx.pmTask.update({
        where: { id: taskId },
        data: { updatedAt: new Date() },
      });
      await tx.pmAuditLog.create({
        data: {
          projectId: task.projectId,
          taskId,
          eventType: 'ARTIFACT_ATTACHED',
          actor: body.metadata?.actor as string | undefined ?? 'orchestrator',
          detail: { artifact_id: a.id, name: body.name },
        },
      });
      return a;
    });

    return this.artifactToDto(artifact);
  }

  async batchUpsertTasks(body: PmTasksBatchDto): Promise<{ inserted_tasks: number; inserted_dependencies: number }> {
    assertUuid(body.project_id, 'project_id');
    const project = await this.prisma.pmProject.findUnique({
      where: { id: body.project_id },
    });
    if (!project) {
      throw new NotFoundException({ error: 'Project not found', code: 'NOT_FOUND' });
    }

    const taskIds = new Set(body.tasks.map((t) => t.id));
    for (const d of body.dependencies) {
      if (!taskIds.has(d.task_id) || !taskIds.has(d.depends_on_id)) {
        throw pmHttpError(
          'Dependency references unknown task id',
          'INVALID_DEPENDENCY',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for (const t of body.tasks) {
        await tx.pmTask.upsert({
          where: { id: t.id },
          create: {
            id: t.id,
            projectId: body.project_id,
            phase: t.phase,
            implementationPhase: t.implementation_phase,
            title: t.title,
            description: t.description,
            actorTier: t.actor_tier,
            domain: t.domain,
            complexity: t.complexity,
            estimatedMinutes: t.estimated_minutes ?? 60,
            timeoutMinutes: t.timeout_minutes ?? 60,
            parallelGroup: t.parallel_group,
            status: t.status ?? 'PENDING',
            priority: t.priority ?? 3,
            reviewGate: t.review_gate ?? 'AUTOMATED_ONLY',
            acceptanceCriteria: (t.acceptance_criteria ?? []) as Prisma.InputJsonValue,
            contextRefs: (t.context_refs ?? []) as Prisma.InputJsonValue,
            notes: t.notes,
          },
          update: {
            phase: t.phase,
            implementationPhase: t.implementation_phase,
            title: t.title,
            description: t.description,
            actorTier: t.actor_tier,
            domain: t.domain,
            complexity: t.complexity,
            estimatedMinutes: t.estimated_minutes ?? 60,
            timeoutMinutes: t.timeout_minutes ?? 60,
            parallelGroup: t.parallel_group,
            status: t.status ?? 'PENDING',
            priority: t.priority ?? 3,
            reviewGate: t.review_gate ?? 'AUTOMATED_ONLY',
            acceptanceCriteria: (t.acceptance_criteria ?? []) as Prisma.InputJsonValue,
            contextRefs: (t.context_refs ?? []) as Prisma.InputJsonValue,
            notes: t.notes,
          },
        });
      }

      let depCount = 0;
      for (const d of body.dependencies) {
        await tx.pmTaskDependency.upsert({
          where: {
            taskId_dependsOnId: { taskId: d.task_id, dependsOnId: d.depends_on_id },
          },
          create: { taskId: d.task_id, dependsOnId: d.depends_on_id },
          update: {},
        });
        depCount += 1;
      }

      const cycleRows = await tx.$queryRawUnsafe<{ has_circular_dependency: boolean }[]>(
        'SELECT has_circular_dependency($1::uuid) AS has_circular_dependency',
        body.project_id,
      );
      const hasCycle = cycleRows[0]?.has_circular_dependency === true;
      if (hasCycle) {
        throw pmHttpError(
          'Circular dependency detected in task graph',
          'CIRCULAR_DEPENDENCY',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      return { inserted_tasks: body.tasks.length, inserted_dependencies: depCount };
    });
  }

  async getTaskDependencies(taskId: string): Promise<PmTaskDependencyRowDto[]> {
    const task = await this.prisma.pmTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException({ error: 'Task not found', code: 'NOT_FOUND' });
    }

    const deps = await this.prisma.pmTaskDependency.findMany({
      where: { taskId },
      include: {
        dependsOn: { select: { id: true, title: true, status: true } },
      },
    });

    return deps.map((d) => ({
      task_id: d.taskId,
      depends_on_id: d.dependsOnId,
      dependency_status: d.dependsOn.status,
      dependency_title: d.dependsOn.title,
    }));
  }

  async createHumanGate(body: PmCreateHumanGateDto): Promise<PmHumanGateDto> {
    assertUuid(body.project_id, 'project_id');
    const project = await this.prisma.pmProject.findUnique({
      where: { id: body.project_id },
    });
    if (!project) {
      throw new NotFoundException({ error: 'Project not found', code: 'NOT_FOUND' });
    }

    const gate = await this.prisma.$transaction(async (tx) => {
      const g = await tx.pmHumanGate.create({
        data: {
          projectId: body.project_id,
          gateType: body.gate_type,
          originatingTaskId: body.originating_task_id,
          blockingTaskId: body.blocking_task_id,
          contextSummary: body.context_summary,
          failureHistory: (body.failure_history ?? []) as Prisma.InputJsonValue,
          decisionOptions: body.decision_options as Prisma.InputJsonValue,
          recommendedOption: body.recommended_option,
          status: body.status ?? 'PENDING',
        },
      });
      await tx.pmAuditLog.create({
        data: {
          projectId: body.project_id,
          taskId: body.originating_task_id,
          gateId: g.id,
          eventType: 'ESCALATION_CREATED',
          actor: 'orchestrator',
          detail: { gate_type: body.gate_type },
        },
      });
      return g;
    });

    return this.gateToDto(gate);
  }

  async listPendingGates(projectId: string): Promise<PmHumanGateDto[]> {
    if (!projectId?.trim()) {
      throw pmHttpError('project_id is required', 'INVALID_QUERY');
    }
    assertUuid(projectId, 'project_id');
    const gates = await this.prisma.pmHumanGate.findMany({
      where: { projectId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
    return gates.map((g) => this.gateToDto(g));
  }

  async resolveHumanGate(
    gateId: string,
    body: PmResolveHumanGateDto,
  ): Promise<PmHumanGateDto> {
    assertUuid(gateId, 'gate_id');
    const gate = await this.prisma.pmHumanGate.findUnique({ where: { id: gateId } });
    if (!gate) {
      throw new NotFoundException({ error: 'Gate not found', code: 'NOT_FOUND' });
    }
    if (gate.status !== 'PENDING') {
      throw pmHttpError('Gate is not pending', 'GATE_NOT_PENDING', HttpStatus.CONFLICT);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const g = await tx.pmHumanGate.update({
        where: { id: gateId },
        data: {
          decision: body.decision,
          decisionNotes: body.decision_notes,
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });
      await tx.pmAuditLog.create({
        data: {
          projectId: gate.projectId,
          gateId,
          eventType: 'HUMAN_DECISION',
          actor: 'human',
          fromValue: gate.status,
          toValue: 'RESOLVED',
          detail: {
            decision: body.decision,
            notes: body.decision_notes,
          },
        },
      });
      return g;
    });

    return this.gateToDto(updated);
  }

  async getProject(projectId: string): Promise<PmProjectDto> {
    assertUuid(projectId, 'project_id');
    const p = await this.prisma.pmProject.findUnique({ where: { id: projectId } });
    if (!p) {
      throw new NotFoundException({ error: 'Project not found', code: 'NOT_FOUND' });
    }
    return this.prismaProjectToDto(p);
  }

  async patchProjectStatus(
    projectId: string,
    body: PmPatchProjectStatusDto,
  ): Promise<PmProjectDto> {
    assertUuid(projectId, 'project_id');
    const existing = await this.prisma.pmProject.findUnique({
      where: { id: projectId },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Project not found', code: 'NOT_FOUND' });
    }

    const p = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.pmProject.update({
        where: { id: projectId },
        data: { status: body.status },
      });
      await tx.pmAuditLog.create({
        data: {
          projectId,
          eventType: 'PHASE_TRANSITION',
          actor: 'orchestrator',
          fromValue: existing.status,
          toValue: body.status,
          detail: {},
        },
      });
      return updated;
    });

    return this.prismaProjectToDto(p);
  }

  async listAudit(
    projectId: string,
    limit: number,
    before?: string,
  ): Promise<PmAuditLogDto[]> {
    if (!projectId?.trim()) {
      throw pmHttpError('project_id is required', 'INVALID_QUERY');
    }
    assertUuid(projectId, 'project_id');
    const beforeDate = before ? new Date(before) : undefined;
    if (before && Number.isNaN(beforeDate!.getTime())) {
      throw pmHttpError('Invalid before timestamp', 'INVALID_QUERY');
    }

    const rows = await this.prisma.pmAuditLog.findMany({
      where: {
        projectId,
        ...(beforeDate
          ? { createdAt: { lt: beforeDate } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    return rows.map((a) => this.auditToDto(a));
  }

  async appendAudit(body: PmAppendAuditDto): Promise<PmAuditLogDto> {
    if (body.project_id) assertUuid(body.project_id, 'project_id');
    if (body.gate_id) assertUuid(body.gate_id, 'gate_id');

    const row = await this.prisma.pmAuditLog.create({
      data: {
        projectId: body.project_id,
        taskId: body.task_id,
        gateId: body.gate_id,
        eventType: body.event_type,
        actor: body.actor,
        fromValue: body.from_value,
        toValue: body.to_value,
        detail: (body.detail ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.auditToDto(row);
  }
}
