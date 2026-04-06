"use strict";
// ─── ENUMS ────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTokenScope = exports.AuditEventType = exports.AutomationActionType = exports.AutomationTriggerType = exports.NotificationType = exports.GoalStatus = exports.GoalMetricType = exports.CustomFieldType = exports.DependencyType = exports.ReviewGate = exports.TaskComplexity = exports.TaskDomain = exports.ActorTier = exports.TeamRole = exports.ProjectRole = exports.WorkspaceRole = exports.ProjectColor = exports.ProjectStatus = exports.TaskPriority = exports.TaskStatus = void 0;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["BACKLOG"] = "BACKLOG";
    TaskStatus["READY"] = "READY";
    TaskStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TaskStatus["BLOCKED"] = "BLOCKED";
    TaskStatus["IN_REVIEW"] = "IN_REVIEW";
    TaskStatus["DONE"] = "DONE";
    TaskStatus["CANCELLED"] = "CANCELLED";
    TaskStatus["ESCALATION_PENDING"] = "ESCALATION_PENDING";
    TaskStatus["BLOCKED_AWAITING_HUMAN"] = "BLOCKED_AWAITING_HUMAN";
    TaskStatus["BLOCKED_HUMAN_REROUTE"] = "BLOCKED_HUMAN_REROUTE";
    TaskStatus["REROUTED_READY"] = "REROUTED_READY";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["NONE"] = "NONE";
    TaskPriority["LOW"] = "LOW";
    TaskPriority["MEDIUM"] = "MEDIUM";
    TaskPriority["HIGH"] = "HIGH";
    TaskPriority["URGENT"] = "URGENT";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["ACTIVE"] = "ACTIVE";
    ProjectStatus["PAUSED"] = "PAUSED";
    ProjectStatus["COMPLETED"] = "COMPLETED";
    ProjectStatus["ARCHIVED"] = "ARCHIVED";
})(ProjectStatus || (exports.ProjectStatus = ProjectStatus = {}));
var ProjectColor;
(function (ProjectColor) {
    ProjectColor["RED"] = "RED";
    ProjectColor["ORANGE"] = "ORANGE";
    ProjectColor["YELLOW"] = "YELLOW";
    ProjectColor["GREEN"] = "GREEN";
    ProjectColor["TEAL"] = "TEAL";
    ProjectColor["BLUE"] = "BLUE";
    ProjectColor["INDIGO"] = "INDIGO";
    ProjectColor["PURPLE"] = "PURPLE";
    ProjectColor["PINK"] = "PINK";
    ProjectColor["GRAY"] = "GRAY";
})(ProjectColor || (exports.ProjectColor = ProjectColor = {}));
var WorkspaceRole;
(function (WorkspaceRole) {
    WorkspaceRole["OWNER"] = "OWNER";
    WorkspaceRole["ADMIN"] = "ADMIN";
    WorkspaceRole["MEMBER"] = "MEMBER";
    WorkspaceRole["GUEST"] = "GUEST";
})(WorkspaceRole || (exports.WorkspaceRole = WorkspaceRole = {}));
var ProjectRole;
(function (ProjectRole) {
    ProjectRole["OWNER"] = "OWNER";
    ProjectRole["EDITOR"] = "EDITOR";
    ProjectRole["COMMENTER"] = "COMMENTER";
    ProjectRole["VIEWER"] = "VIEWER";
})(ProjectRole || (exports.ProjectRole = ProjectRole = {}));
var TeamRole;
(function (TeamRole) {
    TeamRole["LEAD"] = "LEAD";
    TeamRole["MEMBER"] = "MEMBER";
})(TeamRole || (exports.TeamRole = TeamRole = {}));
var ActorTier;
(function (ActorTier) {
    ActorTier["HUMAN"] = "HUMAN";
    ActorTier["CLAUDE_SONNET"] = "CLAUDE_SONNET";
    ActorTier["CLAUDE_OPUS"] = "CLAUDE_OPUS";
    ActorTier["CURSOR_COMPOSER"] = "CURSOR_COMPOSER";
    ActorTier["CREW_UIUX"] = "CREW_UIUX";
    ActorTier["CREW_BACKEND"] = "CREW_BACKEND";
    ActorTier["CREW_QA"] = "CREW_QA";
    ActorTier["CREW_DEVOPS"] = "CREW_DEVOPS";
    ActorTier["CREW_INFRA"] = "CREW_INFRA";
    ActorTier["CREW_DATA"] = "CREW_DATA";
    ActorTier["CREW_PLANNING"] = "CREW_PLANNING";
    ActorTier["CREW_LIBRARY"] = "CREW_LIBRARY";
    ActorTier["UNASSIGNED"] = "UNASSIGNED";
})(ActorTier || (exports.ActorTier = ActorTier = {}));
var TaskDomain;
(function (TaskDomain) {
    TaskDomain["UIUX"] = "UIUX";
    TaskDomain["BACKEND"] = "BACKEND";
    TaskDomain["INFRA"] = "INFRA";
    TaskDomain["DATA"] = "DATA";
    TaskDomain["TESTING"] = "TESTING";
    TaskDomain["DEVOPS"] = "DEVOPS";
    TaskDomain["PLANNING"] = "PLANNING";
    TaskDomain["REVIEW"] = "REVIEW";
    TaskDomain["LIBRARY"] = "LIBRARY";
    TaskDomain["GENERAL"] = "GENERAL";
})(TaskDomain || (exports.TaskDomain = TaskDomain = {}));
var TaskComplexity;
(function (TaskComplexity) {
    TaskComplexity["TRIVIAL"] = "TRIVIAL";
    TaskComplexity["LOW"] = "LOW";
    TaskComplexity["MEDIUM"] = "MEDIUM";
    TaskComplexity["HIGH"] = "HIGH";
    TaskComplexity["CRITICAL"] = "CRITICAL";
})(TaskComplexity || (exports.TaskComplexity = TaskComplexity = {}));
var ReviewGate;
(function (ReviewGate) {
    ReviewGate["NONE"] = "NONE";
    ReviewGate["AUTOMATED_ONLY"] = "AUTOMATED_ONLY";
    ReviewGate["CRITIC_REVIEW"] = "CRITIC_REVIEW";
    ReviewGate["HUMAN_SIGNOFF"] = "HUMAN_SIGNOFF";
    ReviewGate["FULL"] = "FULL";
})(ReviewGate || (exports.ReviewGate = ReviewGate = {}));
var DependencyType;
(function (DependencyType) {
    DependencyType["BLOCKING"] = "BLOCKING";
    DependencyType["WAITING_ON"] = "WAITING_ON";
})(DependencyType || (exports.DependencyType = DependencyType = {}));
var CustomFieldType;
(function (CustomFieldType) {
    CustomFieldType["TEXT"] = "TEXT";
    CustomFieldType["NUMBER"] = "NUMBER";
    CustomFieldType["DATE"] = "DATE";
    CustomFieldType["DROPDOWN"] = "DROPDOWN";
    CustomFieldType["CHECKBOX"] = "CHECKBOX";
    CustomFieldType["MULTI_SELECT"] = "MULTI_SELECT";
    CustomFieldType["PERSON"] = "PERSON";
    CustomFieldType["URL"] = "URL";
})(CustomFieldType || (exports.CustomFieldType = CustomFieldType = {}));
var GoalMetricType;
(function (GoalMetricType) {
    GoalMetricType["PERCENT"] = "PERCENT";
    GoalMetricType["NUMBER"] = "NUMBER";
    GoalMetricType["CURRENCY"] = "CURRENCY";
    GoalMetricType["BOOLEAN"] = "BOOLEAN";
})(GoalMetricType || (exports.GoalMetricType = GoalMetricType = {}));
var GoalStatus;
(function (GoalStatus) {
    GoalStatus["ON_TRACK"] = "ON_TRACK";
    GoalStatus["AT_RISK"] = "AT_RISK";
    GoalStatus["OFF_TRACK"] = "OFF_TRACK";
    GoalStatus["ACHIEVED"] = "ACHIEVED";
    GoalStatus["MISSED"] = "MISSED";
    GoalStatus["NO_STATUS"] = "NO_STATUS";
})(GoalStatus || (exports.GoalStatus = GoalStatus = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["TASK_ASSIGNED"] = "TASK_ASSIGNED";
    NotificationType["TASK_COMMENTED"] = "TASK_COMMENTED";
    NotificationType["TASK_COMPLETED"] = "TASK_COMPLETED";
    NotificationType["TASK_DUE_SOON"] = "TASK_DUE_SOON";
    NotificationType["TASK_OVERDUE"] = "TASK_OVERDUE";
    NotificationType["PROJECT_INVITE"] = "PROJECT_INVITE";
    NotificationType["MENTION"] = "MENTION";
    NotificationType["RULE_TRIGGERED"] = "RULE_TRIGGERED";
    NotificationType["AGENT_ACTION"] = "AGENT_ACTION";
    NotificationType["ESCALATION"] = "ESCALATION";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var AutomationTriggerType;
(function (AutomationTriggerType) {
    AutomationTriggerType["TASK_STATUS_CHANGED"] = "TASK_STATUS_CHANGED";
    AutomationTriggerType["TASK_CREATED"] = "TASK_CREATED";
    AutomationTriggerType["TASK_DUE_DATE_APPROACHING"] = "TASK_DUE_DATE_APPROACHING";
    AutomationTriggerType["TASK_OVERDUE"] = "TASK_OVERDUE";
    AutomationTriggerType["TASK_COMPLETED"] = "TASK_COMPLETED";
    AutomationTriggerType["ASSIGNEE_CHANGED"] = "ASSIGNEE_CHANGED";
    AutomationTriggerType["CUSTOM_FIELD_CHANGED"] = "CUSTOM_FIELD_CHANGED";
    AutomationTriggerType["SECTION_CHANGED"] = "SECTION_CHANGED";
    AutomationTriggerType["AGENT_COMPLETED"] = "AGENT_COMPLETED";
})(AutomationTriggerType || (exports.AutomationTriggerType = AutomationTriggerType = {}));
var AutomationActionType;
(function (AutomationActionType) {
    AutomationActionType["CHANGE_STATUS"] = "CHANGE_STATUS";
    AutomationActionType["ASSIGN_TO"] = "ASSIGN_TO";
    AutomationActionType["MOVE_TO_SECTION"] = "MOVE_TO_SECTION";
    AutomationActionType["ADD_TAG"] = "ADD_TAG";
    AutomationActionType["REMOVE_TAG"] = "REMOVE_TAG";
    AutomationActionType["NOTIFY_USER"] = "NOTIFY_USER";
    AutomationActionType["SET_PRIORITY"] = "SET_PRIORITY";
    AutomationActionType["SET_DUE_DATE"] = "SET_DUE_DATE";
    AutomationActionType["TRIGGER_AGENT"] = "TRIGGER_AGENT";
    AutomationActionType["CREATE_SUBTASK"] = "CREATE_SUBTASK";
})(AutomationActionType || (exports.AutomationActionType = AutomationActionType = {}));
var AuditEventType;
(function (AuditEventType) {
    AuditEventType["TASK_CREATED"] = "TASK_CREATED";
    AuditEventType["TASK_UPDATED"] = "TASK_UPDATED";
    AuditEventType["TASK_DELETED"] = "TASK_DELETED";
    AuditEventType["TASK_ASSIGNED"] = "TASK_ASSIGNED";
    AuditEventType["STATUS_CHANGED"] = "STATUS_CHANGED";
    AuditEventType["ESCALATION"] = "ESCALATION";
    AuditEventType["AGENT_STARTED"] = "AGENT_STARTED";
    AuditEventType["AGENT_COMPLETED"] = "AGENT_COMPLETED";
    AuditEventType["AGENT_FAILED"] = "AGENT_FAILED";
    AuditEventType["REROUTED"] = "REROUTED";
    AuditEventType["HUMAN_SIGNOFF"] = "HUMAN_SIGNOFF";
    AuditEventType["COMMENT_ADDED"] = "COMMENT_ADDED";
    AuditEventType["ATTACHMENT_ADDED"] = "ATTACHMENT_ADDED";
    AuditEventType["RULE_TRIGGERED"] = "RULE_TRIGGERED";
})(AuditEventType || (exports.AuditEventType = AuditEventType = {}));
var AgentTokenScope;
(function (AgentTokenScope) {
    AgentTokenScope["READ_TASKS"] = "READ_TASKS";
    AgentTokenScope["WRITE_TASKS"] = "WRITE_TASKS";
    AgentTokenScope["READ_PROJECTS"] = "READ_PROJECTS";
    AgentTokenScope["WRITE_PROJECTS"] = "WRITE_PROJECTS";
    AgentTokenScope["FULL_ACCESS"] = "FULL_ACCESS";
})(AgentTokenScope || (exports.AgentTokenScope = AgentTokenScope = {}));
//# sourceMappingURL=index.js.map