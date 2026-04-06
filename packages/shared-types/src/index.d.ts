export declare enum TaskStatus {
    BACKLOG = "BACKLOG",
    READY = "READY",
    IN_PROGRESS = "IN_PROGRESS",
    BLOCKED = "BLOCKED",
    IN_REVIEW = "IN_REVIEW",
    DONE = "DONE",
    CANCELLED = "CANCELLED",
    ESCALATION_PENDING = "ESCALATION_PENDING",
    BLOCKED_AWAITING_HUMAN = "BLOCKED_AWAITING_HUMAN",
    BLOCKED_HUMAN_REROUTE = "BLOCKED_HUMAN_REROUTE",
    REROUTED_READY = "REROUTED_READY"
}
export declare enum TaskPriority {
    NONE = "NONE",
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    URGENT = "URGENT"
}
export declare enum ProjectStatus {
    ACTIVE = "ACTIVE",
    PAUSED = "PAUSED",
    COMPLETED = "COMPLETED",
    ARCHIVED = "ARCHIVED"
}
export declare enum ProjectColor {
    RED = "RED",
    ORANGE = "ORANGE",
    YELLOW = "YELLOW",
    GREEN = "GREEN",
    TEAL = "TEAL",
    BLUE = "BLUE",
    INDIGO = "INDIGO",
    PURPLE = "PURPLE",
    PINK = "PINK",
    GRAY = "GRAY"
}
export declare enum WorkspaceRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    MEMBER = "MEMBER",
    GUEST = "GUEST"
}
export declare enum ProjectRole {
    OWNER = "OWNER",
    EDITOR = "EDITOR",
    COMMENTER = "COMMENTER",
    VIEWER = "VIEWER"
}
export declare enum TeamRole {
    LEAD = "LEAD",
    MEMBER = "MEMBER"
}
export declare enum ActorTier {
    HUMAN = "HUMAN",
    CLAUDE_SONNET = "CLAUDE_SONNET",
    CLAUDE_OPUS = "CLAUDE_OPUS",
    CURSOR_COMPOSER = "CURSOR_COMPOSER",
    CREW_UIUX = "CREW_UIUX",
    CREW_BACKEND = "CREW_BACKEND",
    CREW_QA = "CREW_QA",
    CREW_DEVOPS = "CREW_DEVOPS",
    CREW_INFRA = "CREW_INFRA",
    CREW_DATA = "CREW_DATA",
    CREW_PLANNING = "CREW_PLANNING",
    CREW_LIBRARY = "CREW_LIBRARY",
    UNASSIGNED = "UNASSIGNED"
}
export declare enum TaskDomain {
    UIUX = "UIUX",
    BACKEND = "BACKEND",
    INFRA = "INFRA",
    DATA = "DATA",
    TESTING = "TESTING",
    DEVOPS = "DEVOPS",
    PLANNING = "PLANNING",
    REVIEW = "REVIEW",
    LIBRARY = "LIBRARY",
    GENERAL = "GENERAL"
}
export declare enum TaskComplexity {
    TRIVIAL = "TRIVIAL",
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export declare enum ReviewGate {
    NONE = "NONE",
    AUTOMATED_ONLY = "AUTOMATED_ONLY",
    CRITIC_REVIEW = "CRITIC_REVIEW",
    HUMAN_SIGNOFF = "HUMAN_SIGNOFF",
    FULL = "FULL"
}
export declare enum DependencyType {
    BLOCKING = "BLOCKING",
    WAITING_ON = "WAITING_ON"
}
export declare enum CustomFieldType {
    TEXT = "TEXT",
    NUMBER = "NUMBER",
    DATE = "DATE",
    DROPDOWN = "DROPDOWN",
    CHECKBOX = "CHECKBOX",
    MULTI_SELECT = "MULTI_SELECT",
    PERSON = "PERSON",
    URL = "URL"
}
export declare enum GoalMetricType {
    PERCENT = "PERCENT",
    NUMBER = "NUMBER",
    CURRENCY = "CURRENCY",
    BOOLEAN = "BOOLEAN"
}
export declare enum GoalStatus {
    ON_TRACK = "ON_TRACK",
    AT_RISK = "AT_RISK",
    OFF_TRACK = "OFF_TRACK",
    ACHIEVED = "ACHIEVED",
    MISSED = "MISSED",
    NO_STATUS = "NO_STATUS"
}
export declare enum NotificationType {
    TASK_ASSIGNED = "TASK_ASSIGNED",
    TASK_COMMENTED = "TASK_COMMENTED",
    TASK_COMPLETED = "TASK_COMPLETED",
    TASK_DUE_SOON = "TASK_DUE_SOON",
    TASK_OVERDUE = "TASK_OVERDUE",
    PROJECT_INVITE = "PROJECT_INVITE",
    MENTION = "MENTION",
    RULE_TRIGGERED = "RULE_TRIGGERED",
    AGENT_ACTION = "AGENT_ACTION",
    ESCALATION = "ESCALATION"
}
export declare enum AutomationTriggerType {
    TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED",
    TASK_CREATED = "TASK_CREATED",
    TASK_DUE_DATE_APPROACHING = "TASK_DUE_DATE_APPROACHING",
    TASK_OVERDUE = "TASK_OVERDUE",
    TASK_COMPLETED = "TASK_COMPLETED",
    ASSIGNEE_CHANGED = "ASSIGNEE_CHANGED",
    CUSTOM_FIELD_CHANGED = "CUSTOM_FIELD_CHANGED",
    SECTION_CHANGED = "SECTION_CHANGED",
    AGENT_COMPLETED = "AGENT_COMPLETED"
}
export declare enum AutomationActionType {
    CHANGE_STATUS = "CHANGE_STATUS",
    ASSIGN_TO = "ASSIGN_TO",
    MOVE_TO_SECTION = "MOVE_TO_SECTION",
    ADD_TAG = "ADD_TAG",
    REMOVE_TAG = "REMOVE_TAG",
    NOTIFY_USER = "NOTIFY_USER",
    SET_PRIORITY = "SET_PRIORITY",
    SET_DUE_DATE = "SET_DUE_DATE",
    TRIGGER_AGENT = "TRIGGER_AGENT",
    CREATE_SUBTASK = "CREATE_SUBTASK"
}
export declare enum AuditEventType {
    TASK_CREATED = "TASK_CREATED",
    TASK_UPDATED = "TASK_UPDATED",
    TASK_DELETED = "TASK_DELETED",
    TASK_ASSIGNED = "TASK_ASSIGNED",
    STATUS_CHANGED = "STATUS_CHANGED",
    ESCALATION = "ESCALATION",
    AGENT_STARTED = "AGENT_STARTED",
    AGENT_COMPLETED = "AGENT_COMPLETED",
    AGENT_FAILED = "AGENT_FAILED",
    REROUTED = "REROUTED",
    HUMAN_SIGNOFF = "HUMAN_SIGNOFF",
    COMMENT_ADDED = "COMMENT_ADDED",
    ATTACHMENT_ADDED = "ATTACHMENT_ADDED",
    RULE_TRIGGERED = "RULE_TRIGGERED"
}
export declare enum AgentTokenScope {
    READ_TASKS = "READ_TASKS",
    WRITE_TASKS = "WRITE_TASKS",
    READ_PROJECTS = "READ_PROJECTS",
    WRITE_PROJECTS = "WRITE_PROJECTS",
    FULL_ACCESS = "FULL_ACCESS"
}
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
export interface WorkspaceDto {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    description?: string;
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
}
export interface InviteMemberRequest {
    email: string;
    role: WorkspaceRole;
}
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
export interface ProjectDto {
    id: string;
    workspaceId: string;
    teamId?: string;
    createdById: string;
    name: string;
    description?: string;
    color: ProjectColor;
    emoji?: string;
    status: ProjectStatus;
    isPrivate: boolean;
    isArchived: boolean;
    startDate?: Date;
    dueDate?: Date;
    defaultView: string;
    createdAt: Date;
    updatedAt: Date;
    sectionCount?: number;
    taskCount?: number;
    memberCount?: number;
    members?: ProjectMemberDto[];
    sections?: SectionDto[];
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
}
export interface UpdateProjectRequest {
    name?: string;
    description?: string;
    color?: ProjectColor;
    emoji?: string;
    status?: ProjectStatus;
    isPrivate?: boolean;
    isArchived?: boolean;
    startDate?: Date;
    dueDate?: Date;
    defaultView?: string;
}
export interface SectionDto {
    id: string;
    projectId: string;
    name: string;
    color?: string;
    sortOrder: number;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    taskCount?: number;
}
export interface CreateSectionRequest {
    name: string;
    color?: string;
}
export interface UpdateSectionRequest {
    name?: string;
    color?: string;
}
export interface ReorderSectionRequest {
    sortOrder: number;
}
export interface TaskDto {
    id: string;
    projectId?: string;
    sectionId?: string;
    parentTaskId?: string;
    createdById: string;
    title: string;
    description?: string;
    htmlContent?: string;
    status: TaskStatus;
    priority: TaskPriority;
    startDate?: Date;
    dueDate?: Date;
    completedAt?: Date;
    estimatedMin?: number;
    actualMin?: number;
    sortOrder: number;
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
    createdAt: Date;
    updatedAt: Date;
    assignees?: TaskAssigneeDto[];
    subtasks?: TaskDto[];
    tags?: TagDto[];
    customFields?: CustomFieldValueDto[];
    commentCount?: number;
    subtaskCount?: number;
    createdBy?: UserDto;
}
export interface TaskAssigneeDto {
    id: string;
    taskId: string;
    userId: string;
    user: UserDto;
    assignedAt: Date;
}
export interface CreateTaskRequest {
    title: string;
    description?: string;
    sectionId?: string;
    priority?: TaskPriority;
    startDate?: Date;
    dueDate?: Date;
    assigneeIds?: string[];
    tagIds?: string[];
    parentTaskId?: string;
    actorTier?: ActorTier;
    domain?: TaskDomain;
    complexity?: TaskComplexity;
    reviewGate?: ReviewGate;
}
export interface UpdateTaskRequest {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    sectionId?: string;
    startDate?: Date | null;
    dueDate?: Date | null;
    estimatedMin?: number;
    actualMin?: number;
    actorTier?: ActorTier;
    domain?: TaskDomain;
    complexity?: TaskComplexity;
    reviewGate?: ReviewGate;
    agentContext?: Record<string, any>;
    escalationNote?: string;
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
    }>;
}
export interface CommentDto {
    id: string;
    taskId: string;
    authorId: string;
    body: string;
    htmlBody?: string;
    isAgentComment: boolean;
    createdAt: Date;
    updatedAt: Date;
    author?: UserDto;
}
export interface CreateCommentRequest {
    body: string;
}
export interface UpdateCommentRequest {
    body: string;
}
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
export interface CustomFieldDefinitionDto {
    id: string;
    workspaceId: string;
    name: string;
    type: CustomFieldType;
    options?: Record<string, any>;
    isRequired: boolean;
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
}
export interface SetCustomFieldValueRequest {
    value: Record<string, any>;
}
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
export interface GoalMetricDto {
    id: string;
    goalId: string;
    name: string;
    type: GoalMetricType;
    current: number;
    target: number;
    unit?: string;
    updatedAt: Date;
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
}
export interface UpdateGoalMetricRequest {
    current?: number;
    target?: number;
}
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
export type SocketEventType = "task:created" | "task:updated" | "task:deleted" | "task:moved" | "section:created" | "section:updated" | "section:deleted" | "comment:created" | "comment:updated" | "comment:deleted" | "project:updated" | "notification:created" | "notification:new" | "agent:started" | "agent:completed" | "task:completed" | "agent:failed" | "presence:online" | "presence:offline";
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
//# sourceMappingURL=index.d.ts.map