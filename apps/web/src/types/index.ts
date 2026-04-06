export type TaskStatus = 'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' | 'ESCALATION_PENDING' | 'BLOCKED_AWAITING_HUMAN' | 'BLOCKED_HUMAN_REROUTE' | 'REROUTED_READY';
export type TaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
export type ProjectRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER';
export type ActorTier = 'HUMAN' | 'CLAUDE_SONNET' | 'CLAUDE_OPUS' | 'CURSOR_COMPOSER' | 'CREW_UIUX' | 'CREW_BACKEND' | 'CREW_QA' | 'CREW_DEVOPS' | 'CREW_INFRA' | 'CREW_DATA' | 'CREW_PLANNING' | 'CREW_LIBRARY' | 'UNASSIGNED';
export type TaskDomain = 'UIUX' | 'BACKEND' | 'INFRA' | 'DATA' | 'TESTING' | 'DEVOPS' | 'PLANNING' | 'REVIEW' | 'LIBRARY' | 'GENERAL';
export type TaskComplexity = 'TRIVIAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReviewGate = 'NONE' | 'AUTOMATED_ONLY' | 'CRITIC_REVIEW' | 'HUMAN_SIGNOFF' | 'FULL';
export type NotificationType = 'TASK_ASSIGNED' | 'TASK_COMMENTED' | 'TASK_COMPLETED' | 'TASK_DUE_SOON' | 'TASK_OVERDUE' | 'PROJECT_INVITE' | 'MENTION' | 'RULE_TRIGGERED' | 'AGENT_ACTION' | 'ESCALATION';
export type ProjectColor = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'TEAL' | 'BLUE' | 'INDIGO' | 'PURPLE' | 'PINK' | 'GRAY';

export type TaskWorkItemType = 'TASK' | 'STORY' | 'BUG' | 'EPIC' | 'CHORE' | 'SPIKE';
export type SprintState = 'PLANNED' | 'ACTIVE' | 'CLOSED';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  state: SprintState;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isAgent: boolean;
  agentTier?: ActorTier;
  timezone: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  slackIncomingWebhookConfigured?: boolean;
  memberCount?: number;
  members?: WorkspaceMember[];
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  role: WorkspaceRole;
  user: User;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  color?: string;
  emoji?: string;
  isPrivate: boolean;
  memberCount?: number;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  userId: string;
  role: string;
  user: User;
  joinedAt: string;
}

export type KanbanWipEnforcement = 'OFF' | 'WARN' | 'STRICT';

export interface Project {
  id: string;
  workspaceIds: string[];
  createdById?: string;
  teamId?: string;
  name: string;
  description?: string;
  color: ProjectColor;
  emoji?: string;
  status: ProjectStatus;
  isPrivate: boolean;
  isArchived: boolean;
  isTemplate?: boolean;
  startDate?: string;
  dueDate?: string;
  defaultView: string;
  kanbanWipEnforcement?: KanbanWipEnforcement;
  sections?: Section[];
  sprints?: Sprint[];
  members?: ProjectMember[];
  /** Open root tasks (API); prefer over legacy `_count.tasks`. */
  taskCount?: number;
  /** Done + cancelled root tasks (API). */
  completedTaskCount?: number;
  _count?: { tasks: number };
}

export interface ProjectMember {
  id: string;
  userId: string;
  role: ProjectRole;
  user: User;
  joinedAt: string;
}

export interface Section {
  id: string;
  projectId: string;
  name: string;
  color?: string;
  sortOrder: number;
  wipLimit?: number | null;
  tasks?: Task[];
}

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  projectId?: string;
  startDate?: string;
  dueDate?: string;
}

export interface TaskDependency {
  id: string;
  dependentId: string;
  blockingId: string;
  type: string;
  createdAt: string;
  blockingTask?: TaskSummary;
  dependentTask?: TaskSummary;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  uploadedById?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  options?: Record<string, unknown>;
  isRequired: boolean;
  createdAt: string;
}

export interface CustomFieldValue {
  id: string;
  taskId: string;
  fieldId: string;
  value: Record<string, unknown>;
  field?: CustomFieldDefinition;
}

export interface TaskActivityLog {
  id: string;
  projectId?: string;
  taskId?: string;
  actorId: string;
  eventType: string;
  description: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  createdAt: string;
  actor?: Pick<User, 'id' | 'email' | 'displayName'>;
  task?: Pick<TaskSummary, 'id' | 'title'>;
}

export interface Task {
  id: string;
  projectId?: string;
  sectionId?: string;
  parentTaskId?: string;
  /** Cross-parent link to an EPIC task in the same project. */
  epicTaskId?: string | null;
  createdById: string;
  title: string;
  description?: string;
  workItemType?: TaskWorkItemType;
  storyPoints?: number | null;
  sprintId?: string | null;
  sprint?: { id: string; name: string } | null;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  estimatedMin?: number;
  actualMin?: number;
  sortOrder: number;
  /** Lower = higher in backlog ordering (tasks without a sprint). */
  backlogRank?: number | null;
  actorTier: ActorTier;
  domain: TaskDomain;
  complexity: TaskComplexity;
  reviewGate: ReviewGate;
  phase?: number;
  parallelGroup?: string;
  agentContext?: Record<string, any>;
  agentOutput?: Record<string, any>;
  agentStartedAt?: string;
  agentCompletedAt?: string;
  retryCount: number;
  escalationNote?: string;
  isArchived: boolean;
  recurrenceRule?: string;
  recurrenceUntil?: string;
  isTemplate?: boolean;
  isMilestone?: boolean;
  assignees?: TaskAssignee[];
  subtasks?: Task[];
  tags?: Tag[];
  customFields?: CustomFieldValue[];
  waitingOn?: TaskDependency[];
  blockingTasks?: TaskDependency[];
  attachments?: TaskAttachment[];
  activityLogs?: TaskActivityLog[];
  commentCount?: number;
  subtaskCount?: number;
  createdAt: string;
  updatedAt: string;
  project?: { name: string; color: ProjectColor };
  section?: { name: string };
  createdBy?: User;
}

export interface TaskAssignee {
  id: string;
  userId: string;
  user: User;
  assignedAt: string;
}

export interface CommentMention {
  userId: string;
  displayName: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  parentCommentId?: string | null;
  body: string;
  htmlBody?: string;
  isAgentComment: boolean;
  createdAt: string;
  updatedAt: string;
  author?: User;
  mentions?: CommentMention[];
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  resourceId?: string;
  resourceType?: string;
  isRead: boolean;
  createdAt: string;
  sender?: User;
}

export interface Portfolio {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  items?: PortfolioItem[];
}

export interface PortfolioItem {
  portfolioId: string;
  projectId: string;
  sortOrder: number;
  addedAt: string;
  project?: Project;
}

export interface Goal {
  id: string;
  name: string;
  description?: string;
  status: string;
  dueDate?: string;
  metrics?: GoalMetric[];
}

export interface GoalMetric {
  id: string;
  name: string;
  type: string;
  current: number;
  target: number;
  unit?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type DashboardWidgetType =
  | 'TASKS_BY_STATUS'
  | 'PROJECT_SUMMARY'
  | 'PROJECT_CFD'
  | 'PORTFOLIO_ACTIVE_SPRINTS'
  | 'PORTFOLIO_SPRINT_VELOCITY'
  | 'NUMBER_METRIC'
  | 'AGENT_SLOT'
  | 'TEXT_NOTE';

export interface DashboardWidget {
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
  resolved?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Dashboard {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  color?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  layoutMeta?: Record<string, unknown>;
  widgets?: DashboardWidget[];
  widgetCount?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
