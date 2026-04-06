import { Test } from '@nestjs/testing';
import { HttpException, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PmService } from './pm.service';
import { PrismaService } from '../common/prisma.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const GATE_ID = '22222222-2222-4222-8222-222222222222';

function baseTaskRow(id: string, overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id,
    projectId: PROJECT_ID,
    phase: 0,
    implementationPhase: null,
    title: 'T',
    description: 'D',
    actorTier: 'HUMAN',
    domain: 'PLANNING',
    complexity: 'LOW',
    estimatedMinutes: 60,
    timeoutMinutes: 60,
    parallelGroup: null,
    status: 'PENDING',
    priority: 3,
    reviewGate: 'AUTOMATED_ONLY',
    acceptanceCriteria: [],
    contextRefs: [],
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('PmService', () => {
  let service: PmService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    pmProject: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pmTask: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    pmTaskDependency: { findMany: jest.fn(), upsert: jest.fn() },
    pmTaskArtifact: { create: jest.fn() },
    pmHumanGate: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    pmAuditLog: { create: jest.fn(), findMany: jest.fn() },
    pmRagIngestionLog: {},
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        pmTask: prisma.pmTask,
        pmProject: prisma.pmProject,
        pmHumanGate: prisma.pmHumanGate,
        pmTaskArtifact: prisma.pmTaskArtifact,
        pmTaskDependency: prisma.pmTaskDependency,
        pmAuditLog: prisma.pmAuditLog,
        $queryRawUnsafe: prisma.$queryRawUnsafe,
      }),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [PmService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PmService);
  });

  describe('listPmProjects', () => {
    it('maps rows to DTOs', async () => {
      const now = new Date();
      prisma.pmProject.findMany.mockResolvedValue([
        {
          id: PROJECT_ID,
          slug: 'app',
          name: 'App',
          status: 'PHASE_0',
          createdAt: now,
          updatedAt: now,
          ideaBriefPath: null,
          planPath: null,
          designDocPath: null,
          repoUrl: null,
          metadata: { k: 1 },
        },
      ]);
      const out = await service.listPmProjects();
      expect(out).toHaveLength(1);
      expect(out[0].slug).toBe('app');
      expect(out[0].metadata).toEqual({ k: 1 });
    });
  });

  describe('createPmProject', () => {
    it('creates and returns DTO', async () => {
      const now = new Date();
      prisma.pmProject.create.mockResolvedValue({
        id: PROJECT_ID,
        slug: 's',
        name: 'N',
        status: 'PHASE_0',
        createdAt: now,
        updatedAt: now,
        ideaBriefPath: null,
        planPath: null,
        designDocPath: null,
        repoUrl: null,
        metadata: {},
      });
      const out = await service.createPmProject('s', 'N');
      expect(out.slug).toBe('s');
      expect(prisma.pmProject.create).toHaveBeenCalledWith({
        data: { slug: 's', name: 'N' },
      });
    });

    it('maps P2002 to DUPLICATE_SLUG', async () => {
      prisma.pmProject.create.mockRejectedValue(
        new PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: '1',
        }),
      );
      await expect(service.createPmProject('dup', 'N')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'DUPLICATE_SLUG' }),
      });
    });
  });

  describe('getReadyTasks', () => {
    it('throws INVALID_QUERY when project_id empty', async () => {
      await expect(service.getReadyTasks('')).rejects.toThrow(HttpException);
    });

    it('throws HttpException on invalid uuid', async () => {
      await expect(service.getReadyTasks('not-uuid')).rejects.toThrow(HttpException);
    });

    it('throws when project missing', async () => {
      prisma.pmProject.findUnique.mockResolvedValue(null);
      await expect(service.getReadyTasks(PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns mapped rows from get_ready_tasks()', async () => {
      prisma.pmProject.findUnique.mockResolvedValue({ id: PROJECT_ID });
      const now = new Date();
      prisma.$queryRawUnsafe.mockResolvedValue([
        {
          id: 'p-a-1',
          project_id: PROJECT_ID,
          phase: 1,
          implementation_phase: null,
          title: 'T',
          description: 'D',
          actor_tier: 'CREW_BACKEND',
          domain: 'BACKEND',
          complexity: 'LOW',
          estimated_minutes: 60,
          timeout_minutes: 60,
          parallel_group: null,
          status: 'PENDING',
          priority: 3,
          review_gate: 'AUTOMATED_ONLY',
          acceptance_criteria: [],
          context_refs: [],
          notes: null,
          created_at: now,
          updated_at: now,
        },
      ]);

      const out = await service.getReadyTasks(PROJECT_ID);
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe('p-a-1');
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT * FROM get_ready_tasks($1::uuid)',
        PROJECT_ID,
      );
    });
  });

  describe('getTaskById', () => {
    it('404 when missing', async () => {
      prisma.pmTask.findUnique.mockResolvedValue(null);
      await expect(service.getTaskById('x')).rejects.toThrow(NotFoundException);
    });

    it('returns detail with artifacts and latest_run', async () => {
      const now = new Date();
      prisma.pmTask.findUnique.mockResolvedValue({
        ...baseTaskRow('t1'),
        artifacts: [
          {
            id: 'art-1',
            taskId: 't1',
            artifactType: 'code',
            name: 'f',
            path: '/p',
            url: null,
            content: null,
            metadata: {},
            createdAt: now,
          },
        ],
        runs: [
          {
            id: 'run-1',
            taskId: 't1',
            runNumber: 1,
            actorTier: 'HUMAN',
            actorDetail: null,
            startedAt: now,
            completedAt: null,
            outcome: null,
            failureReason: null,
            outputSummary: null,
            artifactIds: [],
          },
        ],
      });
      const out = await service.getTaskById('t1');
      expect(out.artifacts).toHaveLength(1);
      expect(out.latest_run?.run_number).toBe(1);
    });
  });

  describe('patchTaskStatus', () => {
    it('404 when task missing', async () => {
      prisma.pmTask.findUnique.mockResolvedValue(null);
      await expect(
        service.patchTaskStatus('t1', { status: 'DONE' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates and writes audit', async () => {
      prisma.pmTask.findUnique.mockResolvedValue(baseTaskRow('t1', { status: 'READY' }));
      prisma.pmTask.update.mockResolvedValue(baseTaskRow('t1', { status: 'IN_PROGRESS' }));
      prisma.pmAuditLog.create.mockResolvedValue({});

      const out = await service.patchTaskStatus('t1', {
        status: 'IN_PROGRESS',
        actor: 'CREW_QA',
        detail: 'go',
      });
      expect(out.status).toBe('IN_PROGRESS');
      expect(prisma.pmAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'TASK_STATUS_CHANGE',
            actor: 'CREW_QA',
            fromValue: 'READY',
            toValue: 'IN_PROGRESS',
          }),
        }),
      );
    });
  });

  describe('createTaskArtifact', () => {
    it('404 when task missing', async () => {
      prisma.pmTask.findUnique.mockResolvedValue(null);
      await expect(
        service.createTaskArtifact('t1', { artifact_type: 'code', name: 'n' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates artifact, bumps task, audits', async () => {
      prisma.pmTask.findUnique.mockResolvedValue(baseTaskRow('t1'));
      const now = new Date();
      prisma.pmTaskArtifact.create.mockResolvedValue({
        id: 'a1',
        taskId: 't1',
        artifactType: 'code',
        name: 'n',
        path: null,
        url: null,
        content: null,
        metadata: { actor: 'bot' },
        createdAt: now,
      });
      prisma.pmTask.update.mockResolvedValue({});
      prisma.pmAuditLog.create.mockResolvedValue({});

      const out = await service.createTaskArtifact('t1', {
        artifact_type: 'code',
        name: 'n',
        metadata: { actor: 'bot' },
      });
      expect(out.task_id).toBe('t1');
      expect(prisma.pmAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'ARTIFACT_ATTACHED', actor: 'bot' }),
        }),
      );
    });
  });

  describe('batchUpsertTasks', () => {
    it('404 when project missing', async () => {
      prisma.pmProject.findUnique.mockResolvedValue(null);
      await expect(
        service.batchUpsertTasks({
          project_id: PROJECT_ID,
          tasks: [
            {
              id: 'a',
              phase: 0,
              title: 'a',
              description: 'a',
              actor_tier: 'HUMAN',
              domain: 'PLANNING',
              complexity: 'LOW',
            },
          ],
          dependencies: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects dependency referencing unknown task id', async () => {
      prisma.pmProject.findUnique.mockResolvedValue({ id: PROJECT_ID });
      await expect(
        service.batchUpsertTasks({
          project_id: PROJECT_ID,
          tasks: [
            {
              id: 'a',
              phase: 0,
              title: 'x',
              description: 'y',
              actor_tier: 'HUMAN',
              domain: 'PLANNING',
              complexity: 'LOW',
            },
          ],
          dependencies: [{ task_id: 'a', depends_on_id: 'b' }],
        }),
      ).rejects.toThrow(HttpException);
    });

    it('rolls back on circular dependency after insert', async () => {
      prisma.pmProject.findUnique.mockResolvedValue({ id: PROJECT_ID });
      prisma.pmTask.upsert.mockResolvedValue({});
      prisma.pmTaskDependency.upsert.mockResolvedValue({});
      prisma.$queryRawUnsafe.mockResolvedValue([{ has_circular_dependency: true }]);

      await expect(
        service.batchUpsertTasks({
          project_id: PROJECT_ID,
          tasks: [
            {
              id: 'a',
              phase: 0,
              title: 'a',
              description: 'a',
              actor_tier: 'HUMAN',
              domain: 'PLANNING',
              complexity: 'LOW',
            },
            {
              id: 'b',
              phase: 0,
              title: 'b',
              description: 'b',
              actor_tier: 'HUMAN',
              domain: 'PLANNING',
              complexity: 'LOW',
            },
          ],
          dependencies: [
            { task_id: 'a', depends_on_id: 'b' },
            { task_id: 'b', depends_on_id: 'a' },
          ],
        }),
      ).rejects.toThrow(HttpException);
    });

    it('returns counts when no cycle', async () => {
      prisma.pmProject.findUnique.mockResolvedValue({ id: PROJECT_ID });
      prisma.pmTask.upsert.mockResolvedValue({});
      prisma.pmTaskDependency.upsert.mockResolvedValue({});
      prisma.$queryRawUnsafe.mockResolvedValue([{ has_circular_dependency: false }]);

      const out = await service.batchUpsertTasks({
        project_id: PROJECT_ID,
        tasks: [
          {
            id: 'a',
            phase: 0,
            title: 'a',
            description: 'a',
            actor_tier: 'HUMAN',
            domain: 'PLANNING',
            complexity: 'LOW',
          },
        ],
        dependencies: [],
      });
      expect(out).toEqual({ inserted_tasks: 1, inserted_dependencies: 0 });
    });
  });

  describe('getTaskDependencies', () => {
    it('404 when task missing', async () => {
      prisma.pmTask.findUnique.mockResolvedValue(null);
      await expect(service.getTaskDependencies('t1')).rejects.toThrow(NotFoundException);
    });

    it('maps dependency rows', async () => {
      prisma.pmTask.findUnique.mockResolvedValue(baseTaskRow('t1'));
      prisma.pmTaskDependency.findMany.mockResolvedValue([
        {
          taskId: 't1',
          dependsOnId: 't0',
          dependsOn: { id: 't0', title: 'Dep', status: 'DONE' },
        },
      ]);
      const out = await service.getTaskDependencies('t1');
      expect(out).toEqual([
        {
          task_id: 't1',
          depends_on_id: 't0',
          dependency_status: 'DONE',
          dependency_title: 'Dep',
        },
      ]);
    });
  });

  describe('createHumanGate', () => {
    it('404 when project missing', async () => {
      prisma.pmProject.findUnique.mockResolvedValue(null);
      await expect(
        service.createHumanGate({
          project_id: PROJECT_ID,
          gate_type: 'GENERAL',
          context_summary: 'c',
          decision_options: ['A', 'B'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates gate and audit', async () => {
      prisma.pmProject.findUnique.mockResolvedValue({ id: PROJECT_ID });
      const now = new Date();
      prisma.pmHumanGate.create.mockResolvedValue({
        id: GATE_ID,
        projectId: PROJECT_ID,
        gateType: 'GENERAL',
        originatingTaskId: null,
        blockingTaskId: null,
        contextSummary: 'c',
        failureHistory: [],
        decisionOptions: ['A'],
        recommendedOption: null,
        decision: null,
        decisionNotes: null,
        status: 'PENDING',
        createdAt: now,
        resolvedAt: null,
        ageAlertSent: false,
      });
      prisma.pmAuditLog.create.mockResolvedValue({});

      const out = await service.createHumanGate({
        project_id: PROJECT_ID,
        gate_type: 'GENERAL',
        context_summary: 'c',
        decision_options: ['A'],
      });
      expect(out.id).toBe(GATE_ID);
      expect(prisma.pmAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'ESCALATION_CREATED' }),
        }),
      );
    });
  });

  describe('listPendingGates', () => {
    it('throws when project_id empty', async () => {
      await expect(service.listPendingGates('')).rejects.toThrow(HttpException);
    });

    it('lists gates', async () => {
      const now = new Date();
      prisma.pmHumanGate.findMany.mockResolvedValue([
        {
          id: GATE_ID,
          projectId: PROJECT_ID,
          gateType: 'GENERAL',
          originatingTaskId: null,
          blockingTaskId: null,
          contextSummary: 'x',
          failureHistory: [],
          decisionOptions: [],
          recommendedOption: null,
          decision: null,
          decisionNotes: null,
          status: 'PENDING',
          createdAt: now,
          resolvedAt: null,
          ageAlertSent: false,
        },
      ]);
      const out = await service.listPendingGates(PROJECT_ID);
      expect(out).toHaveLength(1);
    });
  });

  describe('resolveHumanGate', () => {
    it('404 when missing', async () => {
      prisma.pmHumanGate.findUnique.mockResolvedValue(null);
      await expect(
        service.resolveHumanGate(GATE_ID, { decision: 'OK' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('409 when not pending', async () => {
      prisma.pmHumanGate.findUnique.mockResolvedValue({
        id: GATE_ID,
        projectId: PROJECT_ID,
        status: 'RESOLVED',
      });
      await expect(
        service.resolveHumanGate(GATE_ID, { decision: 'OK' }),
      ).rejects.toThrow(HttpException);
    });

    it('resolves and audits', async () => {
      const now = new Date();
      prisma.pmHumanGate.findUnique.mockResolvedValue({
        id: GATE_ID,
        projectId: PROJECT_ID,
        gateType: 'G',
        originatingTaskId: null,
        blockingTaskId: null,
        contextSummary: 'c',
        failureHistory: [],
        decisionOptions: [],
        recommendedOption: null,
        decision: null,
        decisionNotes: null,
        status: 'PENDING',
        createdAt: now,
        resolvedAt: null,
        ageAlertSent: false,
      });
      prisma.pmHumanGate.update.mockResolvedValue({
        id: GATE_ID,
        projectId: PROJECT_ID,
        gateType: 'G',
        originatingTaskId: null,
        blockingTaskId: null,
        contextSummary: 'c',
        failureHistory: [],
        decisionOptions: [],
        recommendedOption: null,
        decision: 'OK',
        decisionNotes: 'n',
        status: 'RESOLVED',
        createdAt: now,
        resolvedAt: new Date(),
        ageAlertSent: false,
      });
      prisma.pmAuditLog.create.mockResolvedValue({});

      const out = await service.resolveHumanGate(GATE_ID, {
        decision: 'OK',
        decision_notes: 'n',
      });
      expect(out.status).toBe('RESOLVED');
      expect(out.decision).toBe('OK');
    });
  });

  describe('getProject / patchProjectStatus', () => {
    it('getProject 404', async () => {
      prisma.pmProject.findUnique.mockResolvedValue(null);
      await expect(service.getProject(PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it('getProject returns dto', async () => {
      const now = new Date();
      prisma.pmProject.findUnique.mockResolvedValue({
        id: PROJECT_ID,
        slug: 's',
        name: 'N',
        status: 'PHASE_1',
        createdAt: now,
        updatedAt: now,
        ideaBriefPath: null,
        planPath: null,
        designDocPath: null,
        repoUrl: null,
        metadata: {},
      });
      const out = await service.getProject(PROJECT_ID);
      expect(out.slug).toBe('s');
    });

    it('patchProjectStatus audits transition', async () => {
      const now = new Date();
      prisma.pmProject.findUnique.mockResolvedValue({
        id: PROJECT_ID,
        slug: 's',
        name: 'N',
        status: 'PHASE_0',
        createdAt: now,
        updatedAt: now,
        ideaBriefPath: null,
        planPath: null,
        designDocPath: null,
        repoUrl: null,
        metadata: {},
      });
      prisma.pmProject.update.mockResolvedValue({
        id: PROJECT_ID,
        slug: 's',
        name: 'N',
        status: 'PHASE_2',
        createdAt: now,
        updatedAt: now,
        ideaBriefPath: null,
        planPath: null,
        designDocPath: null,
        repoUrl: null,
        metadata: {},
      });
      prisma.pmAuditLog.create.mockResolvedValue({});

      const out = await service.patchProjectStatus(PROJECT_ID, { status: 'PHASE_2' });
      expect(out.status).toBe('PHASE_2');
      expect(prisma.pmAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'PHASE_TRANSITION',
            fromValue: 'PHASE_0',
            toValue: 'PHASE_2',
          }),
        }),
      );
    });
  });

  describe('listAudit / appendAudit', () => {
    it('listAudit rejects empty project_id', async () => {
      await expect(service.listAudit('', 10)).rejects.toThrow(HttpException);
    });

    it('listAudit rejects invalid before', async () => {
      await expect(
        service.listAudit(PROJECT_ID, 10, 'not-a-date'),
      ).rejects.toThrow(HttpException);
    });

    it('listAudit caps limit', async () => {
      prisma.pmAuditLog.findMany.mockResolvedValue([]);
      await service.listAudit(PROJECT_ID, 9999);
      expect(prisma.pmAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });

    it('appendAudit creates row', async () => {
      const now = new Date();
      prisma.pmAuditLog.create.mockResolvedValue({
        id: 'a1',
        projectId: PROJECT_ID,
        taskId: null,
        gateId: null,
        eventType: 'CUSTOM',
        actor: 'x',
        fromValue: null,
        toValue: null,
        detail: {},
        createdAt: now,
      });
      const out = await service.appendAudit({
        project_id: PROJECT_ID,
        event_type: 'CUSTOM',
        actor: 'x',
      });
      expect(out.event_type).toBe('CUSTOM');
    });

    it('appendAudit rejects invalid project uuid', async () => {
      await expect(
        service.appendAudit({ project_id: 'bad', event_type: 'E' }),
      ).rejects.toThrow(HttpException);
    });
  });
});
