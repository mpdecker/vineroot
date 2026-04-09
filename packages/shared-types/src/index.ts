// ─── STRING CONSTANTS + TYPES (Node strip-only TS does not support `enum`) ─────

export const TaskStatus = {
  BACKLOG: "BACKLOG",
  READY: "READY",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
  ESCALATION_PENDING: "ESCALATION_PENDING",
  BLOCKED_AWAITING_HUMAN: "BLOCKED_AWAITING_HUMAN",
  BLOCKED_HUMAN_REROUTE: "BLOCKED_HUMAN_REROUTE",
  REROUTED_READY: "REROUTED_READY",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  NONE: "NONE",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

/** Board WIP: OFF = limits optional/display only; WARN = client may confirm over limit; STRICT = API rejects. */
export const KanbanWipEnforcement = {
  OFF: "OFF",
  WARN: "WARN",
  STRICT: "STRICT",
} as const;
export type KanbanWipEnforcement =
  (typeof KanbanWipEnforcement)[keyof typeof KanbanWipEnforcement];

export const ProjectColor = {
  RED: "RED",
  ORANGE: "ORANGE",
  YELLOW: "YELLOW",
  GREEN: "GREEN",
  TEAL: "TEAL",
  BLUE: "BLUE",
  INDIGO: "INDIGO",
  PURPLE: "PURPLE",
  PINK: "PINK",
  GRAY: "GRAY",
} as const;
export type ProjectColor = (typeof ProjectColor)[keyof typeof ProjectColor];

export const WorkspaceRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  GUEST: "GUEST",
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const ProjectRole = {
  OWNER: "OWNER",
  EDITOR: "EDITOR",
  COMMENTER: "COMMENTER",
  VIEWER: "VIEWER",
} as const;
export type ProjectRole = (typeof ProjectRole)[keyof typeof ProjectRole];

export const TeamRole = {
  LEAD: "LEAD",
  MEMBER: "MEMBER",
} as const;
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

export const ActorTier = {
  HUMAN: "HUMAN",
  CLAUDE_SONNET: "CLAUDE_SONNET",
  CLAUDE_OPUS: "CLAUDE_OPUS",
  CURSOR_COMPOSER: "CURSOR_COMPOSER",
  CREW_UIUX: "CREW_UIUX",
  CREW_BACKEND: "CREW_BACKEND",
  CREW_QA: "CREW_QA",
  CREW_DEVOPS: "CREW_DEVOPS",
  CREW_INFRA: "CREW_INFRA",
  CREW_DATA: "CREW_DATA",
  CREW_PLANNING: "CREW_PLANNING",
  CREW_LIBRARY: "CREW_LIBRARY",
  UNASSIGNED: "UNASSIGNED",
} as const;
export type ActorTier = (typeof ActorTier)[keyof typeof ActorTier];

export const TaskDomain = {
  UIUX: "UIUX",
  BACKEND: "BACKEND",
  INFRA: "INFRA",
  DATA: "DATA",
  TESTING: "TESTING",
  DEVOPS: "DEVOPS",
  PLANNING: "PLANNING",
  REVIEW: "REVIEW",
  LIBRARY: "LIBRARY",
  GENERAL: "GENERAL",
} as const;
export type TaskDomain = (typeof TaskDomain)[keyof typeof TaskDomain];

export const TaskComplexity = {
  TRIVIAL: "TRIVIAL",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type TaskComplexity = (typeof TaskComplexity)[keyof typeof TaskComplexity];

export const ReviewGate = {
  NONE: "NONE",
  AUTOMATED_ONLY: "AUTOMATED_ONLY",
  CRITIC_REVIEW: "CRITIC_REVIEW",
  HUMAN_SIGNOFF: "HUMAN_SIGNOFF",
  FULL: "FULL",
} as const;
export type ReviewGate = (typeof ReviewGate)[keyof typeof ReviewGate];

export const DependencyType = {
  BLOCKING: "BLOCKING",
  WAITING_ON: "WAITING_ON",
} as const;
export type DependencyType = (typeof DependencyType)[keyof typeof DependencyType];

/** CPM link type (Microsoft Project). */
export const ScheduleLinkType = {
  FS: "FS",
  SS: "SS",
  FF: "FF",
  SF: "SF",
} as const;
export type ScheduleLinkType =
  (typeof ScheduleLinkType)[keyof typeof ScheduleLinkType];

export const TaskConstraintType = {
  ASAP: "ASAP",
  ALAP: "ALAP",
  SNET: "SNET",
  SNLT: "SNLT",
  MSO: "MSO",
  MFO: "MFO",
} as const;
export type TaskConstraintType =
  (typeof TaskConstraintType)[keyof typeof TaskConstraintType];

export const TaskScheduleMode = {
  MANUAL: "MANUAL",
  FIXED_UNITS: "FIXED_UNITS",
  FIXED_WORK: "FIXED_WORK",
  FIXED_DURATION: "FIXED_DURATION",
} as const;
export type TaskScheduleMode =
  (typeof TaskScheduleMode)[keyof typeof TaskScheduleMode];

/** Work spread in timephased API (Phase 4); does not affect CPM dates. */
export const TaskWorkContour = {
  FLAT: "FLAT",
  FRONT_LOADED: "FRONT_LOADED",
  BACK_LOADED: "BACK_LOADED",
  BELL: "BELL",
  DOUBLE_PEAK: "DOUBLE_PEAK",
  TURTLE: "TURTLE",
  EARLY_PEAK: "EARLY_PEAK",
  LATE_PEAK: "LATE_PEAK",
} as const;
export type TaskWorkContour =
  (typeof TaskWorkContour)[keyof typeof TaskWorkContour];

export const TaskWorkItemType = {
  TASK: "TASK",
  STORY: "STORY",
  BUG: "BUG",
  EPIC: "EPIC",
  CHORE: "CHORE",
  SPIKE: "SPIKE",
} as const;
export type TaskWorkItemType =
  (typeof TaskWorkItemType)[keyof typeof TaskWorkItemType];

export const SprintState = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
} as const;
export type SprintState = (typeof SprintState)[keyof typeof SprintState];

export const CustomFieldType = {
  TEXT: "TEXT",
  NUMBER: "NUMBER",
  DATE: "DATE",
  DROPDOWN: "DROPDOWN",
  CHECKBOX: "CHECKBOX",
  MULTI_SELECT: "MULTI_SELECT",
  PERSON: "PERSON",
  URL: "URL",
} as const;
export type CustomFieldType =
  (typeof CustomFieldType)[keyof typeof CustomFieldType];

export const CustomFieldComputedKind = {
  NONE: "NONE",
  SUBTASK_ROLLUP_NUMBER: "SUBTASK_ROLLUP_NUMBER",
} as const;
export type CustomFieldComputedKind =
  (typeof CustomFieldComputedKind)[keyof typeof CustomFieldComputedKind];

export const CustomFieldRollupAggregation = {
  SUM: "SUM",
  AVG: "AVG",
  MIN: "MIN",
  MAX: "MAX",
  COUNT: "COUNT",
} as const;
export type CustomFieldRollupAggregation =
  (typeof CustomFieldRollupAggregation)[keyof typeof CustomFieldRollupAggregation];

export const GoalMetricType = {
  PERCENT: "PERCENT",
  NUMBER: "NUMBER",
  CURRENCY: "CURRENCY",
  BOOLEAN: "BOOLEAN",
} as const;
export type GoalMetricType =
  (typeof GoalMetricType)[keyof typeof GoalMetricType];

export const GoalStatus = {
  ON_TRACK: "ON_TRACK",
  AT_RISK: "AT_RISK",
  OFF_TRACK: "OFF_TRACK",
  ACHIEVED: "ACHIEVED",
  MISSED: "MISSED",
  NO_STATUS: "NO_STATUS",
} as const;
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

export const NotificationType = {
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_COMMENTED: "TASK_COMMENTED",
  TASK_COMPLETED: "TASK_COMPLETED",
  TASK_DUE_SOON: "TASK_DUE_SOON",
  TASK_OVERDUE: "TASK_OVERDUE",
  PROJECT_INVITE: "PROJECT_INVITE",
  MENTION: "MENTION",
  RULE_TRIGGERED: "RULE_TRIGGERED",
  AGENT_ACTION: "AGENT_ACTION",
  ESCALATION: "ESCALATION",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const AutomationTriggerType = {
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  TASK_CREATED: "TASK_CREATED",
  TASK_DUE_DATE_APPROACHING: "TASK_DUE_DATE_APPROACHING",
  TASK_OVERDUE: "TASK_OVERDUE",
  TASK_COMPLETED: "TASK_COMPLETED",
  ASSIGNEE_CHANGED: "ASSIGNEE_CHANGED",
  CUSTOM_FIELD_CHANGED: "CUSTOM_FIELD_CHANGED",
  SECTION_CHANGED: "SECTION_CHANGED",
  AGENT_COMPLETED: "AGENT_COMPLETED",
} as const;
export type AutomationTriggerType =
  (typeof AutomationTriggerType)[keyof typeof AutomationTriggerType];

/** Emitted by workspace outbound webhooks (signed POST). */
export const OUTBOUND_WEBHOOK_TRIGGER_TYPES = [
  AutomationTriggerType.TASK_CREATED,
  AutomationTriggerType.TASK_STATUS_CHANGED,
  AutomationTriggerType.TASK_COMPLETED,
  AutomationTriggerType.ASSIGNEE_CHANGED,
  AutomationTriggerType.SECTION_CHANGED,
  AutomationTriggerType.AGENT_COMPLETED,
] as const;

export const AutomationActionType = {
  CHANGE_STATUS: "CHANGE_STATUS",
  ASSIGN_TO: "ASSIGN_TO",
  MOVE_TO_SECTION: "MOVE_TO_SECTION",
  ADD_TAG: "ADD_TAG",
  REMOVE_TAG: "REMOVE_TAG",
  NOTIFY_USER: "NOTIFY_USER",
  SET_PRIORITY: "SET_PRIORITY",
  SET_DUE_DATE: "SET_DUE_DATE",
  TRIGGER_AGENT: "TRIGGER_AGENT",
  CREATE_SUBTASK: "CREATE_SUBTASK",
  POST_WEBHOOK: "POST_WEBHOOK",
  SLACK_NOTIFY: "SLACK_NOTIFY",
} as const;
export type AutomationActionType =
  (typeof AutomationActionType)[keyof typeof AutomationActionType];

export const AuditEventType = {
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_DELETED: "TASK_DELETED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
  STATUS_CHANGED: "STATUS_CHANGED",
  ESCALATION: "ESCALATION",
  AGENT_STARTED: "AGENT_STARTED",
  AGENT_COMPLETED: "AGENT_COMPLETED",
  AGENT_FAILED: "AGENT_FAILED",
  REROUTED: "REROUTED",
  HUMAN_SIGNOFF: "HUMAN_SIGNOFF",
  COMMENT_ADDED: "COMMENT_ADDED",
  ATTACHMENT_ADDED: "ATTACHMENT_ADDED",
  RULE_TRIGGERED: "RULE_TRIGGERED",
} as const;
export type AuditEventType =
  (typeof AuditEventType)[keyof typeof AuditEventType];

export const AgentTokenScope = {
  READ_TASKS: "READ_TASKS",
  WRITE_TASKS: "WRITE_TASKS",
  READ_PROJECTS: "READ_PROJECTS",
  WRITE_PROJECTS: "WRITE_PROJECTS",
  FULL_ACCESS: "FULL_ACCESS",
} as const;
export type AgentTokenScope =
  (typeof AgentTokenScope)[keyof typeof AgentTokenScope];

// ─── AUTHENTICATION & USER ────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: WorkspaceRole;
  isAgent: boolean;
  agentTier?: ActorTier;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isAgent: boolean;
  agentTier?: ActorTier;
  timezone: string;
  /** Optional personal work calendar (e.g. for leveling); must be in a workspace you belong to. */
  workCalendarId?: string | null;
  /** Default standard rate per hour for cost / EVM when assigned to tasks. */
  resourceStandardRatePerHour?: number | null;
  resourceOvertimeRatePerHour?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  workspaceName?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  timezone?: string;
  workCalendarId?: string | null;
  resourceStandardRatePerHour?: number | null;
  resourceOvertimeRatePerHour?: number | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ─── WORKSPACE ────────────────────────────────────────────────────────────────

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  /** True when a Slack Incoming Webhook URL is stored (URL itself is never returned). */
  slackIncomingWebhookConfigured?: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
  members?: WorkspaceMemberDto[];
}

export interface WorkspaceMemberDto {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  user: UserDto;
  joinedAt: Date;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  logoUrl?: string;
  /** Set to empty string or null to clear. Owner/admin only. */
  slackIncomingWebhookUrl?: string | null;
}

export interface InviteMemberRequest {
  email: string;
  role: WorkspaceRole;
}

/** Workspace outbound webhooks: HTTPS POST with `X-Vineroot-Signature: sha256=<hmac>`. */
export interface OutboundWebhookDto {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOutboundWebhookRequest {
  name: string;
  url: string;
  /** Empty or omit = all automation-aligned task events. */
  eventTypes?: string[];
}

export interface CreateOutboundWebhookResponse {
  webhook: OutboundWebhookDto;
  signingSecret: string;
}

export interface UpdateOutboundWebhookRequest {
  name?: string;
  url?: string;
  eventTypes?: string[];
  isActive?: boolean;
}

// ─── TEAM ─────────────────────────────────────────────────────────────────────

export interface TeamDto {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  emoji?: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
  members?: TeamMemberDto[];
}

export interface TeamMemberDto {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  user: UserDto;
  joinedAt: Date;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  color?: string;
  emoji?: string;
  isPrivate?: boolean;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  color?: string;
  emoji?: string;
  isPrivate?: boolean;
}

// ─── PROJECT ──────────────────────────────────────────────────────────────────

export interface ProjectDto {
  id: string;
  /** Workspaces this project is linked to (required: at least one in normal use). */
  workspaceIds: string[];
  teamId?: string;
  createdById: string;
  name: string;
  description?: string;
  color: ProjectColor;
  emoji?: string;
  status: ProjectStatus;
  isPrivate: boolean;
  isArchived: boolean;
  /** Blueprint project; omitted from default workspace lists unless requested. */
  isTemplate: boolean;
  startDate?: Date;
  dueDate?: Date;
  defaultView: string;
  kanbanWipEnforcement?: KanbanWipEnforcement;
  createdAt: Date;
  updatedAt: Date;
  sectionCount?: number;
  /** Root tasks still open (excludes subtasks, deleted, done, cancelled). */
  taskCount?: number;
  /** Root tasks marked done or cancelled (excludes subtasks, deleted). */
  completedTaskCount?: number;
  memberCount?: number;
  members?: ProjectMemberDto[];
  sections?: SectionDto[];
  /** Time-boxed iterations (Scrum); empty when none created. */
  sprints?: SprintDto[];
  workCalendarId?: string | null;
  defaultManualSchedule?: boolean;
}

export interface SprintDto {
  id: string;
  projectId: string;
  name: string;
  goal?: string | null;
  startDate: Date;
  endDate: Date;
  state: SprintState;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSprintRequest {
  name: string;
  goal?: string;
  startDate: Date | string;
  endDate: Date | string;
  state?: SprintState;
}

export interface UpdateSprintRequest {
  name?: string;
  goal?: string | null;
  startDate?: Date | string;
  endDate?: Date | string;
  state?: SprintState;
  sortOrder?: number;
}

/** GET …/projects/:projectId/sprints/:sprintId/burndown — MVP from current tasks + completedAt. Optional query `from` & `to` (YYYY-MM-DD) clamp to sprint; `ideal` uses full-sprint day index. */
export interface SprintBurndownDayDto {
  /** ISO calendar date (YYYY-MM-DD). */
  date: string;
  remaining: number;
  ideal: number;
}

export interface SprintBurndownDto {
  sprintId: string;
  projectId: string;
  totalScope: number;
  days: SprintBurndownDayDto[];
}

/** GET …/projects/:projectId/sprints/:sprintId/burnup — cumulative completed vs scope (MVP: flat scope from current sprint tasks). */
export interface SprintBurnupDayDto {
  date: string;
  /** Sum of storyPoints for DONE tasks completed from sprint start through this day (inclusive). */
  completedCumulative: number;
  /** Current total committed scope (non-cancelled, same as burndown totalScope); repeated per day until snapshots exist. */
  scopeTotal: number;
}

/** One row per calendar day where committed scope changed vs the previous day (snapshot-driven). */
export interface SprintBurnupScopeChangeDto {
  date: string;
  /** Change in scope points (positive = scope added). */
  delta: number;
  scopeAfter: number;
}

export interface SprintBurnupDto {
  sprintId: string;
  projectId: string;
  totalScope: number;
  /** Scope at the first day in the series (commitment baseline for the chart). */
  initialScope: number;
  /** Mid-sprint scope movements derived from per-day snapshot `scopeTotal` deltas. */
  scopeChanges: SprintBurnupScopeChangeDto[];
  days: SprintBurnupDayDto[];
}

/** GET …/projects/:projectId/cfd — cumulative flow; days forward-filled from snapshots with live bootstrap when missing. */
export interface ProjectCfdDayDto {
  date: string;
  byStatus: Record<string, number>;
}

export interface ProjectCfdDto {
  projectId: string;
  days: ProjectCfdDayDto[];
  /** Recommended series order for stacked charts. */
  statusOrder: string[];
}

/** GET …/projects/:projectId/epic-rollups — aggregates for descendant tasks under each EPIC work item. */
export interface EpicRollupDto {
  epicId: string;
  title: string;
  storyPointsTotal: number;
  /** Sum of storyPoints on DONE tasks in epic scope. */
  storyPointsDone: number;
  taskCount: number;
  doneCount: number;
}

export interface ProjectEpicRollupsDto {
  projectId: string;
  epics: EpicRollupDto[];
}

/** Stored filter preset for list/board/workload (sprint/epic shared across tabs). */
export interface ProjectSavedViewConfigDto {
  sprintFilter?: string;
  epicFilter?: string;
  rootsOnly?: boolean;
  /** When applying, navigate to this tab if set. */
  surface?:
    | "list"
    | "board"
    | "backlog"
    | "sprint-board"
    | "roadmap"
    | "epics"
    | "timeline"
    | "calendar"
    | "burndown"
    | "flow"
    | "workload"
    | "activity"
    | "timephased"
    | "network";
  /** Workload tab: week column count (4–26). */
  workloadWeeks?: number;
  /** Workload tab: optional YYYY-MM-DD; grid aligns to Monday of that week. */
  workloadFrom?: string;
  /** List/board backlog views: schedule row filter from `GET …/schedule/critical-path`. */
  listScheduleFilter?: "all" | "critical" | "slack" | "deadline";
  /** List/board backlog views: sort order using schedule fields. */
  listScheduleSort?:
    | "none"
    | "critical_first"
    | "slack_desc"
    | "deadline_breach_first"
    | "constraint_type";
  /** Timephased tab: mirrors `?granularity=&basis=&grid=` query params. */
  timephasedGranularity?: "week" | "day";
  timephasedBasis?: "calendar" | "working";
  timephasedGridMode?: "list" | "task_usage" | "resource_usage";
}

export interface ProjectSavedViewDto {
  id: string;
  projectId: string;
  createdById: string;
  name: string;
  config: ProjectSavedViewConfigDto;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectSavedViewRequest {
  name: string;
  config: ProjectSavedViewConfigDto;
  sortOrder?: number;
}

export interface UpdateProjectSavedViewRequest {
  name?: string;
  config?: ProjectSavedViewConfigDto;
  sortOrder?: number;
}

/** Reassign `sortOrder` to 0..n-1 in list order (must list every view in the project). */
export interface ReorderProjectSavedViewsRequest {
  orderedIds: string[];
}

// ─── Project intake form (public URL → task in target section) ───────────────

export type ProjectIntakeFieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "EMAIL"
  | "NUMBER"
  | "DROPDOWN"
  | "CHECKBOX"
  | "DATE"
  | "URL"
  /** File upload; value submitted as `data:<mime>;base64,...` (size limits enforced server-side). */
  | "FILE"
  /** Visual section break on the public form (no answer stored). */
  | "HEADING";

/**
 * Where the answer is copied when creating the task.
 * `NONE` is only valid for `HEADING` fields.
 */
export type ProjectIntakeFieldMapsTo =
  | "TITLE"
  | "DESCRIPTION"
  | "DETAIL"
  | "NONE";

export interface ProjectIntakeFormFieldDto {
  id: string;
  type: ProjectIntakeFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  /** Hint shown under the label on the public form. */
  helpText?: string;
  /** For DROPDOWN only. */
  options?: string[];
  mapsTo: ProjectIntakeFieldMapsTo;
  /** For text-like fields (short/long/email/url); enforced on submit. */
  maxLength?: number;
  /** For NUMBER fields; enforced on submit when set. */
  min?: number;
  max?: number;
  /** For FILE fields; max decoded size in bytes (default 5 MiB server-side). */
  maxFileSizeBytes?: number;
  /** For FILE fields; optional HTML `accept` hint (e.g. `image/*,.pdf`). */
  accept?: string;
}

export interface ProjectIntakeFormDto {
  projectId: string;
  name: string;
  description: string | null;
  targetSectionId: string;
  fields: ProjectIntakeFormFieldDto[];
  isPublished: boolean;
  publicToken: string | null;
}

export interface UpsertProjectIntakeFormRequest {
  name: string;
  description?: string | null;
  targetSectionId: string;
  fields: ProjectIntakeFormFieldDto[];
}

/** Public GET — no internal ids beyond field ids for posting values. */
export interface PublicProjectIntakeFormDto {
  projectName: string;
  formName: string;
  description: string | null;
  fields: ProjectIntakeFormFieldDto[];
  /** When set, public form should render Google reCAPTCHA v2/v3 and send `captchaToken` on submit. */
  captchaSiteKey?: string | null;
}

export interface SubmitProjectIntakeFormRequest {
  values: Record<string, string>;
  /** Required when server has `INTAKE_RECAPTCHA_SECRET` set. */
  captchaToken?: string;
}

/** GET …/projects/:projectId/sprints/velocity — completed story points per sprint (DONE in date range). */
export interface SprintVelocityBarDto {
  sprintId: string;
  name: string;
  /** ISO start of sprint (calendar day). */
  startDate: string;
  /** ISO end of sprint (calendar day). */
  endDate: string;
  state: SprintState;
  /** Sum of storyPoints for DONE tasks completed within [startDate, endDate] (inclusive). */
  completedPoints: number;
  completedTaskCount: number;
}

export interface ProjectSprintVelocityDto {
  projectId: string;
  sprints: SprintVelocityBarDto[];
  /** Arithmetic mean of completedPoints across returned sprints. */
  averageCompletedPoints: number;
}

export interface ProjectMemberDto {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  user: UserDto;
  joinedAt: Date;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: ProjectColor;
  emoji?: string;
  teamId?: string;
  /** When true, project is a template (hidden from default lists). */
  isTemplate?: boolean;
  /**
   * For POST /projects: at least one workspace id (you must be a member).
   * Omitted on POST .../workspaces/:workspaceId/projects — that workspace is used automatically.
   */
  workspaceIds?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  color?: ProjectColor;
  emoji?: string;
  status?: ProjectStatus;
  isPrivate?: boolean;
  isArchived?: boolean;
  isTemplate?: boolean;
  startDate?: Date;
  dueDate?: Date;
  defaultView?: string;
  /** When set, replaces all workspace links. Must include at least one id. */
  workspaceIds?: string[];
  teamId?: string | null;
  kanbanWipEnforcement?: KanbanWipEnforcement;
  workCalendarId?: string | null;
  defaultManualSchedule?: boolean;
}

// ─── SECTION ──────────────────────────────────────────────────────────────────

export interface SectionDto {
  id: string;
  projectId: string;
  name: string;
  color?: string;
  sortOrder: number;
  /** Max root tasks on the board column; null = no limit. */
  wipLimit?: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  taskCount?: number;
  tasks?: TaskDto[];
}

export interface CreateSectionRequest {
  name: string;
  color?: string;
  /** Optional WIP cap for root tasks in this column (≥1). */
  wipLimit?: number | null;
}

export interface UpdateSectionRequest {
  name?: string;
  color?: string;
  wipLimit?: number | null;
}

export interface ReorderSectionRequest {
  sortOrder: number;
}

// ─── TASK ─────────────────────────────────────────────────────────────────────

/** Minimal task shape embedded on dependency edges (detail API). */
export interface TaskSummaryDto {
  id: string;
  title: string;
  status: TaskStatus;
  projectId?: string;
  startDate?: Date;
  dueDate?: Date;
}

export interface TaskDependencyDto {
  id: string;
  dependentId: string;
  blockingId: string;
  type: DependencyType;
  /** CPM link type; FS default. */
  linkType?: ScheduleLinkType;
  /** Working-day lag when project uses WorkCalendar; else calendar-day compatible. */
  lagDays: number;
  /** When true, lag counts calendar days (MSP elapsed lag). */
  lagIsElapsed?: boolean;
  createdAt: Date;
  /** Present when this row is “dependent waits on blocking” (blocking task summary). */
  blockingTask?: TaskSummaryDto;
  /** Present when this row is “other task waits on this” (dependent task summary). */
  dependentTask?: TaskSummaryDto;
}

export interface TaskAttachmentDto {
  id: string;
  taskId: string;
  uploadedById?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: Date;
}

export interface TaskActivityLogDto {
  id: string;
  projectId?: string;
  taskId?: string;
  actorId: string;
  eventType: AuditEventType;
  description: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  createdAt: Date;
  actor?: Pick<UserDto, "id" | "email" | "displayName">;
  /** Present on project activity feed when the row is tied to a task. */
  task?: Pick<TaskSummaryDto, "id" | "title">;
}

export interface TaskDto {
  id: string;
  projectId?: string;
  sectionId?: string;
  parentTaskId?: string;
  /** Optional link to a root EPIC task in the same project (cross-parent). */
  epicTaskId?: string | null;
  createdById: string;
  title: string;
  description?: string;
  htmlContent?: string;
  workItemType: TaskWorkItemType;
  storyPoints?: number | null;
  sprintId?: string | null;
  sprint?: Pick<SprintDto, "id" | "name"> | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: Date;
  dueDate?: Date;
  completedAt?: Date;
  estimatedMin?: number;
  actualMin?: number;
  sortOrder: number;
  /** Lower = higher priority in backlog lists; null after sprint assignment or unset. */
  backlogRank?: number | null;
  actorTier: ActorTier;
  domain: TaskDomain;
  complexity: TaskComplexity;
  reviewGate: ReviewGate;
  phase?: number;
  parallelGroup?: string;
  agentContext?: Record<string, any>;
  agentOutput?: Record<string, any>;
  agentStartedAt?: Date;
  agentCompletedAt?: Date;
  retryCount: number;
  escalationNote?: string;
  isArchived: boolean;
  /** RRULE without DTSTART, e.g. FREQ=WEEKLY;INTERVAL=1;BYDAY=MO */
  recurrenceRule?: string;
  recurrenceUntil?: Date;
  isTemplate: boolean;
  isMilestone?: boolean;
  /** When false, schedule recalculation may update start/due dates. */
  isManuallyScheduled?: boolean;
  constraintType?: TaskConstraintType;
  constraintDate?: Date | null;
  deadlineDate?: Date | null;
  durationWorkingMinutes?: number | null;
  workMinutes?: number | null;
  scheduleMode?: TaskScheduleMode;
  /** Optional task work calendar (workspace calendar id). */
  workCalendarId?: string | null;
  effortDriven?: boolean;
  isSummaryRollup?: boolean;
  /** 0–1000; lower = delayed first when leveling resources (MSP-style). Default 500. */
  levelingPriority?: number;
  /** Accumulated working-day delay applied by resource leveling. */
  levelingDelayWorkingDays?: number;
  /** Hint for split-aware leveling (Phase 4); affects ordering when enabled on level request. */
  levelingCanSplit?: boolean;
  /** WBS-style outline e.g. "1.2.3" when returned from project-scoped APIs. */
  wbsOutlineNumber?: string | null;
  /** 0–100 */
  percentComplete?: number;
  fixedCost?: number | null;
  /** When set, EVM actual cost (AC) for this task; otherwise AC tracks EV. */
  actualCost?: number | null;
  /** Overtime labor minutes (actuals); labor BAC uses assignee OT rates on this share. */
  overtimeWorkMinutes?: number | null;
  /** Budget / cap line: excluded from operating EVM totals; see GET …/schedule/evm `budget` rollup. */
  isBudgetTask?: boolean;
  /** Optional split segments for timeline (Phase 7). */
  scheduleSegments?: TaskScheduleSegmentDto[] | null;
  /** Timephased work distribution when no segments (Phase 4). */
  workContour?: TaskWorkContour;
  createdAt: Date;
  updatedAt: Date;
  assignees?: TaskAssigneeDto[];
  genericResourceAssignments?: TaskGenericResourceAssignmentDto[];
  subtasks?: TaskDto[];
  tags?: TagDto[];
  customFields?: CustomFieldValueDto[];
  /** This task waits on these (blocking predecessors). */
  waitingOn?: TaskDependencyDto[];
  /** Tasks that wait on this one. */
  blockingTasks?: TaskDependencyDto[];
  attachments?: TaskAttachmentDto[];
  activityLogs?: TaskActivityLogDto[];
  commentCount?: number;
  subtaskCount?: number;
  createdBy?: UserDto;
}

export interface TaskAssigneeDto {
  id: string;
  taskId: string;
  userId: string;
  /** 1–100 allocation % for leveling. */
  unitsPercent?: number;
  /** Assignment work (minutes); when set, drives cost/EVM for this row instead of task work × units. */
  workMinutes?: number | null;
  /** One-time per-assignment fee added to task budget (e.g. per-use). */
  costPerUse?: number | null;
  user: UserDto;
  assignedAt: Date;
}

export interface GenericResourceDto {
  id: string;
  workspaceId: string;
  name: string;
  maxUnitsPercent: number;
  /** Optional hourly rate for cost / EVM when assigned to tasks with work. */
  standardRatePerHour?: number | null;
  /** Optional workspace work calendar; overload uses min(project, resource) working minutes. */
  workCalendarId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Workspace generic resource row attached to a task (equipment / named capacity). */
export interface TaskGenericResourceAssignmentDto {
  id: string;
  taskId: string;
  genericResourceId: string;
  unitsPercent: number;
  /** One-time per-assignment fee added to task budget. */
  costPerUse?: number | null;
  assignedAt: Date;
  genericResource: Pick<
    GenericResourceDto,
    'id' | 'name' | 'maxUnitsPercent' | 'standardRatePerHour'
  >;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  /** When set with POST /tasks, task is created inside this project (and optional section). Omit for personal / workspace-only tasks. */
  projectId?: string;
  sectionId?: string;
  priority?: TaskPriority;
  startDate?: Date;
  dueDate?: Date;
  assigneeIds?: string[];
  tagIds?: string[];
  parentTaskId?: string;
  /** Link this task to an EPIC in the same project (omit for none). */
  epicTaskId?: string | null;
  actorTier?: ActorTier;
  domain?: TaskDomain;
  complexity?: TaskComplexity;
  reviewGate?: ReviewGate;
  phase?: number;
  parallelGroup?: string;
  agentContext?: Record<string, any>;
  recurrenceRule?: string;
  recurrenceUntil?: Date;
  isTemplate?: boolean;
  workItemType?: TaskWorkItemType;
  storyPoints?: number | null;
  sprintId?: string | null;
  isMilestone?: boolean;
  /** Only when `sprintId` is unset; lower = higher in backlog ordering. */
  backlogRank?: number | null;
  isManuallyScheduled?: boolean;
  constraintType?: TaskConstraintType;
  constraintDate?: Date | null;
  deadlineDate?: Date | null;
  durationWorkingMinutes?: number | null;
  workMinutes?: number | null;
  scheduleMode?: TaskScheduleMode;
  workCalendarId?: string | null;
  effortDriven?: boolean;
  isSummaryRollup?: boolean;
  /** 0–1000 MSP-style leveling priority; default 500. */
  levelingPriority?: number;
  /** When true, split-friendly tasks are deferred last when “split-capable last” leveling is on. */
  levelingCanSplit?: boolean;
  percentComplete?: number;
  fixedCost?: number | null;
  actualCost?: number | null;
  overtimeWorkMinutes?: number | null;
  isBudgetTask?: boolean;
  scheduleSegments?: TaskScheduleSegmentDto[] | null;
  workContour?: TaskWorkContour;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  sectionId?: string;
  /** Omit to leave unchanged; `null` promotes to a top-level task (requires `sectionId` when previously nested). */
  parentTaskId?: string | null;
  sortOrder?: number;
  /** Omit to leave unchanged; `null` clears the value. */
  startDate?: Date | null;
  /** Omit to leave unchanged; `null` clears the value. */
  dueDate?: Date | null;
  estimatedMin?: number;
  actualMin?: number;
  actorTier?: ActorTier;
  domain?: TaskDomain;
  complexity?: TaskComplexity;
  reviewGate?: ReviewGate;
  phase?: number | null;
  parallelGroup?: string | null;
  agentContext?: Record<string, any>;
  agentOutput?: Record<string, any> | null;
  escalationNote?: string;
  /** Set or clear (null) recurrence; RRULE without DTSTART. */
  recurrenceRule?: string | null;
  recurrenceUntil?: Date | null;
  isTemplate?: boolean;
  workItemType?: TaskWorkItemType;
  /** Omit unchanged; `null` clears story points. */
  storyPoints?: number | null;
  /** Omit unchanged; `null` removes sprint assignment (backlog). */
  sprintId?: string | null;
  isMilestone?: boolean;
  /** Omit unchanged; `null` clears cross-parent epic link (target must be EPIC in same project). */
  epicTaskId?: string | null;
  /** Omit unchanged; `null` clears. Ignored while task has a sprint (rank is cleared on sprint assign). */
  backlogRank?: number | null;
  isManuallyScheduled?: boolean;
  constraintType?: TaskConstraintType;
  constraintDate?: Date | null;
  deadlineDate?: Date | null;
  durationWorkingMinutes?: number | null;
  workMinutes?: number | null;
  scheduleMode?: TaskScheduleMode;
  workCalendarId?: string | null;
  effortDriven?: boolean;
  isSummaryRollup?: boolean;
  /** 0–1000; omit unchanged. */
  levelingPriority?: number;
  levelingCanSplit?: boolean;
  percentComplete?: number;
  fixedCost?: number | null;
  actualCost?: number | null;
  /** Omit unchanged; `null` clears overtime minutes. */
  overtimeWorkMinutes?: number | null;
  isBudgetTask?: boolean;
  /** Omit unchanged; `null` clears split segments. */
  scheduleSegments?: TaskScheduleSegmentDto[] | null;
  workContour?: TaskWorkContour;
}

/** POST /tasks/:id/duplicate */
export interface DuplicateTaskRequest {
  /** Defaults to source task's project. */
  projectId?: string;
  sectionId?: string;
  title?: string;
}

/** POST .../projects/:id/duplicate */
export interface DuplicateProjectRequest {
  name?: string;
  /** Defaults to source links plus this workspace from the route. */
  workspaceIds?: string[];
}

export interface MoveTaskRequest {
  sectionId?: string;
  projectId?: string;
  sortOrder?: number;
}

export interface ReorderTasksRequest {
  items: Array<{
    taskId: string;
    sortOrder: number;
    sectionId?: string;
    /** Omit = unchanged; `null` = top-level task in column. */
    parentTaskId?: string | null;
  }>;
}

/** GET /search — workspace-scoped when `workspaceId` is passed (must be a member). */
export type SearchTaskMatchKind = "TITLE" | "DESCRIPTION" | "COMMENT";

export interface SearchTaskHitDto {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
  projectName: string | null;
  sectionId: string | null;
  /** Section name when the task sits in a section. */
  sectionName?: string | null;
  /** Where the query matched (title/description vs comment body). */
  matchKind?: SearchTaskMatchKind;
  /** Short excerpt when matched via comment (or future description snippets). */
  snippet?: string | null;
}

export interface SearchProjectHitDto {
  id: string;
  name: string;
  workspaceIds: string[];
}

export interface SearchSectionHitDto {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
}

export interface SearchTagHitDto {
  id: string;
  name: string;
  workspaceId: string;
  color: string;
}

export interface SearchResponseDto {
  tasks: SearchTaskHitDto[];
  projects: SearchProjectHitDto[];
  sections: SearchSectionHitDto[];
  tags: SearchTagHitDto[];
}

export interface AddTaskDependencyRequest {
  blockingTaskId: string;
  type?: DependencyType;
  /** CPM link type (default FS). */
  linkType?: ScheduleLinkType;
  /** Optional lag in whole days (default 0). Negative = lead. */
  lagDays?: number;
  /** Elapsed (calendar-day) lag in successor time zone vs working-day lag. */
  lagIsElapsed?: boolean;
}

export interface UpdateTaskDependencyLagRequest {
  lagDays: number;
}

export interface UpdateTaskDependencyScheduleRequest {
  lagDays?: number;
  linkType?: ScheduleLinkType;
  lagIsElapsed?: boolean;
}

export interface WorkCalendarDto {
  id: string;
  workspaceId: string;
  name: string;
  timeZone: string;
  weeklyPattern: Record<string, number>;
  exceptions: Array<{ date: string; workingMinutes: number }>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkCalendarRequest {
  name: string;
  timeZone?: string;
  weeklyPattern?: Record<string, number>;
  exceptions?: Array<{ date: string; workingMinutes: number }>;
  isDefault?: boolean;
}

export interface UpdateWorkCalendarRequest {
  name?: string;
  timeZone?: string;
  weeklyPattern?: Record<string, number>;
  exceptions?: Array<{ date: string; workingMinutes: number }>;
  isDefault?: boolean;
}

export interface CreateGenericResourceRequest {
  name: string;
  /** Default 100. Use above 100 for pooled capacity (e.g. two machines). */
  maxUnitsPercent?: number;
  standardRatePerHour?: number | null;
  /** Workspace work calendar id for resource availability (optional). */
  workCalendarId?: string | null;
}

export interface UpdateGenericResourceRequest {
  name?: string;
  maxUnitsPercent?: number;
  standardRatePerHour?: number | null;
  /** Omit unchanged; null clears resource calendar. */
  workCalendarId?: string | null;
}

export interface AddTaskGenericResourceAssignmentRequest {
  genericResourceId: string;
  unitsPercent?: number;
  /** Optional one-time fee for this assignment row. */
  costPerUse?: number | null;
}

export interface PatchTaskGenericResourceAssignmentRequest {
  /** Omit to leave units unchanged. */
  unitsPercent?: number;
  /** Omit = unchanged; null clears per-use cost. */
  costPerUse?: number | null;
}

export interface AddTaskAssigneeRequest {
  userId: string;
  /** 1–100 default 100; allocation % for workload and leveling. */
  unitsPercent?: number;
  /** Optional assignment work (minutes). */
  workMinutes?: number | null;
  /** One-time fee for this assignment row. */
  costPerUse?: number | null;
}

export interface PatchTaskAssigneeRequest {
  unitsPercent?: number;
  /** Omit = unchanged; null clears assignment work override. */
  workMinutes?: number | null;
  /** Omit = unchanged; null clears per-use cost. */
  costPerUse?: number | null;
}

export interface ScheduleProgramDto {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  projectIds?: string[];
}

export interface CreateScheduleProgramRequest {
  name: string;
}

export interface AddProjectToScheduleProgramRequest {
  projectId: string;
}

/** Per-project row for GET …/schedule-programs/:id/schedule-rollup (program / master schedule). */
export interface ScheduleProgramRollupProjectRowDto {
  projectId: string;
  projectName: string;
  /** Earliest task or project start in scope. */
  earliestStart: string | null;
  /** Latest task or project finish in scope. */
  latestFinish: string | null;
  criticalTaskCount: number;
  criticalTaskIds: string[];
}

export interface ScheduleProgramRollupDto {
  programId: string;
  projects: ScheduleProgramRollupProjectRowDto[];
  /** Min of per-project earliest starts (ISO). */
  programEarliestStart: string | null;
  /** Max of per-project latest finishes (ISO). */
  programLatestFinish: string | null;
}

export interface TaskScheduleResultDto {
  taskId: string;
  startDate: string | null;
  dueDate: string | null;
  earlyStartDay: string | null;
  earlyFinishDay: string | null;
  totalSlackDays: number | null;
  /** Total slack in whole working days on the task calendar. */
  totalSlackWorkingDays?: number | null;
  /** True when scheduled early finish is after deadlineDate. */
  deadlineViolated?: boolean;
}

export interface ScheduleEngineDiagnosticDto {
  taskId: string;
  code: string;
  message: string;
}

export interface ScheduleDrivingEdgeDto {
  fromTaskId: string;
  toTaskId: string;
}

export interface ProjectCriticalPathDto {
  projectId: string;
  criticalTaskIds: string[];
  tasks: TaskScheduleResultDto[];
  /** Constraint / deadline issues detected during the last solve (recalculate). */
  diagnostics?: ScheduleEngineDiagnosticDto[];
  /**
   * Predecessor links that set early start (tight on forward pass), for timeline/network UX.
   * Empty when the solver did not produce a match (e.g. ALAP-only drivers).
   */
  drivingEdges?: ScheduleDrivingEdgeDto[];
}

/** MS Project–style multi-baseline: valid `baselineIndex` values are `0`…`SCHEDULE_BASELINE_INDEX_MAX` inclusive. */
export const SCHEDULE_BASELINE_INDEX_MAX = 10;

/** Split task / work-contour segment (display; CPM uses single start/due unless extended later). */
export interface TaskScheduleSegmentDto {
  start: string;
  end: string;
  workMinutes?: number | null;
}

/** PERT / dependency network for schedule view (all project tasks with links). */
export interface ProjectScheduleNetworkNodeDto {
  id: string;
  title: string;
}

export interface ProjectScheduleNetworkEdgeDto {
  fromTaskId: string;
  toTaskId: string;
  linkType: string;
  lagDays: number;
  lagIsElapsed?: boolean;
  /** Present when client merges network with `drivingEdges` from critical-path (same ids). */
  driving?: boolean;
}

export interface ProjectScheduleNetworkDto {
  projectId: string;
  nodes: ProjectScheduleNetworkNodeDto[];
  edges: ProjectScheduleNetworkEdgeDto[];
}

/** One task’s work (and optional cost) in a time bucket for timephased grid. */
export interface ProjectScheduleTimephasedCellDto {
  taskId: string;
  taskTitle: string;
  periodStart: string;
  periodEnd: string;
  workMinutes: number;
  cost: number | null;
}

export type ScheduleTimephasedBasis = "calendar" | "working";

/** One resource’s work/cost in a period (Resource Usage grid); split from tasks by assignment units. */
export interface ProjectScheduleTimephasedResourceCellDto {
  resourceKey: string;
  resourceLabel: string;
  periodStart: string;
  periodEnd: string;
  workMinutes: number;
  cost: number | null;
}

export interface ProjectScheduleTimephasedDto {
  projectId: string;
  granularity: "week" | "day";
  /** Slot model for spreading work: UTC calendar days vs project working calendar minutes. */
  basis: ScheduleTimephasedBasis;
  cells: ProjectScheduleTimephasedCellDto[];
  /** Per-assignee / generic resource buckets (same periods as `cells`). */
  resourceCells: ProjectScheduleTimephasedResourceCellDto[];
}

export interface TaskBaselineRowDto {
  taskId: string;
  baselineIndex: number;
  baselineStart: string | null;
  baselineFinish: string | null;
  baselineWorkMinutes: number | null;
  baselineCost: number | null;
  /** When this baseline snapshot was last saved (upsert time). */
  savedAt: string | null;
}

/** Current schedule vs saved baseline (calendar-day and work/cost deltas). */
export interface TaskBaselineCompareRowDto {
  taskId: string;
  baselineIndex: number;
  baselineStart: string | null;
  baselineFinish: string | null;
  baselineWorkMinutes: number | null;
  baselineCost: number | null;
  currentStart: string | null;
  currentFinish: string | null;
  currentWorkMinutes: number | null;
  currentCost: number | null;
  /** Calendar days: current start minus baseline start (positive = later). */
  startVarianceDays: number | null;
  /** Calendar days: current finish minus baseline finish. */
  finishVarianceDays: number | null;
  /** Working days slip for start vs baseline (project calendar); null if no calendar or dates. */
  startVarianceWorkingDays: number | null;
  /** Working days slip for finish vs baseline (project calendar). */
  finishVarianceWorkingDays: number | null;
  /** Current work minus baseline work (minutes). */
  workVarianceMinutes: number | null;
  /** Current cost minus baseline cost (same currency as rates/fixed cost). */
  costVariance: number | null;
  /** Last time this baseline slot was saved for this task. */
  savedAt: string | null;
}

/** Rolled-up variance stats for a project baseline slot. */
export interface ProjectBaselineSummaryDto {
  projectId: string;
  baselineIndex: number;
  /** Non-deleted, non-template tasks in the project. */
  projectTaskCount: number;
  /** Tasks that have a row for this baseline index. */
  tasksWithBaselineCount: number;
  finishLateCount: number;
  finishEarlyCount: number;
  finishOnTimeCount: number;
  /** Among rows with a numeric finish variance; null if none. */
  avgFinishVarianceDays: number | null;
  /** Sum of finish variances where defined (can be negative overall). */
  sumFinishVarianceDays: number | null;
  /** Mean finish working-day variance when project calendar applies. */
  avgFinishVarianceWorkingDays: number | null;
  /** Sum of finish working-day variances where defined. */
  sumFinishVarianceWorkingDays: number | null;
  /** Sum of work variances where both sides defined. */
  sumWorkVarianceMinutes: number | null;
  /** Sum of cost variances where both sides defined. */
  sumCostVariance: number | null;
  /** Largest finish slip (positive variance); null if none late. */
  maxFinishSlipDays: number | null;
  /** Largest finish slip in working days (positive only). */
  maxFinishSlipWorkingDays: number | null;
  /** Most recent baseline upsert in this slot for the project. */
  latestBaselineSavedAt: string | null;
}

/** Body for POST …/schedule/level. */
export interface ProjectLevelRequest {
  /** Level tasks in this project only, or across the whole schedule program (shared resources). */
  scope?: 'project' | 'program';
  /**
   * When true (default), manually scheduled tasks are not shifted.
   * When false, leveling may move manual tasks (same working-day step rules).
   */
  preserveManuallyScheduled?: boolean;
  /**
   * When true, reset `levelingDelayWorkingDays` to 0 on all tasks in scope before leveling runs.
   * MSP-style “clear leveling values” for delay counters (does not restore original dates).
   */
  clearLevelingDelays?: boolean;
  /**
   * When true, tasks marked `levelingCanSplit` are sorted to be delayed **after** non-splittable
   * tasks (tie-break after priority and sort order). Whole-task delay only until split leveling ships.
   */
  deferSplitCapableTasksLast?: boolean;
}

/** Result of POST …/schedule/level. */
export interface ProjectLevelResultDto {
  shiftedTaskIds: string[];
  stoppedReason: 'resolved' | 'no_slack' | 'max_passes';
  remainingOverallocations: number;
  /** Echo of request scope when provided. */
  scope?: 'project' | 'program';
  /** Tasks whose leveling delay counter was cleared when `clearLevelingDelays` was true. */
  clearedLevelingDelaysTaskCount?: number;
}

/** Query for GET …/schedule/overallocations. */
export interface ScheduleOverallocationsQueryDto {
  /** `week` (default) or `day` buckets. */
  granularity?: 'week' | 'day';
  /** Inclusive YYYY-MM-DD filter in focal project calendar TZ (or workspace default / UTC). */
  from?: string;
  to?: string;
  /** When `program`, merge overloads across all projects in the focal project’s schedule program. */
  scope?: 'project' | 'program';
  limit?: number;
  offset?: number;
}

export interface OverallocationBucketDto {
  /** Human assignee vs workspace generic resource. */
  resourceKind: 'user' | 'generic_resource';
  /**
   * Bucket granularity; when omitted, treat as `week` for backward compatibility.
   */
  granularity?: 'week' | 'day';
  /**
   * Start of bucket: Monday YYYY-MM-DD for `week`, or calendar day for `day`
   * (focal project work-calendar time zone when scope is project).
   */
  periodStart: string;
  /** Monday week start when `granularity === 'week'`; same as `periodStart` in that case. */
  weekStart: string;
  /** Sum of available working minutes in the bucket (intersection of project + resource calendars for users). */
  capacityMinutes: number;
  /** Sum of allocated load minutes (units% × per-day capacity). */
  allocatedMinutes: number;
  allocatedPercent: number;
  /** Effective capacity as percent of bucket minutes (typically 100 when using minute-based overload). */
  capacityPercent: number;
  taskIds: string[];
  /** When scope=program, projects contributing to this bucket. */
  projectIds?: string[];
  /** Present when resourceKind === 'user'. */
  userId?: string;
  /** Present when resourceKind === 'generic_resource'. */
  genericResourceId?: string;
  genericResourceName?: string;
}

/** Per-task EVM roll-up (only tasks with positive BAC). */
export interface TaskEvmRowDto {
  taskId: string;
  title: string;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  spi: number | null;
  cpi: number | null;
  eac: number | null;
  /** True when task is a budget / cap line (same row also rolls into `budget` summary when present). */
  isBudgetTask?: boolean;
}

/** How earned value (EV) is derived from progress (Phase 3 / C-05). */
export type EvmEarnedValueBasis = 'PERCENT_COMPLETE' | 'WORK_VS_BASELINE';

/**
 * Planned value (PV) model. `BASELINE_DURATION_LINEAR` spreads BAC linearly on baseline **calendar** elapsed time.
 * `WORK_SCHEDULE_LINEAR` splits BAC into labor vs non-labor using current cost shape: non-labor (fixed + per-use)
 * still uses calendar time; **labor** uses **working minutes** elapsed along the project calendar between baseline dates.
 */
export type EvmPvModel = 'BASELINE_DURATION_LINEAR' | 'WORK_SCHEDULE_LINEAR';

/** Query options for GET …/schedule/evm (Phase 3). */
export interface ScheduleEvmQueryOptions {
  /** Baseline index 0–10 for BAC dates, baseline cost, and baseline work (EV/PV modes). Default 0. */
  baselineIndex?: number;
  earnedValueBasis?: EvmEarnedValueBasis;
  pvModel?: EvmPvModel;
}

/** Budget-task-only EVM bucket (tasks with `isBudgetTask`). */
export interface ProjectEvmBudgetRollupDto {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  spi: number | null;
  cpi: number | null;
  eac: number | null;
}

export interface ProjectEvmSummaryDto {
  projectId: string;
  /** Baseline index used for this response. */
  baselineIndex: number;
  earnedValueBasis: EvmEarnedValueBasis;
  pvModel: EvmPvModel;
  /** Operating schedule: excludes `isBudgetTask` rows. */
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  spi: number | null;
  cpi: number | null;
  eac: number | null;
  /** Populated when the project has at least one budget task with positive BAC. */
  budget?: ProjectEvmBudgetRollupDto;
  /** Omitted when requested with tasks=0 on the API. */
  tasks?: TaskEvmRowDto[];
}

/** Ledger line for task actual cost (Phase 3 / C-04). */
export interface TaskCostEntryDto {
  id: string;
  taskId: string;
  amount: number;
  description?: string | null;
  entryDate: string;
  createdAt: string;
  createdById?: string | null;
}

export interface CreateTaskCostEntryRequest {
  amount: number;
  description?: string;
  /** ISO datetime; defaults to now. */
  entryDate?: string;
}

export interface UpdateTaskCostEntryRequest {
  amount?: number;
  /** Pass `null` to clear description. */
  description?: string | null;
  entryDate?: string;
}

export interface CreateTaskAttachmentRequest {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Public or signed URL to the file (link-style attachment). */
  url: string;
  /** Optional storage key; defaults to a generated external key. */
  storageKey?: string;
}

// ─── COMMENT ──────────────────────────────────────────────────────────────────

export interface CommentMentionDto {
  userId: string;
  displayName: string;
}

export interface CommentDto {
  id: string;
  taskId: string;
  authorId: string;
  parentCommentId?: string | null;
  body: string;
  htmlBody?: string;
  isAgentComment: boolean;
  createdAt: Date;
  updatedAt: Date;
  author?: UserDto;
  mentions?: CommentMentionDto[];
}

export interface CreateCommentRequest {
  body: string;
  /** Reply to an existing comment on the same task. */
  parentCommentId?: string;
  /** Users to notify (@mention); must be in a workspace linked to the task. */
  mentionedUserIds?: string[];
}

export interface UpdateCommentRequest {
  body: string;
}

// ─── TAG ──────────────────────────────────────────────────────────────────────

export interface TagDto {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

// ─── CUSTOM FIELD ─────────────────────────────────────────────────────────────

export interface CustomFieldDefinitionDto {
  id: string;
  workspaceId: string;
  name: string;
  type: CustomFieldType;
  options?: Record<string, any>;
  isRequired: boolean;
  description?: string | null;
  defaultValue?: Record<string, any> | null;
  computedKind: CustomFieldComputedKind;
  rollupSourceFieldId?: string | null;
  rollupAggregation?: CustomFieldRollupAggregation | null;
  /** True when values are server-computed (read-only for clients). */
  isComputed?: boolean;
  createdAt: Date;
}

export interface CustomFieldValueDto {
  id: string;
  taskId: string;
  fieldId: string;
  value: Record<string, any>;
  field?: CustomFieldDefinitionDto;
}

export interface CreateCustomFieldRequest {
  name: string;
  type: CustomFieldType;
  options?: Record<string, any>;
  isRequired?: boolean;
  description?: string;
  defaultValue?: Record<string, any>;
  computedKind?: CustomFieldComputedKind;
  rollupSourceFieldId?: string;
  rollupAggregation?: CustomFieldRollupAggregation;
}

export interface UpdateCustomFieldRequest {
  name?: string;
  options?: Record<string, any>;
  isRequired?: boolean;
  description?: string | null;
  defaultValue?: Record<string, any> | null;
}

export interface SetCustomFieldValueRequest {
  value: Record<string, any>;
}

/** Link an existing workspace custom field definition to a project (ordered in UI). */
export interface AddProjectCustomFieldRequest {
  fieldId: string;
}

// ─── PORTFOLIO ────────────────────────────────────────────────────────────────

export interface PortfolioDto {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
  itemCount?: number;
  items?: PortfolioItemDto[];
}

export interface PortfolioItemDto {
  portfolioId: string;
  projectId: string;
  sortOrder: number;
  project?: ProjectDto;
  addedAt: Date;
}

export interface CreatePortfolioRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdatePortfolioRequest {
  name?: string;
  description?: string;
  color?: string;
}

export interface AddPortfolioItemRequest {
  projectId: string;
}

// ─── GOAL ────────────────────────────────────────────────────────────────────

export interface GoalDto {
  id: string;
  workspaceId: string;
  ownerId?: string;
  name: string;
  description?: string;
  status: GoalStatus;
  startDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  metrics?: GoalMetricDto[];
  owner?: UserDto;
}

/** Declarative metric: server computes `current` from tasks / custom fields. */
export type GoalMetricDefinition =
  | {
      kind: 'TASK_COUNT';
      /** Limit to one project (must be linked to the goal's workspace). */
      projectId?: string;
      statuses?: string[];
      /**
       * Optional time window. When set, compares `completedAt` if all statuses are DONE,
       * otherwise `createdAt` (e.g. backlog created this quarter).
       */
      period?: {
        preset?: 'CURRENT_QUARTER' | 'CURRENT_MONTH' | 'CURRENT_YEAR' | 'RANGE';
        from?: string;
        to?: string;
      };
    }
  | {
      kind: 'CUSTOM_FIELD_SUM';
      fieldId: string;
      projectId?: string;
      aggregate: 'sum';
    }
  | {
      kind: 'EPIC_CHILDREN_PERCENT';
      /** Epic task id (work item in a project). */
      epicTaskId: string;
    };

export interface GoalMetricDto {
  id: string;
  goalId: string;
  name: string;
  type: GoalMetricType;
  current: number;
  target: number;
  unit?: string;
  updatedAt: Date;
  definition?: GoalMetricDefinition | null;
  lastComputedAt?: Date | null;
  lastError?: string | null;
}

export interface CreateGoalRequest {
  name: string;
  description?: string;
  ownerId?: string;
  startDate?: Date;
  dueDate?: Date;
}

export interface UpdateGoalRequest {
  name?: string;
  description?: string;
  status?: GoalStatus;
  ownerId?: string;
  startDate?: Date;
  dueDate?: Date;
}

export interface CreateGoalMetricRequest {
  name: string;
  type: GoalMetricType;
  target: number;
  unit?: string;
  /** When set, the server computes `current` from tasks / fields (see GoalMetricDefinition). */
  definition?: GoalMetricDefinition;
}

export interface UpdateGoalMetricRequest {
  current?: number;
  target?: number;
  name?: string;
  unit?: string;
  type?: GoalMetricType;
  definition?: GoalMetricDefinition | null;
}

// ─── REPORTING ───────────────────────────────────────────────────────────────

/** Filters for workspace-level reporting (summary, export, dashboard NUMBER_METRIC). */
export interface WorkspaceReportingFilters {
  /** Inclusive period start (YYYY-MM-DD). Default: today − 30d. */
  from?: string;
  /** Inclusive period end (YYYY-MM-DD). Default: today. */
  to?: string;
  /** Limit to tasks in these projects (must belong to the workspace). */
  projectIds?: string[];
  /** Limit to tasks in projects contained in this portfolio (workspace must match). */
  portfolioId?: string;
  /** Tasks with at least one assignee in this set. */
  assigneeIds?: string[];
  /** Subset of task statuses. */
  statuses?: string[];
  /** Tasks having all listed tag ids. */
  tagIds?: string[];
}

/** One calendar week (Mon–Sun, local) with completed-task count in the reporting window. */
export interface ReportingThroughputWeekDto {
  weekStart: string;
  weekEnd: string;
  completedCount: number;
}

/** Lead/cycle time for DONE tasks completed in the reporting period (same filter scope). */
export interface ReportingFlowMetricsDto {
  /** create → done (days), all DONE completions in period. */
  leadTimeDays: {
    avg: number | null;
    median: number | null;
    sampleSize: number;
  };
  /**
   * startDate → done (days) when `Task.startDate` is set; otherwise omitted from sample.
   * Use for schedule-based cycle time; compare with lead time when many tasks lack dates.
   */
  cycleTimeDays: {
    avg: number | null;
    median: number | null;
    sampleSize: number;
  };
}

export interface WorkspaceReportingSummaryDto {
  workspaceId: string;
  /** Effective reporting window (date-only ISO). */
  period: { from: string; to: string };
  /** Echo of filters used to compute the summary (defaults applied). */
  appliedFilters: WorkspaceReportingFilters;
  tasksByStatus: Record<string, number>;
  openTaskCount: number;
  /** Completed in period (`completedAt` within [from, to] end-of-day). */
  completedLast30Days: number;
  /** Created in period (`createdAt` within [from, to] end-of-day). */
  createdLast30Days: number;
  /** Weekly throughput of completions (calendar weeks overlapping the period). */
  throughputByWeek: ReportingThroughputWeekDto[];
  /** Lead time and cycle-time stats for items completed in the period. */
  flowMetrics: ReportingFlowMetricsDto;
  workload: Array<{
    userId: string;
    displayName: string;
    openTaskCount: number;
  }>;
}

export interface ReportingSavedViewDto {
  id: string;
  workspaceId: string;
  createdById: string;
  name: string;
  sortOrder: number;
  config: WorkspaceReportingFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportingSavedViewRequest {
  name: string;
  config: WorkspaceReportingFilters;
  sortOrder?: number;
}

export interface UpdateReportingSavedViewRequest {
  name?: string;
  config?: WorkspaceReportingFilters;
  sortOrder?: number;
}

/** One cell in the project workload matrix (open tasks × story points). */
export interface ProjectWorkloadCellDto {
  taskCount: number;
  storyPoints: number;
  /** Sum of assignee `unitsPercent` for tasks in this bucket (MSP-style load). */
  allocationPercent: number;
}

/** GET …/projects/:projectId/workload — one row per assignee (plus Unassigned). */
export interface ProjectWorkloadRowDto {
  userId: string;
  displayName: string;
  weeks: ProjectWorkloadCellDto[];
  unscheduled: ProjectWorkloadCellDto;
  outOfRange: ProjectWorkloadCellDto;
}

export interface ProjectWorkloadDto {
  projectId: string;
  /** First Monday in the grid (YYYY-MM-DD). */
  from: string;
  /** Last Sunday in the grid (YYYY-MM-DD). */
  to: string;
  weekStarts: string[];
  rows: ProjectWorkloadRowDto[];
}

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────

export interface NotificationDto {
  id: string;
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  resourceId?: string;
  resourceType?: string;
  isRead: boolean;
  createdAt: Date;
  sender?: UserDto;
}

// ─── AUTOMATION ───────────────────────────────────────────────────────────────

export interface AutomationDto {
  id: string;
  workspaceId: string;
  projectId?: string;
  name: string;
  isActive: boolean;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, any>;
  actions: AutomationActionDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationActionDto {
  id: string;
  automationId: string;
  actionType: AutomationActionType;
  actionConfig: Record<string, any>;
  sortOrder: number;
}

export interface CreateAutomationRequest {
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, any>;
  actions: Array<{
    actionType: AutomationActionType;
    actionConfig: Record<string, any>;
  }>;
}

export interface UpdateAutomationRequest {
  name?: string;
  isActive?: boolean;
  triggerType?: AutomationTriggerType;
  triggerConfig?: Record<string, any>;
  actions?: Array<{
    actionType: AutomationActionType;
    actionConfig: Record<string, any>;
  }>;
}

// ─── AGENT TOKEN ──────────────────────────────────────────────────────────────

export interface AgentTokenDto {
  id: string;
  workspaceId: string;
  userId?: string;
  name: string;
  token: string;
  scope: AgentTokenScope[];
  actorTier: ActorTier;
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export interface CreateAgentTokenRequest {
  name: string;
  scope: AgentTokenScope[];
  actorTier: ActorTier;
  expiresAt?: Date;
}

// ─── DASHBOARD (reporting + future agent surfaces) ─────────────────────────────

export type DashboardWidgetType =
  | 'TASKS_BY_STATUS'
  | 'PROJECT_SUMMARY'
  | 'PROJECT_CFD'
  | 'PROJECT_EVM'
  | 'PORTFOLIO_ACTIVE_SPRINTS'
  | 'PORTFOLIO_SPRINT_VELOCITY'
  | 'NUMBER_METRIC'
  | 'AGENT_SLOT'
  | 'TEXT_NOTE';

/** Resolved payload for PORTFOLIO_ACTIVE_SPRINTS dashboard widget. */
export interface PortfolioActiveSprintRowDto {
  projectId: string;
  projectName: string;
  sprintId: string | null;
  sprintName: string | null;
  sprintState: string | null;
  startDate: string | null;
  endDate: string | null;
  totalTasks: number;
  doneTasks: number;
  totalStoryPoints: number;
  doneStoryPoints: number;
}

export interface PortfolioActiveSprintsResolvedDto {
  portfolioId: string;
  portfolioName: string;
  rows: PortfolioActiveSprintRowDto[];
}

/** Per-project slice for PORTFOLIO_SPRINT_VELOCITY (last closed sprint + rolling average). */
export interface PortfolioVelocityProjectSliceDto {
  projectId: string;
  projectName: string;
  averageCompletedPoints: number;
  lastSprintName: string | null;
  lastSprintCompletedPoints: number;
}

export interface PortfolioSprintVelocityResolvedDto {
  portfolioId: string;
  portfolioName: string;
  take: number;
  projects: PortfolioVelocityProjectSliceDto[];
}

export interface DashboardWidgetDto {
  id: string;
  dashboardId: string;
  type: DashboardWidgetType;
  title: string;
  sortOrder: number;
  gridX: number;
  gridY: number;
  gridW: number;
  gridH: number;
  config: Record<string, unknown>;
  /** Server-computed data for charts and metrics (GET dashboard detail). */
  resolved?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardDto {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  layoutMeta?: Record<string, unknown>;
  widgets?: DashboardWidgetDto[];
  widgetCount?: number;
}

export interface DashboardLayoutPresetSummaryDto {
  id: string;
  name: string;
  description: string;
}

export interface DashboardTemplateSummaryDto {
  id: string;
  name: string;
  description: string;
}

/** Resolved NUMBER_METRIC when backed by reporting (GET dashboard with resolved). */
export interface DashboardNumberMetricSparklinePointDto {
  label: string;
  value: number;
}

export interface DuplicateDashboardRequest {
  /** Defaults to "{name} (copy)" */
  name?: string;
}

export interface CreateDashboardFromTemplateRequest {
  templateId: string;
  /** Defaults to the template display name */
  name?: string;
}

export interface ApplyDashboardLayoutPresetRequest {
  presetId: string;
}

export interface CreateDashboardRequest {
  name: string;
  description?: string;
  color?: string;
  layoutMeta?: Record<string, unknown>;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  color?: string;
  layoutMeta?: Record<string, unknown>;
}

export interface CreateDashboardWidgetRequest {
  type: DashboardWidgetType;
  title: string;
  sortOrder?: number;
  gridX?: number;
  gridY?: number;
  gridW?: number;
  gridH?: number;
  config?: Record<string, unknown>;
}

export interface UpdateDashboardWidgetRequest {
  title?: string;
  sortOrder?: number;
  gridX?: number;
  gridY?: number;
  gridW?: number;
  gridH?: number;
  config?: Record<string, unknown>;
}

// ─── MODELT PM (Section 5.2 / 5.3) ─────────────────────────────────────────────

/** PM task lifecycle — matches DB check on tasks.status */
export type PmTaskStatus =
  | 'PENDING'
  | 'READY'
  | 'CONTEXT_ASSEMBLY'
  | 'DISPATCHED'
  | 'DISPATCH_PENDING'
  | 'IN_PROGRESS'
  | 'BLOCKED_AWAITING_HUMAN'
  | 'FAILED'
  | 'OUTPUT_RECEIVED'
  | 'VALIDATING'
  | 'REVISION_REQUIRED'
  | 'REVIEW_PENDING'
  | 'APPROVED'
  | 'DONE'
  | 'ESCALATION_PENDING'
  | 'BLOCKED_METADATA_ERROR'
  | 'BLOCKED_DEPENDENCY_CANCELLED'
  | 'BLOCKED_HUMAN_REROUTE'
  | 'REROUTED_READY'
  | 'DEFERRED'
  | 'CANCELLED';

export interface PmProjectDto {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  idea_brief_path?: string | null;
  plan_path?: string | null;
  design_doc_path?: string | null;
  repo_url?: string | null;
  metadata: Record<string, unknown>;
}

export interface PmTaskDto {
  id: string;
  project_id: string;
  phase: number;
  implementation_phase?: string | null;
  title: string;
  description: string;
  actor_tier: string;
  domain: string;
  complexity: string;
  estimated_minutes: number;
  timeout_minutes: number;
  parallel_group?: string | null;
  status: PmTaskStatus | string;
  priority: number;
  review_gate: string;
  acceptance_criteria: unknown[];
  context_refs: unknown[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PmTaskArtifactDto {
  id: string;
  task_id: string;
  artifact_type: string;
  name: string;
  path?: string | null;
  url?: string | null;
  content?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PmTaskRunDto {
  id: string;
  task_id: string;
  run_number: number;
  actor_tier: string;
  actor_detail?: string | null;
  started_at: string;
  completed_at?: string | null;
  outcome?: string | null;
  failure_reason?: string | null;
  output_summary?: string | null;
  artifact_ids: unknown[];
}

export interface PmTaskDetailDto extends PmTaskDto {
  artifacts: PmTaskArtifactDto[];
  latest_run: PmTaskRunDto | null;
}

export interface PmTaskDependencyRowDto {
  task_id: string;
  depends_on_id: string;
  dependency_status: string;
  dependency_title: string;
}

export interface PmHumanGateDto {
  id: string;
  project_id: string;
  gate_type: string;
  originating_task_id?: string | null;
  blocking_task_id?: string | null;
  context_summary: string;
  failure_history: unknown[];
  decision_options: unknown[];
  recommended_option?: string | null;
  decision?: string | null;
  decision_notes?: string | null;
  status: string;
  created_at: string;
  resolved_at?: string | null;
  age_alert_sent: boolean;
}

export interface PmAuditLogDto {
  id: string;
  project_id?: string | null;
  task_id?: string | null;
  gate_id?: string | null;
  event_type: string;
  actor?: string | null;
  from_value?: string | null;
  to_value?: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface PmPatchTaskStatusRequest {
  status: string;
  actor?: string;
  detail?: string;
}

export interface PmCreateTaskArtifactRequest {
  artifact_type: string;
  name: string;
  path?: string;
  url?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface PmTasksBatchTaskInput {
  id: string;
  phase: number;
  implementation_phase?: string;
  title: string;
  description: string;
  actor_tier: string;
  domain: string;
  complexity: string;
  estimated_minutes?: number;
  timeout_minutes?: number;
  parallel_group?: string | null;
  status?: string;
  priority?: number;
  review_gate?: string;
  acceptance_criteria?: unknown[];
  context_refs?: unknown[];
  notes?: string;
}

export interface PmTasksBatchDependencyInput {
  task_id: string;
  depends_on_id: string;
}

export interface PmTasksBatchRequest {
  project_id: string;
  tasks: PmTasksBatchTaskInput[];
  dependencies: PmTasksBatchDependencyInput[];
}

export interface PmCreateHumanGateRequest {
  project_id: string;
  gate_type: string;
  originating_task_id?: string;
  blocking_task_id?: string;
  context_summary: string;
  failure_history?: unknown[];
  decision_options: unknown[];
  recommended_option?: string;
  status?: string;
}

export interface PmResolveHumanGateRequest {
  decision: string;
  decision_notes?: string;
}

export interface PmPatchProjectStatusRequest {
  status: string;
}

export interface PmAppendAuditRequest {
  project_id?: string;
  task_id?: string;
  gate_id?: string;
  event_type: string;
  actor?: string;
  from_value?: string;
  to_value?: string;
  detail?: Record<string, unknown>;
}

// ─── PAGINATION & API ─────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, any>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// ─── SOCKET EVENTS ────────────────────────────────────────────────────────────

export type SocketEventType =
  | "task:created"
  | "task:updated"
  | "task:deleted"
  | "task:moved"
  | "section:created"
  | "section:updated"
  | "section:deleted"
  | "comment:created"
  | "comment:updated"
  | "comment:deleted"
  | "project:updated"
  | "notification:created"
  | "notification:new"
  | "agent:started"
  | "agent:completed"
  | "task:completed"
  | "agent:failed"
  | "presence:online"
  | "presence:offline";

export interface SocketEvent<T = any> {
  type: SocketEventType;
  data: T;
  timestamp: Date;
  workspaceId: string;
}

export interface TaskEventData {
  task: TaskDto;
  action: "created" | "updated" | "deleted" | "moved";
}

export interface CommentEventData {
  comment: CommentDto;
  action: "created" | "updated" | "deleted";
}

export interface NotificationEventData {
  notification: NotificationDto;
}

export interface AgentEventData {
  taskId: string;
  action: "started" | "completed" | "failed";
  output?: Record<string, any>;
  error?: string;
}

export interface PresenceData {
  userId: string;
  workspaceId: string;
  status: "online" | "offline";
}
