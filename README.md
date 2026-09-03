# Vineroot

> ## ⚠️ Deprecated — removed from the active portfolio band
>
> Vineroot is no longer actively developed (deprecated 1 July 2026,
> `chore: deprecate Vineroot and remove from active portfolio band`). The code
> is preserved for reference; do not build new work on it.
>
> **Note on branches:** the deprecation lives only on
> `deprecate/remove-from-band`. It was never merged, so `origin/main` still
> points at the April 2026 tip (`CPM function added, refactor to a new thing in
> a new iteration`) and reads as if the project were active. Treat this branch
> as the accurate record.

**Vineroot** was a full-featured project management platform — Asana-parity from
day one, with deep LLM-agent integration built into its core data model. It was
intended to serve as both a human-facing PM tool and a routing/assignment hub for
AI agents operating across the ModelT agentic software factory (the `modelT`
system, which lives under `C:\Development\modelT`).

---

## Architecture

```
vineroot/
├── apps/
│   ├── api/          # NestJS REST + WebSocket API (port 4000)
│   └── web/          # React + Vite frontend (port 3000)
├── packages/
│   └── shared-types/ # TypeScript types shared across apps
├── prisma/
│   └── schema.prisma # PostgreSQL schema (Prisma ORM)
├── turbo.json
└── package.json      # Turborepo workspace root
```

### Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 10, Prisma 5, PostgreSQL, Redis, Socket.IO |
| Frontend | React 18, Vite 5, Tailwind CSS 3, Zustand, React Query 5 |
| Auth | JWT (15m) + Refresh tokens (7d), Passport.js |
| Real-time | Socket.IO WebSockets, workspace-scoped rooms |
| Drag & Drop | @dnd-kit (Board and Timeline views) |

---

## Features

### Core PM (Asana Parity)

- **Workspaces & Teams** — multi-tenant, role-based access (Owner / Admin / Member / Guest)
- **Projects** — with color, privacy, status, start/due dates; assignable to teams
- **Sections** — ordered groups within projects (kanban columns in board view)
- **Tasks** — full CRUD: title, description (rich text), status, priority, assignees, due dates, estimates, tags
- **Subtasks** — self-referential task hierarchy, unlimited depth
- **Task Dependencies** — blocking / waiting-on graph
- **Custom Fields** — Text, Number, Date, Dropdown, Checkbox, Multi-select, Person, URL
- **Tags** — workspace-scoped, applied to tasks
- **Comments** — threaded on tasks, with activity log
- **Attachments** — file uploads per task
- **Four Project Views** — List (Asana-style), Board (Kanban), Timeline (Gantt), Calendar
- **My Tasks** — cross-project personal task view, grouped by Today / Upcoming / Later
- **Inbox** — notification center with unread count and mark-read
- **Portfolios** — aggregate multiple projects with health status
- **Goals** — with progress metrics (%, number, currency, boolean)
- **Automations** — trigger/action rules (status changes, assignments, etc.)
- **Reporting** — task completion over time, status distribution, workload charts

### LLM Agent Integration

Every task carries first-class agent metadata:

| Field | Type | Purpose |
|---|---|---|
| `actorTier` | enum | Which actor handles this task (HUMAN, CLAUDE_SONNET, CLAUDE_OPUS, CURSOR_COMPOSER, CREW_*) |
| `domain` | enum | Work domain (UIUX, BACKEND, INFRA, DATA, TESTING, DEVOPS, PLANNING, REVIEW, LIBRARY) |
| `complexity` | enum | TRIVIAL → CRITICAL |
| `reviewGate` | enum | What must pass before DONE (NONE, AUTOMATED_ONLY, CRITIC_REVIEW, HUMAN_SIGNOFF, FULL) |
| `phase` | int | Project phase (0–8, per ModelT runbook) |
| `parallelGroup` | string | Tasks with the same group ID can run concurrently |
| `agentContext` | JSON | Arbitrary context blob for the assigned agent |
| `agentOutput` | JSON | Structured output returned by the agent |

**Agent API** — agents authenticate via `AgentToken` (scoped Bearer tokens) and interact through:
- `GET /api/v1/agent/tasks` — fetch READY tasks for their actor tier
- `POST /api/v1/agent/tasks/:id/claim` — claim a task (→ IN_PROGRESS)
- `POST /api/v1/agent/tasks/:id/complete` — submit output; status transitions by reviewGate
- `POST /api/v1/agent/tasks/:id/fail` — report failure; triggers escalation chain

**Escalation logic** (automatic):
1. Retry count < 2 → task reset to READY
2. Retry count ≥ 2 → `ESCALATION_PENDING`, AuditLog entry, human notification

**Audit trail** — every agent action, status change, and escalation is written to `AuditLog` with actor tier, timestamps, and full metadata.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- pnpm or npm workspaces

### Setup

```bash
# 1. Clone and install
cd Vineroot
npm install

# 2. Configure environment
cp .env.example .env
# Edit DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Generate Prisma client and push schema
npm run db:generate
npm run db:push

# 4. Run everything
npm run dev
# API: http://localhost:4000
# Web: http://localhost:3000
# Swagger: http://localhost:4000/api/docs
```

### Web environment

```bash
cp apps/web/.env.example apps/web/.env
# VITE_API_URL and VITE_WS_URL default to localhost:4000
```

---

## API Reference

Swagger UI is available at `http://localhost:4000/api/docs` when the API is running.

### Key endpoint groups

| Group | Base Path |
|---|---|
| Auth | `/api/v1/auth` |
| Workspaces | `/api/v1/workspaces` |
| Teams | `/api/v1/workspaces/:id/teams` |
| Projects | `/api/v1/workspaces/:id/projects` |
| Sections | `/api/v1/projects/:id/sections` |
| Tasks | `/api/v1/projects/:id/tasks`, `/api/v1/tasks/:id` |
| Comments | `/api/v1/tasks/:id/comments` |
| Tags | `/api/v1/workspaces/:id/tags` |
| Custom Fields | `/api/v1/workspaces/:id/custom-fields` |
| Portfolios | `/api/v1/workspaces/:id/portfolios` |
| Goals | `/api/v1/workspaces/:id/goals` |
| Notifications | `/api/v1/notifications` |
| Automations | `/api/v1/workspaces/:id/automations` |
| Agent tokens | `/api/v1/workspaces/:id/agent/tokens` |
| Agent tasks | `/api/v1/agent/tasks` (AgentToken auth) |

---

## WebSocket Events

Connect to `/events` with `Authorization: Bearer <token>` in handshake auth.

| Client → Server | Purpose |
|---|---|
| `join:workspace` `{ workspaceId }` | Subscribe to workspace events |
| `join:task` `{ taskId }` | Subscribe to task-level events |

| Server → Client | Payload |
|---|---|
| `task:updated` | Updated task object |
| `task:created` | New task object |
| `task:deleted` | `{ taskId }` |
| `notification:new` | Notification object |
| `section:updated` | Updated section |

---

## ModelT Integration Notes

Vineroot is the PM system referenced throughout the ModelT runbook. Task statuses map directly:

| ModelT State | Vineroot `TaskStatus` |
|---|---|
| READY | `READY` |
| Executing | `IN_PROGRESS` |
| Awaiting review | `IN_REVIEW` |
| Blocked | `BLOCKED` |
| Escalated | `ESCALATION_PENDING` |
| Awaiting human | `BLOCKED_AWAITING_HUMAN` |
| Human rerouting | `BLOCKED_HUMAN_REROUTE` |
| Rerouted, re-queued | `REROUTED_READY` |
| Complete | `DONE` |

The PM Agent Crew (5-minute heartbeat) should poll `GET /api/v1/agent/tasks` filtered by its actor tier to pick up newly unblocked READY tasks. Dependency unblocking happens automatically: when a task moves to DONE, the orchestrator (or a future scheduled job) should re-evaluate dependent tasks whose all blockers are now DONE and promote them to READY.
