import {
  PrismaClient,
  ProjectColor,
  TaskPriority,
  TaskStatus,
  AuditEventType,
  CustomFieldType,
  TaskWorkItemType,
  SprintState,
  KanbanWipEnforcement,
  DependencyType,
  AutomationTriggerType,
  AutomationActionType,
  AgentTokenScope,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Local dev profile (same account historically labeled “demo” in the UI).
 * Change password after first use in shared environments.
 */
const DEV_EMAIL = 'demo@vineroot.local';
const DEV_PASSWORD = 'Demo123456!';
const DEV_WORKSPACE_SLUG = 'vineroot-demo';

const DEMO_EMAIL = DEV_EMAIL;
const DEMO_PASSWORD = DEV_PASSWORD;
const DEMO_WORKSPACE_SLUG = DEV_WORKSPACE_SLUG;

const DEMO_PROJECT_MARKER = 'Demo: Mobile app';

/** Extra projects/tasks for parity QA (recurrence, templates, custom fields, deps, activity). */
const PARITY_PLAYGROUND_MARKER = 'Dev: Parity playground';
const PARITY_BLUEPRINT_MARKER = 'Dev: Project blueprint';

/** Sprints, epics, burndown/CFD, saved views, intake, automations, threads/mentions, WIP, agent token. */
const FEATURE_SHOWCASE_MARKER = 'Demo: Feature showcase';

const COLLEAGUE_EMAIL = 'colleague@vineroot.local';
const COLLEAGUE_PASSWORD = 'Demo123456!';

type DemoCtx = { userId: string; workspaceId: string };

async function ensureDemoAccount(): Promise<DemoCtx> {
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash,
        displayName: 'Demo User',
      },
    });
  }

  let workspace = await prisma.workspace.findUnique({
    where: { slug: DEMO_WORKSPACE_SLUG },
  });

  if (workspace) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
    });
    if (!membership) {
      const suffix = Math.random().toString(36).slice(2, 8);
      workspace = await prisma.workspace.create({
        data: {
          name: 'Demo Workspace',
          slug: `${DEMO_WORKSPACE_SLUG}-${suffix}`,
          description: 'Sample workspace for evaluating Vineroot',
          members: {
            create: { userId: user.id, role: 'OWNER' },
          },
        },
      });
    }
  } else {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Demo Workspace',
        slug: DEMO_WORKSPACE_SLUG,
        description: 'Sample workspace for evaluating Vineroot',
        members: {
          create: { userId: user.id, role: 'OWNER' },
        },
      },
    });
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: user.id, workspaceId: workspace.id },
  });
  if (!member) {
    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'OWNER',
      },
    });
  }

  return { userId: user.id, workspaceId: workspace.id };
}

async function seedRichDemoData(ctx: DemoCtx): Promise<void> {
  const { workspaceId: wsId, userId } = ctx;

  const already = await prisma.project.findFirst({
    where: {
      deletedAt: null,
      name: DEMO_PROJECT_MARKER,
      workspaceLinks: { some: { workspaceId: wsId } },
    },
  });
  if (already) {
    console.log('[seed] Demo projects already present; skipping core sample data.');
    return;
  }

  const team = await prisma.team.create({
    data: {
      workspaceId: wsId,
      name: 'Demo · Engineering',
      description: 'Seeded team for list and project views',
      color: '#6366f1',
      members: {
        create: { userId, role: 'LEAD' },
      },
    },
  });

  const tags = await Promise.all([
    prisma.tag.create({
      data: { workspaceId: wsId, name: 'demo', color: '#94a3b8' },
    }),
    prisma.tag.create({
      data: { workspaceId: wsId, name: 'frontend', color: '#22c55e' },
    }),
    prisma.tag.create({
      data: { workspaceId: wsId, name: 'urgent', color: '#ef4444' },
    }),
  ]);

  async function createProject(
    name: string,
    color: ProjectColor,
    sectionNames: string[],
    taskSpecs: Array<{
      title: string;
      status: TaskStatus;
      priority?: TaskPriority;
      sectionIdx?: number;
      tagIdx?: number[];
    }>,
  ) {
    const project = await prisma.project.create({
      data: {
        teamId: team.id,
        createdById: userId,
        name,
        description: `Sample project for ${name}`,
        color,
        status: 'ACTIVE',
        workspaceLinks: {
          create: { workspaceId: wsId },
        },
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
    });

    const sections = [];
    for (let i = 0; i < sectionNames.length; i++) {
      const s = await prisma.section.create({
        data: {
          projectId: project.id,
          name: sectionNames[i],
          sortOrder: i,
          isDefault: i === 0,
        },
      });
      sections.push(s);
    }

    let order = 0;
    for (const spec of taskSpecs) {
      const sectionId =
        spec.sectionIdx !== undefined ? sections[spec.sectionIdx]?.id : sections[0]?.id;
      const task = await prisma.task.create({
        data: {
          workspaceId: wsId,
          projectId: project.id,
          sectionId,
          createdById: userId,
          title: spec.title,
          description: 'Seeded task for UI and dashboard testing.',
          status: spec.status,
          priority: spec.priority ?? 'NONE',
          sortOrder: order++,
          assignees: {
            create: { userId },
          },
        },
      });
      const tagIds = (spec.tagIdx ?? []).map((i) => tags[i]?.id).filter(Boolean) as string[];
      for (const tagId of tagIds) {
        await prisma.taskTag.create({
          data: { taskId: task.id, tagId },
        });
      }
    }

    return project;
  }

  const pMobile = await createProject(
    DEMO_PROJECT_MARKER,
    ProjectColor.INDIGO,
    ['Icebox', 'In progress', 'Done'],
    [
      { title: 'Sketch onboarding flow', status: TaskStatus.BACKLOG, sectionIdx: 0, tagIdx: [0, 1] },
      { title: 'Wire up push notifications', status: TaskStatus.READY, sectionIdx: 0, tagIdx: [2] },
      { title: 'Fix crash on tablet rotation', status: TaskStatus.IN_PROGRESS, sectionIdx: 1, tagIdx: [2] },
      { title: 'Ship 1.2 to TestFlight', status: TaskStatus.IN_REVIEW, sectionIdx: 1 },
      { title: 'Dark mode polish', status: TaskStatus.DONE, sectionIdx: 2, tagIdx: [1] },
      { title: 'Analytics event audit', status: TaskStatus.BLOCKED, sectionIdx: 1, tagIdx: [0] },
    ],
  );

  const pApi = await createProject(
    'Demo: API platform',
    ProjectColor.TEAL,
    ['Backlog', 'This sprint'],
    [
      { title: 'Rate limiting middleware', status: TaskStatus.IN_PROGRESS, sectionIdx: 1, tagIdx: [0] },
      { title: 'OpenAPI docs refresh', status: TaskStatus.READY, sectionIdx: 1 },
      { title: 'Postgres read replica spike', status: TaskStatus.BACKLOG, sectionIdx: 0 },
      { title: 'Webhook retries', status: TaskStatus.DONE, sectionIdx: 1 },
    ],
  );

  await createProject(
    'Demo: Design system',
    ProjectColor.PINK,
    ['Components', 'Docs'],
    [
      { title: 'Button variants audit', status: TaskStatus.IN_PROGRESS, sectionIdx: 0, tagIdx: [1] },
      { title: 'Storybook 8 upgrade', status: TaskStatus.BACKLOG, sectionIdx: 1 },
    ],
  );

  const portfolio = await prisma.portfolio.create({
    data: {
      workspaceId: wsId,
      name: 'Demo: Product bets',
      description: 'Strategic initiatives (seed)',
      color: '#8b5cf6',
      createdById: userId,
      items: {
        create: [
          { projectId: pMobile.id, sortOrder: 0 },
          { projectId: pApi.id, sortOrder: 1 },
        ],
      },
    },
  });

  const anyTask = await prisma.task.findFirst({
    where: { projectId: pMobile.id, deletedAt: null },
  });
  if (anyTask) {
    await prisma.comment.create({
      data: {
        taskId: anyTask.id,
        authorId: userId,
        body: 'Seeded comment — try threads and activity in the app.',
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        recipientId: userId,
        type: 'TASK_ASSIGNED',
        title: 'Sample: task assignment',
        body: 'You have work waiting in the Demo workspace.',
        resourceId: anyTask?.id,
        resourceType: 'task',
        isRead: false,
      },
      {
        recipientId: userId,
        type: 'TASK_DUE_SOON',
        title: 'Sample: due soon reminder',
        body: 'Preview of notification styling.',
        isRead: false,
      },
    ],
  });

  await prisma.goal.create({
    data: {
      workspaceId: wsId,
      ownerId: userId,
      name: 'Demo: Ship mobile beta',
      description: 'Example goal for roadmap views',
      status: 'ON_TRACK',
      metrics: {
        create: [
          { name: 'Tasks completed', type: 'PERCENT', current: 42, target: 100, unit: '%' },
        ],
      },
    },
  });

  console.log('[seed] Created sample team, projects, tasks, portfolio, goal, notifications.', portfolio.id);
}

/**
 * Recurring tasks, task/project templates, custom fields, dependency, attachment, ActivityLog rows.
 * Idempotent: skips projects that already exist for this workspace.
 */
async function seedDevParityPlayground(ctx: DemoCtx): Promise<void> {
  const { workspaceId: wsId, userId } = ctx;

  const existingPlay = await prisma.project.findFirst({
    where: {
      deletedAt: null,
      name: PARITY_PLAYGROUND_MARKER,
      workspaceLinks: { some: { workspaceId: wsId } },
    },
  });
  const existingBlue = await prisma.project.findFirst({
    where: {
      deletedAt: null,
      name: PARITY_BLUEPRINT_MARKER,
      workspaceLinks: { some: { workspaceId: wsId } },
    },
  });

  if (existingPlay && existingBlue) {
    console.log('[seed] Dev parity projects already present; skipping parity seed.');
    return;
  }

  const team = await prisma.team.findFirst({
    where: { workspaceId: wsId, deletedAt: null },
  });
  if (!team) {
    console.warn('[seed] No team in workspace; dev parity seed skipped (run core demo seed first).');
    return;
  }

  const now = new Date();
  const nextMonday = new Date(now);
  const dow = nextMonday.getUTCDay();
  const daysUntilMon = ((8 - dow) % 7) || 7;
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMon);
  nextMonday.setUTCHours(17, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(17, 0, 0, 0);

  if (!existingBlue) {
    const blueprint = await prisma.project.create({
      data: {
        teamId: team.id,
        createdById: userId,
        name: PARITY_BLUEPRINT_MARKER,
        description: 'Blueprint project for template filters and “duplicate project” flows.',
        color: ProjectColor.GRAY,
        isTemplate: true,
        status: 'ACTIVE',
        workspaceLinks: { create: { workspaceId: wsId } },
        members: { create: { userId, role: 'OWNER' } },
        sections: {
          create: [{ name: 'Starter tasks', sortOrder: 0, isDefault: true }],
        },
      },
      include: { sections: true },
    });
    const bpSection = blueprint.sections[0];
    if (bpSection) {
      await prisma.task.createMany({
        data: [
          {
            workspaceId: wsId,
            projectId: blueprint.id,
            sectionId: bpSection.id,
            createdById: userId,
            title: 'Blueprint · Kickoff checklist',
            description: 'Task template inside a template project.',
            status: TaskStatus.BACKLOG,
            sortOrder: 0,
            isTemplate: true,
          },
          {
            workspaceId: wsId,
            projectId: blueprint.id,
            sectionId: bpSection.id,
            createdById: userId,
            title: 'Blueprint · Definition of done',
            description: 'Regular task in a template project (for mixed lists).',
            status: TaskStatus.BACKLOG,
            sortOrder: 1,
            isTemplate: false,
          },
        ],
      });
    }
    console.log('[seed] Created template project:', PARITY_BLUEPRINT_MARKER);
  }

  if (existingPlay) {
    return;
  }

  const fieldPoints = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      name: 'Dev parity · Story points',
      type: CustomFieldType.NUMBER,
      isRequired: false,
    },
  });
  const fieldTarget = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      name: 'Dev parity · Target date',
      type: CustomFieldType.DATE,
      isRequired: false,
    },
  });
  const fieldSprint = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      name: 'Dev parity · Sprint',
      type: CustomFieldType.DROPDOWN,
      options: { choices: ['Sprint 1', 'Sprint 2', 'Backlog'] },
      isRequired: false,
    },
  });

  const project = await prisma.project.create({
    data: {
      teamId: team.id,
      createdById: userId,
      name: PARITY_PLAYGROUND_MARKER,
      description:
        'Recurring tasks, task templates, custom fields, dependency, attachment, and activity story.',
      color: ProjectColor.PURPLE,
      status: 'ACTIVE',
      workspaceLinks: { create: { workspaceId: wsId } },
      members: { create: { userId, role: 'OWNER' } },
    },
  });

  await prisma.projectCustomField.createMany({
    data: [
      { projectId: project.id, fieldId: fieldPoints.id, sortOrder: 0 },
      { projectId: project.id, fieldId: fieldTarget.id, sortOrder: 1 },
      { projectId: project.id, fieldId: fieldSprint.id, sortOrder: 2 },
    ],
  });

  const secTodo = await prisma.section.create({
    data: { projectId: project.id, name: 'To do', sortOrder: 0, isDefault: true },
  });
  const secDoing = await prisma.section.create({
    data: { projectId: project.id, name: 'Doing', sortOrder: 1, isDefault: false },
  });
  const secDone = await prisma.section.create({
    data: { projectId: project.id, name: 'Done', sortOrder: 2, isDefault: false },
  });

  const tDesign = await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secDoing.id,
      createdById: userId,
      title: 'Parity · Design API contract',
      description: 'Blocking task for dependency testing.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      sortOrder: 0,
      dueDate: tomorrow,
      assignees: { create: { userId } },
    },
  });

  const tImplement = await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secTodo.id,
      createdById: userId,
      title: 'Parity · Implement webhook receiver',
      description: 'Depends on the design task (WAITING_ON).',
      status: TaskStatus.BACKLOG,
      priority: TaskPriority.MEDIUM,
      sortOrder: 1,
      assignees: { create: { userId } },
    },
  });

  await prisma.taskDependency.create({
    data: {
      dependentId: tImplement.id,
      blockingId: tDesign.id,
      type: 'WAITING_ON',
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secTodo.id,
      createdById: userId,
      title: 'Parity · Weekly sync prep',
      description: 'Recurring weekly (Monday anchor).',
      status: TaskStatus.READY,
      sortOrder: 2,
      dueDate: nextMonday,
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
      assignees: { create: { userId } },
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secTodo.id,
      createdById: userId,
      title: 'Parity · Daily build health',
      description: 'Recurring daily.',
      status: TaskStatus.BACKLOG,
      sortOrder: 3,
      dueDate: tomorrow,
      recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
      assignees: { create: { userId } },
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secTodo.id,
      createdById: userId,
      title: 'Template · Weekly status email',
      description: 'Task blueprint (hidden from default lists).',
      status: TaskStatus.BACKLOG,
      sortOrder: 4,
      isTemplate: true,
    },
  });

  const tParent = await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secTodo.id,
      createdById: userId,
      title: 'Parity · Launch checklist',
      description: 'Parent task with subtasks.',
      status: TaskStatus.IN_PROGRESS,
      sortOrder: 5,
      assignees: { create: { userId } },
    },
  });

  await prisma.task.createMany({
    data: [
      {
        workspaceId: wsId,
        projectId: project.id,
        sectionId: secTodo.id,
        parentTaskId: tParent.id,
        createdById: userId,
        title: 'Parity · Subtask: Announce in Slack',
        status: TaskStatus.BACKLOG,
        sortOrder: 0,
      },
      {
        workspaceId: wsId,
        projectId: project.id,
        sectionId: secTodo.id,
        parentTaskId: tParent.id,
        createdById: userId,
        title: 'Parity · Subtask: Update docs',
        status: TaskStatus.BACKLOG,
        sortOrder: 1,
      },
    ],
  });

  await prisma.customFieldValue.createMany({
    data: [
      { taskId: tImplement.id, fieldId: fieldPoints.id, value: { value: 8 } },
      { taskId: tImplement.id, fieldId: fieldTarget.id, value: { text: '2026-06-30' } },
      { taskId: tImplement.id, fieldId: fieldSprint.id, value: { value: 'Sprint 1' } },
    ],
  });

  await prisma.attachment.create({
    data: {
      taskId: tDesign.id,
      uploadedById: userId,
      filename: 'parity-spec-notes.md',
      mimeType: 'text/markdown',
      sizeBytes: 2048,
      url: 'https://example.com/dev-parity/spec-notes.md',
      storageKey: 'link:parity-spec-seed',
    },
  });

  await prisma.activityLog.createMany({
    data: [
      {
        projectId: project.id,
        taskId: null,
        actorId: userId,
        eventType: AuditEventType.TASK_CREATED,
        description: 'Seeded project-level activity (no task id).',
      },
      {
        projectId: project.id,
        taskId: tDesign.id,
        actorId: userId,
        eventType: AuditEventType.STATUS_CHANGED,
        description: 'Moved into Doing for parity testing.',
        oldValue: { status: 'BACKLOG' },
        newValue: { status: 'IN_PROGRESS' },
      },
      {
        projectId: project.id,
        taskId: tImplement.id,
        actorId: userId,
        eventType: AuditEventType.TASK_ASSIGNED,
        description: 'Assigned for integration work.',
      },
      {
        projectId: project.id,
        taskId: tDesign.id,
        actorId: userId,
        eventType: AuditEventType.ATTACHMENT_ADDED,
        description: 'Attached parity-spec-notes.md',
      },
      {
        projectId: project.id,
        taskId: tParent.id,
        actorId: userId,
        eventType: AuditEventType.COMMENT_ADDED,
        description: 'Seeded story entry (comment activity).',
      },
    ],
  });

  console.log('[seed] Created parity playground:', PARITY_PLAYGROUND_MARKER);
}

/** Second account in the demo workspace for @mention / multi-assignee QA. */
async function ensureColleagueUser(workspaceId: string): Promise<string> {
  let u = await prisma.user.findUnique({ where: { email: COLLEAGUE_EMAIL } });
  if (!u) {
    const passwordHash = await bcrypt.hash(COLLEAGUE_PASSWORD, 10);
    u = await prisma.user.create({
      data: {
        email: COLLEAGUE_EMAIL,
        passwordHash,
        displayName: 'Demo Colleague',
      },
    });
  }
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: u.id } },
  });
  if (!m) {
    await prisma.workspaceMember.create({
      data: { workspaceId, userId: u.id, role: 'MEMBER' },
    });
  }
  return u.id;
}

function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Rich demo project: agile (sprints, epics, points, backlog rank), PM charts data, custom fields (all common types),
 * dependencies + milestone, comment threads + mentions, saved views, published intake form, project-scoped automation,
 * optional workspace agent token + outbound webhook stubs, CFD snapshots, portfolio link.
 */
async function seedFeatureShowcase(ctx: DemoCtx): Promise<void> {
  const { workspaceId: wsId, userId } = ctx;

  const exists = await prisma.project.findFirst({
    where: {
      deletedAt: null,
      name: FEATURE_SHOWCASE_MARKER,
      workspaceLinks: { some: { workspaceId: wsId } },
    },
  });
  if (exists) {
    console.log('[seed] Feature showcase project already present; skipping.');
    return;
  }

  const team = await prisma.team.findFirst({
    where: { workspaceId: wsId, deletedAt: null },
  });
  if (!team) {
    console.warn('[seed] No team; feature showcase skipped.');
    return;
  }

  const colleagueId = await ensureColleagueUser(wsId);

  const tagAuto = await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId: wsId, name: 'showcase-auto' } },
    create: { workspaceId: wsId, name: 'showcase-auto', color: '#a855f7' },
    update: {},
  });
  await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId: wsId, name: 'release-train' } },
    create: { workspaceId: wsId, name: 'release-train', color: '#0ea5e9' },
    update: {},
  });

  const now = new Date();
  const sprintClosedStart = new Date(now);
  sprintClosedStart.setUTCDate(sprintClosedStart.getUTCDate() - 35);
  const sprintClosedEnd = new Date(now);
  sprintClosedEnd.setUTCDate(sprintClosedEnd.getUTCDate() - 21);
  const sprintActiveStart = new Date(now);
  sprintActiveStart.setUTCDate(sprintActiveStart.getUTCDate() - 10);
  const sprintActiveEnd = new Date(now);
  sprintActiveEnd.setUTCDate(sprintActiveEnd.getUTCDate() + 11);
  const sprintNextStart = new Date(now);
  sprintNextStart.setUTCDate(sprintNextStart.getUTCDate() + 14);
  const sprintNextEnd = new Date(now);
  sprintNextEnd.setUTCDate(sprintNextEnd.getUTCDate() + 28);

  const project = await prisma.project.create({
    data: {
      teamId: team.id,
      createdById: userId,
      name: FEATURE_SHOWCASE_MARKER,
      description:
        'End-to-end QA: sprints, epics, burndown/flow, WIP limits, saved views, intake, automations, threads, custom fields.',
      color: ProjectColor.PURPLE,
      status: 'ACTIVE',
      kanbanWipEnforcement: KanbanWipEnforcement.WARN,
      startDate: sprintActiveStart,
      dueDate: sprintNextEnd,
      workspaceLinks: { create: { workspaceId: wsId } },
      members: {
        create: [
          { userId, role: 'OWNER' },
          { userId: colleagueId, role: 'EDITOR' },
        ],
      },
      sprints: {
        create: [
          {
            name: 'Showcase · Sprint −2 (closed)',
            goal: 'Seed data for velocity / closed sprint',
            startDate: sprintClosedStart,
            endDate: sprintClosedEnd,
            state: SprintState.CLOSED,
            sortOrder: 0,
          },
          {
            name: 'Showcase · Current sprint',
            goal: 'Active sprint for burndown + board',
            startDate: sprintActiveStart,
            endDate: sprintActiveEnd,
            state: SprintState.ACTIVE,
            sortOrder: 1,
          },
          {
            name: 'Showcase · Next sprint',
            goal: 'Planned backlog pull',
            startDate: sprintNextStart,
            endDate: sprintNextEnd,
            state: SprintState.PLANNED,
            sortOrder: 2,
          },
        ],
      },
    },
    include: { sprints: { orderBy: { sortOrder: 'asc' } } },
  });

  const [spClosed, spActive, spNext] = project.sprints;

  const secBacklog = await prisma.section.create({
    data: {
      projectId: project.id,
      name: 'Backlog',
      sortOrder: 0,
      isDefault: true,
    },
  });
  const secReady = await prisma.section.create({
    data: { projectId: project.id, name: 'Ready', sortOrder: 1, isDefault: false },
  });
  const secDoing = await prisma.section.create({
    data: {
      projectId: project.id,
      name: 'In progress',
      sortOrder: 2,
      isDefault: false,
      wipLimit: 3,
    },
  });
  const secReview = await prisma.section.create({
    data: {
      projectId: project.id,
      name: 'Review',
      sortOrder: 3,
      isDefault: false,
      wipLimit: 5,
    },
  });
  const secDone = await prisma.section.create({
    data: { projectId: project.id, name: 'Done', sortOrder: 4, isDefault: false },
  });

  const cfUrl = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      name: 'Showcase · Spec link',
      type: CustomFieldType.URL,
      isRequired: false,
    },
  });
  const cfCheckbox = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      name: 'Showcase · Signed off',
      type: CustomFieldType.CHECKBOX,
      isRequired: false,
    },
  });
  const cfMulti = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      name: 'Showcase · Areas',
      type: CustomFieldType.MULTI_SELECT,
      options: { choices: ['Frontend', 'Backend', 'Infra', 'Docs'] },
      isRequired: false,
    },
  });
  const cfPerson = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      name: 'Showcase · Feature owner',
      type: CustomFieldType.PERSON,
      isRequired: false,
    },
  });
  const cfText = await prisma.customFieldDefinition.create({
    data: {
      workspaceId: wsId,
      name: 'Showcase · Risk notes',
      type: CustomFieldType.TEXT,
      isRequired: false,
    },
  });

  await prisma.projectCustomField.createMany({
    data: [
      { projectId: project.id, fieldId: cfUrl.id, sortOrder: 0 },
      { projectId: project.id, fieldId: cfCheckbox.id, sortOrder: 1 },
      { projectId: project.id, fieldId: cfMulti.id, sortOrder: 2 },
      { projectId: project.id, fieldId: cfPerson.id, sortOrder: 3 },
      { projectId: project.id, fieldId: cfText.id, sortOrder: 4 },
    ],
  });

  const doneMidClosed = new Date(sprintClosedStart);
  doneMidClosed.setUTCDate(doneMidClosed.getUTCDate() + 5);

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secDone.id,
      sprintId: spClosed.id,
      createdById: userId,
      title: 'Showcase · Ship analytics SDK (closed sprint)',
      description: 'Completed inside prior sprint window for velocity seed.',
      workItemType: TaskWorkItemType.STORY,
      storyPoints: 5,
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      sortOrder: 0,
      completedAt: doneMidClosed,
      dueDate: sprintClosedEnd,
      assignees: { create: [{ userId }, { userId: colleagueId }] },
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secDone.id,
      sprintId: spClosed.id,
      createdById: userId,
      title: 'Showcase · Harden webhook retries',
      workItemType: TaskWorkItemType.CHORE,
      storyPoints: 3,
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      sortOrder: 1,
      completedAt: doneMidClosed,
      assignees: { create: { userId } },
    },
  });

  const epic = await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secBacklog.id,
      createdById: userId,
      title: 'Showcase · EPIC: Self-serve onboarding',
      description: 'Cross-cutting epic with child stories and linked work via epicTaskId.',
      workItemType: TaskWorkItemType.EPIC,
      status: TaskStatus.IN_PROGRESS,
      sortOrder: 0,
      startDate: sprintActiveStart,
      dueDate: sprintNextEnd,
      assignees: { create: { userId } },
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secBacklog.id,
      parentTaskId: epic.id,
      createdById: userId,
      title: 'Showcase · Story: Welcome checklist UI',
      workItemType: TaskWorkItemType.STORY,
      storyPoints: 8,
      status: TaskStatus.BACKLOG,
      sortOrder: 0,
      assignees: { create: { userId: colleagueId } },
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secBacklog.id,
      parentTaskId: epic.id,
      createdById: userId,
      title: 'Showcase · Story: Empty states & illustrations',
      workItemType: TaskWorkItemType.STORY,
      storyPoints: 5,
      status: TaskStatus.READY,
      sortOrder: 1,
      assignees: { create: [{ userId }, { userId: colleagueId }] },
    },
  });

  const tMilestone = await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secReady.id,
      createdById: userId,
      title: 'Showcase · Milestone: GA date committed',
      workItemType: TaskWorkItemType.TASK,
      status: TaskStatus.READY,
      sortOrder: 2,
      isMilestone: true,
      startDate: sprintNextStart,
      dueDate: sprintNextStart,
      assignees: { create: { userId } },
    },
  });

  const tDesign = await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secDoing.id,
      sprintId: spActive.id,
      createdById: userId,
      title: 'Showcase · API design for bulk invite',
      workItemType: TaskWorkItemType.TASK,
      storyPoints: 3,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      sortOrder: 0,
      startDate: sprintActiveStart,
      dueDate: sprintActiveEnd,
      assignees: { create: { userId: colleagueId } },
    },
  });

  const tBuild = await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secReady.id,
      sprintId: spActive.id,
      createdById: userId,
      title: 'Showcase · Implement bulk invite endpoint',
      workItemType: TaskWorkItemType.TASK,
      storyPoints: 5,
      status: TaskStatus.READY,
      sortOrder: 1,
      startDate: sprintActiveStart,
      dueDate: sprintActiveEnd,
      assignees: { create: { userId } },
    },
  });

  const tQA = await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secBacklog.id,
      sprintId: spActive.id,
      createdById: userId,
      title: 'Showcase · QA bulk invite flows',
      workItemType: TaskWorkItemType.TASK,
      storyPoints: 2,
      status: TaskStatus.BACKLOG,
      sortOrder: 2,
      startDate: sprintActiveStart,
      dueDate: sprintActiveEnd,
    },
  });

  await prisma.taskDependency.createMany({
    data: [
      { dependentId: tBuild.id, blockingId: tDesign.id, type: DependencyType.WAITING_ON },
      { dependentId: tQA.id, blockingId: tBuild.id, type: DependencyType.WAITING_ON },
    ],
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secDoing.id,
      sprintId: spActive.id,
      epicTaskId: epic.id,
      createdById: userId,
      title: 'Showcase · BUG: Tooltip clipped on mobile',
      workItemType: TaskWorkItemType.BUG,
      storyPoints: 2,
      status: TaskStatus.IN_PROGRESS,
      sortOrder: 3,
      priority: TaskPriority.URGENT,
      assignees: { create: { userId } },
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secReview.id,
      sprintId: spActive.id,
      createdById: userId,
      title: 'Showcase · DONE in active sprint (burn sample)',
      workItemType: TaskWorkItemType.STORY,
      storyPoints: 1,
      status: TaskStatus.DONE,
      sortOrder: 0,
      completedAt: utcDay(now),
      assignees: { create: { userId } },
    },
  });

  const nextWed = new Date(now);
  const w = nextWed.getUTCDay();
  const add = (3 + 7 - w) % 7 || 7;
  nextWed.setUTCDate(nextWed.getUTCDate() + add);
  nextWed.setUTCHours(12, 0, 0, 0);

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secBacklog.id,
      createdById: userId,
      title: 'Showcase · Weekly release notes draft',
      description: 'Recurring Wed anchor for calendar/timeline + recurrence QA.',
      status: TaskStatus.READY,
      sortOrder: 9,
      dueDate: nextWed,
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=WE',
      assignees: { create: { userId } },
    },
  });

  await prisma.task.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      sectionId: secBacklog.id,
      createdById: userId,
      title: 'Template · Showcase incident checklist',
      description: 'Task template inside Feature showcase (hidden from default lists).',
      status: TaskStatus.BACKLOG,
      sortOrder: 8,
      isTemplate: true,
    },
  });

  await prisma.task.createMany({
    data: [
      {
        workspaceId: wsId,
        projectId: project.id,
        sectionId: secBacklog.id,
        createdById: userId,
        title: 'Showcase · Backlog ranked #1',
        status: TaskStatus.BACKLOG,
        sortOrder: 10,
        backlogRank: 1,
      },
      {
        workspaceId: wsId,
        projectId: project.id,
        sectionId: secBacklog.id,
        createdById: userId,
        title: 'Showcase · Backlog ranked #2',
        status: TaskStatus.BACKLOG,
        sortOrder: 11,
        backlogRank: 2,
      },
      {
        workspaceId: wsId,
        projectId: project.id,
        sectionId: secBacklog.id,
        createdById: userId,
        title: 'Showcase · Scheduled for next sprint',
        status: TaskStatus.BACKLOG,
        sortOrder: 12,
        sprintId: spNext.id,
        storyPoints: 3,
      },
    ],
  });

  await prisma.customFieldValue.createMany({
    data: [
      {
        taskId: tDesign.id,
        fieldId: cfUrl.id,
        value: { text: 'https://example.com/showcase/spec-bulk-invite' },
      },
      { taskId: tDesign.id, fieldId: cfCheckbox.id, value: { checked: true } },
      {
        taskId: tDesign.id,
        fieldId: cfMulti.id,
        value: { values: ['Backend', 'Docs'] },
      },
      { taskId: tDesign.id, fieldId: cfPerson.id, value: { text: colleagueId } },
      { taskId: tDesign.id, fieldId: cfText.id, value: { text: 'Rate limit unknowns' } },
      {
        taskId: tBuild.id,
        fieldId: cfUrl.id,
        value: { text: 'https://example.com/showcase/openapi' },
      },
      { taskId: tMilestone.id, fieldId: cfCheckbox.id, value: { checked: false } },
    ],
  });

  await prisma.taskTag.createMany({
    data: [
      { taskId: tDesign.id, tagId: tagAuto.id },
      { taskId: epic.id, tagId: tagAuto.id },
    ],
  });

  await prisma.attachment.create({
    data: {
      taskId: tBuild.id,
      uploadedById: userId,
      filename: 'showcase-bulk-invite-notes.md',
      mimeType: 'text/markdown',
      sizeBytes: 1536,
      url: 'https://example.com/showcase/bulk-invite.md',
      storageKey: 'link:showcase-bulk-invite-seed',
    },
  });

  const rootComment = await prisma.comment.create({
    data: {
      taskId: tBuild.id,
      authorId: userId,
      body: 'Starting implementation — @Demo Colleague can you review the error contract when you are back?',
    },
  });
  const reply = await prisma.comment.create({
    data: {
      taskId: tBuild.id,
      authorId: colleagueId,
      parentCommentId: rootComment.id,
      body: 'Reply: will align with `422` + field errors; see thread.',
    },
  });
  await prisma.commentMention.create({
    data: { commentId: rootComment.id, userId: colleagueId },
  });
  await prisma.comment.create({
    data: {
      taskId: tBuild.id,
      authorId: userId,
      parentCommentId: reply.id,
      body: 'Nested reply for deep thread QA.',
    },
  });

  await prisma.projectSavedView.createMany({
    data: [
      {
        projectId: project.id,
        createdById: userId,
        name: 'Backlog (roots)',
        sortOrder: 0,
        config: { sprintFilter: 'backlog', rootsOnly: true, surface: 'backlog' },
      },
      {
        projectId: project.id,
        createdById: userId,
        name: 'Current sprint board',
        sortOrder: 1,
        config: { sprintFilter: spActive.id, surface: 'sprint-board', rootsOnly: false },
      },
      {
        projectId: project.id,
        createdById: userId,
        name: 'Epic focus',
        sortOrder: 2,
        config: {
          sprintFilter: 'all',
          epicFilter: epic.id,
          rootsOnly: false,
          surface: 'roadmap',
        },
      },
      {
        projectId: project.id,
        createdById: userId,
        name: 'Workload (4w)',
        sortOrder: 3,
        config: {
          sprintFilter: 'all',
          rootsOnly: false,
          surface: 'workload',
          workloadWeeks: 4,
        },
      },
      {
        projectId: project.id,
        createdById: userId,
        name: 'Burndown tab',
        sortOrder: 4,
        config: {
          sprintFilter: spActive.id,
          surface: 'burndown',
        },
      },
      {
        projectId: project.id,
        createdById: userId,
        name: 'Flow / CFD',
        sortOrder: 5,
        config: { sprintFilter: 'all', surface: 'flow' },
      },
    ],
  });

  const intakeFields = [
    {
      id: 'intake_title',
      type: 'SHORT_TEXT',
      label: 'Request title',
      required: true,
      mapsTo: 'TITLE',
      maxLength: 120,
      helpText: 'Shown as the new task title',
    },
    {
      id: 'intake_desc',
      type: 'LONG_TEXT',
      label: 'Details',
      required: false,
      mapsTo: 'DESCRIPTION',
      maxLength: 2000,
    },
    {
      id: 'intake_email',
      type: 'EMAIL',
      label: 'Contact email',
      required: true,
      mapsTo: 'DETAIL',
      helpText: 'Stored in task description block on create',
    },
    {
      id: 'intake_pri',
      type: 'DROPDOWN',
      label: 'Priority',
      required: true,
      options: ['Low', 'Medium', 'High'],
      mapsTo: 'DETAIL',
    },
    {
      id: 'intake_h',
      type: 'HEADING',
      label: 'Optional',
      required: false,
      mapsTo: 'NONE',
    },
    {
      id: 'intake_url',
      type: 'URL',
      label: 'Reference URL',
      required: false,
      mapsTo: 'DETAIL',
    },
  ];

  await prisma.projectIntakeForm.create({
    data: {
      projectId: project.id,
      createdById: userId,
      name: 'Showcase intake',
      description: 'Published demo form — open builder or public `/i/seed-showcase-intake`',
      isPublished: true,
      publicToken: 'seed-showcase-intake',
      targetSectionId: secBacklog.id,
      fields: intakeFields,
    },
  });

  await prisma.automation.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      name: 'Showcase · tag + notify on move to Ready',
      isActive: true,
      triggerType: AutomationTriggerType.TASK_STATUS_CHANGED,
      triggerConfig: { fromStatus: 'BACKLOG', toStatus: 'READY' },
      actions: {
        create: [
          {
            actionType: AutomationActionType.ADD_TAG,
            actionConfig: { tagId: tagAuto.id },
            sortOrder: 0,
          },
          {
            actionType: AutomationActionType.NOTIFY_USER,
            actionConfig: {
              userId: colleagueId,
              title: 'Showcase automation',
              body: 'A task moved from Backlog → Ready',
            },
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await prisma.automation.create({
    data: {
      workspaceId: wsId,
      projectId: project.id,
      name: 'Showcase · subtask when entering Review',
      isActive: true,
      triggerType: AutomationTriggerType.TASK_STATUS_CHANGED,
      triggerConfig: { toStatus: 'IN_REVIEW' },
      actions: {
        create: [
          {
            actionType: AutomationActionType.CREATE_SUBTASK,
            actionConfig: { title: 'Showcase · Automation: checklist item' },
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const hookSecret = `seed_${randomBytes(16).toString('hex')}`;
  const existingHook = await prisma.workspaceOutboundWebhook.findFirst({
    where: { workspaceId: wsId, name: 'Showcase seed webhook' },
  });
  if (!existingHook) {
    await prisma.workspaceOutboundWebhook.create({
      data: {
        workspaceId: wsId,
        name: 'Showcase seed webhook',
        url: 'https://example.com/vineroot-webhook-sink',
        secret: hookSecret,
        eventTypes: ['TASK_CREATED', 'TASK_STATUS_CHANGED', 'TASK_COMPLETED'],
        isActive: false,
      },
    });
  }

  const existingAgentTok = await prisma.agentToken.findFirst({
    where: { workspaceId: wsId, name: 'Showcase dev agent token' },
  });
  if (!existingAgentTok) {
    await prisma.agentToken.create({
      data: {
        workspaceId: wsId,
        userId,
        name: 'Showcase dev agent token',
        token: `vr_seed_showcase_${randomBytes(12).toString('hex')}`,
        scope: [AgentTokenScope.READ_TASKS, AgentTokenScope.WRITE_TASKS],
        actorTier: 'CURSOR_COMPOSER',
        isActive: true,
      },
    });
  }

  for (let i = 6; i >= 0; i--) {
    const day = utcDay(now);
    day.setUTCDate(day.getUTCDate() - i);
    const backlog = 4 + Math.floor(i / 2);
    const ready = 2;
    const prog = 3 - Math.min(2, Math.floor(i / 3));
    const review = 1;
    const done = 5 + (6 - i);
    await prisma.projectCfdSnapshot.upsert({
      where: { projectId_day: { projectId: project.id, day } },
      create: {
        projectId: project.id,
        day,
        byStatus: {
          BACKLOG: backlog,
          READY: ready,
          IN_PROGRESS: prog,
          IN_REVIEW: review,
          DONE: done,
        },
      },
      update: {
        byStatus: {
          BACKLOG: backlog,
          READY: ready,
          IN_PROGRESS: prog,
          IN_REVIEW: review,
          DONE: done,
        },
      },
    });
  }

  let rem = 18;
  for (let i = 0; i < 8; i++) {
    const day = utcDay(now);
    day.setUTCDate(day.getUTCDate() - (7 - i));
    rem = Math.max(0, rem - 2);
    await prisma.sprintMetricSnapshot.upsert({
      where: { sprintId_day: { sprintId: spActive.id, day } },
      create: {
        sprintId: spActive.id,
        day,
        remainingPoints: rem,
        scopePoints: 22,
        completedCumulative: 22 - rem,
      },
      update: {
        remainingPoints: rem,
        scopePoints: 22,
        completedCumulative: 22 - rem,
      },
    });
  }

  await prisma.activityLog.createMany({
    data: [
      {
        projectId: project.id,
        taskId: epic.id,
        actorId: userId,
        eventType: AuditEventType.TASK_CREATED,
        description: 'Seeded epic for roadmap / roll-up demos',
      },
      {
        projectId: project.id,
        taskId: tDesign.id,
        actorId: colleagueId,
        eventType: AuditEventType.STATUS_CHANGED,
        description: 'Moved to In progress (showcase seed)',
      },
    ],
  });

  const port = await prisma.portfolio.findFirst({
    where: { workspaceId: wsId, name: 'Demo: Product bets' },
  });
  if (port) {
    await prisma.portfolioItem.upsert({
      where: {
        portfolioId_projectId: { portfolioId: port.id, projectId: project.id },
      },
      create: { portfolioId: port.id, projectId: project.id, sortOrder: 2 },
      update: {},
    });
  }

  const dashDup = await prisma.dashboard.findFirst({
    where: { workspaceId: wsId, name: 'Demo: Showcase PM charts' },
  });
  if (!dashDup) {
    await prisma.dashboard.create({
      data: {
        workspaceId: wsId,
        createdById: userId,
        name: 'Demo: Showcase PM charts',
        description: 'CFD widget wired to Feature showcase project',
        color: '#7c3aed',
        layoutMeta: { schemaVersion: 1 },
        widgets: {
          create: [
            {
              type: 'PROJECT_CFD',
              title: 'Cumulative flow (showcase)',
              sortOrder: 0,
              gridX: 0,
              gridY: 0,
              gridW: 12,
              gridH: 4,
              config: { projectId: project.id },
            },
          ],
        },
      },
    });
  }

  console.log('[seed] Feature showcase:', FEATURE_SHOWCASE_MARKER, '| colleague:', COLLEAGUE_EMAIL);
}

async function seedDashboards(wsId: string, userId: string): Promise<void> {
  const dup = await prisma.dashboard.findFirst({
    where: { workspaceId: wsId, name: 'Demo: Workspace overview' },
  });
  if (dup) {
    console.log('[seed] Demo dashboard already exists:', dup.id);
    return;
  }

  const project = await prisma.project.findFirst({
    where: {
      deletedAt: null,
      workspaceLinks: { some: { workspaceId: wsId } },
    },
  });

  await prisma.dashboard.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      name: 'Demo: Workspace overview',
      description:
        'Seeded Asana-style dashboard: charts, KPIs, agent slot, and extension notes for future agentic flows.',
      color: '#6366f1',
      layoutMeta: {
        schemaVersion: 1,
        agentSurfaceHints: ['tasks_overview', 'project_health', 'narrative_slot'],
      },
      widgets: {
        create: [
          {
            type: 'TASKS_BY_STATUS',
            title: 'Tasks by status',
            sortOrder: 0,
            gridX: 0,
            gridY: 0,
            gridW: 6,
            gridH: 3,
            config: {},
          },
          {
            type: 'NUMBER_METRIC',
            title: 'Open work (sample)',
            sortOrder: 1,
            gridX: 6,
            gridY: 0,
            gridW: 3,
            gridH: 2,
            config: { value: 12, label: 'Active tasks (demo)' },
          },
          {
            type: 'AGENT_SLOT',
            title: 'Agent insights',
            sortOrder: 2,
            gridX: 9,
            gridY: 0,
            gridW: 3,
            gridH: 2,
            config: {
              slotKey: 'insights_primary',
              description: 'Reserved for agent-generated KPIs and narratives.',
            },
          },
          ...(project
            ? [
                {
                  type: 'PROJECT_SUMMARY' as const,
                  title: 'Featured project',
                  sortOrder: 3,
                  gridX: 6,
                  gridY: 2,
                  gridW: 6,
                  gridH: 2,
                  config: { projectId: project.id },
                },
              ]
            : []),
          {
            type: 'TEXT_NOTE',
            title: 'Extending for agents',
            sortOrder: 4,
            gridX: 0,
            gridY: 3,
            gridW: 12,
            gridH: 2,
            config: {
              body:
                'Widgets store arbitrary JSON in `config`. Dashboard has `layoutMeta` for workspace-level agent hints. Future: agent PATCH endpoints, scheduled refresh, and pinned queries.',
            },
          },
        ],
      },
    },
  });

  await prisma.dashboard.create({
    data: {
      workspaceId: wsId,
      createdById: userId,
      name: 'Empty template',
      description: 'Add widgets from the UI to customize.',
      color: '#94a3b8',
      layoutMeta: { schemaVersion: 1 },
    },
  });

  console.log('[seed] Dashboards created for workspace id:', wsId);
}

/**
 * Ensures a full demo tenant: login, projects, tasks, portfolio, dashboards.
 * Idempotent: safe to run multiple times.
 */
async function main() {
  const ctx = await ensureDemoAccount();

  console.log('[seed] ─────────────────────────────────────────────');
  console.log('[seed] Local dev profile (sign-in):');
  console.log('[seed]   Email:   ', DEV_EMAIL);
  console.log('[seed]   Password:', DEV_PASSWORD);
  console.log('[seed] Workspace slug:', DEV_WORKSPACE_SLUG, '(or suffix if slug was taken)');
  console.log(
    '[seed] Try projects:',
    FEATURE_SHOWCASE_MARKER,
    '|',
    PARITY_PLAYGROUND_MARKER,
    '|',
    PARITY_BLUEPRINT_MARKER,
  );
  console.log('[seed] Second account (mentions / workload):', COLLEAGUE_EMAIL, '/', COLLEAGUE_PASSWORD);
  console.log('[seed] ─────────────────────────────────────────────');

  await seedRichDemoData(ctx);
  await seedDevParityPlayground(ctx);
  await seedFeatureShowcase(ctx);
  await seedDashboards(ctx.workspaceId, ctx.userId);

  const ws = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } });
  console.log(
    '[seed] Done. Sign in with dev profile above → workspace:',
    ws?.name,
    '| slug:',
    ws?.slug,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
