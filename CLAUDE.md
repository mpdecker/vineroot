# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vineroot is a full-stack project management platform (Asana clone) with deep LLM agent integration. It is a **Turborepo monorepo** with a NestJS backend, React/Vite frontend, and a shared TypeScript types package.

## Development Setup

**Prerequisites:** Docker must be running for PostgreSQL and Redis.

```bash
# Start infrastructure
docker-compose up -d          # PostgreSQL (:5433) + Redis (:6379)

# Install all workspace dependencies
npm install

# Database setup (first time or after schema changes)
npm run db:generate           # Generate Prisma client
npm run db:push               # Sync schema to DB (dev, non-destructive)
npm run db:seed               # Seed with test data

# Run everything
npm run dev                   # Starts API (:4000) + Web (:3000) concurrently
```

## Common Commands

### Root (from repo root)
```bash
npm run dev           # All apps in watch mode
npm run build         # Build all apps
npm run test          # Run all tests
npm run db:generate   # Regenerate Prisma client after schema changes
npm run db:push       # Push schema changes without migration
npm run db:migrate    # Create a named migration
npm run db:studio     # Open Prisma Studio (visual DB explorer)
npm run db:seed       # Seed database
```

### Backend only (from `apps/api/`)
```bash
npm run dev           # NestJS watch mode
npm run test          # Jest
npm run test:watch    # Jest watch
npm run test:cov      # Jest with coverage
```

### Frontend only (from `apps/web/`)
```bash
npm run dev           # Vite dev server (proxies /api and /socket.io to :4000)
npm run lint          # ESLint
npm run test          # Vitest (run once)
npm run test:watch    # Vitest watch mode
npm run build         # TypeScript check + production build
```

## Architecture

### Monorepo Structure
- **`apps/api/`** — NestJS REST + WebSocket API (port 4000)
- **`apps/web/`** — React 18 + Vite frontend (port 3000)
- **`packages/shared-types/`** — Shared TypeScript enums/constants (`TaskStatus`, `ActorTier`, `TaskDomain`, etc.) consumed by both apps
- **`prisma/`** — Prisma schema, migrations, and seed script (at root level)

### Backend (`apps/api/src/`)

NestJS with standard module/service/controller pattern. Each domain is self-contained:

- **`common/`** — `PrismaService` (shared DB client), `EventsGateway` (Socket.IO WebSocket hub), global exception filter
- **`auth/`** — JWT + Passport (15m access token / 7d refresh token), guards used across all protected routes
- **`task/`** — Core entity; status machine: `BACKLOG → READY → IN_PROGRESS → BLOCKED/IN_REVIEW → DONE`, with `ESCALATION_PENDING` variants
- **`agent/`** — Separate endpoints for AI agents using Bearer tokens (`AgentToken`); agents fetch `READY` tasks, claim, complete, or fail them
- **`automation/`** — Trigger/action rules that fire on task events
- **`common/events.gateway.ts`** — Broadcasts `task:updated`, `task:created`, etc. to workspace/task Socket.IO rooms on every CRUD operation

Key patterns:
- All modules import `PrismaService` from `common`; no direct `new PrismaClient()`
- `EventsGateway` is injected into services that need to emit real-time events
- `ValidationPipe` globally applied; DTOs use `class-validator` decorators
- Swagger decorators on all controllers; UI at `/api/docs`

### Frontend (`apps/web/src/`)

- **`pages/`** — Route-level containers; map 1:1 to routes in `App.tsx`
- **`components/`** — Feature-organized; `components/ui/` for reusable primitives
- **`stores/`** — Zustand stores for global state (`auth`, `notifications`, `workspace`)
- **`hooks/`** — React Query hooks wrapping API calls; mutations auto-invalidate related queries
- **`lib/`** — Axios API client, Socket.IO client setup, formatters

Data flow: **Zustand** for auth/UI state → **React Query** for server state (cache + sync) → **Socket.IO** events trigger query invalidation for real-time updates.

### Data Model (Prisma)

Central entities and their relationships:
- `User` → `WorkspaceMember` → `Workspace` (multi-tenant; roles: OWNER/ADMIN/MEMBER/GUEST)
- `Task` ⇄ `Task` (self-referential subtask tree) + `TaskDependency` (blocking graph)
- `Task` → `CustomFieldValue` (per-project extensible fields)
- `Task` → `ActivityLog` (human-visible feed) + `AuditLog` (immutable agent/system events)
- `AgentToken` — Bearer tokens for AI agent authentication (separate from user JWT)

### Agent Integration

Tasks carry first-class agent metadata: `actorTier`, `domain`, `complexity`, `reviewGate`, `phase`, `parallelGroup`, `agentContext`, `agentOutput`. These fields drive the agent workflow:
- `actorTier` — which AI actor should handle the task (`CLAUDE_SONNET`, `CLAUDE_OPUS`, `CURSOR_COMPOSER`, `CREW_*`, `HUMAN`)
- `reviewGate` — `NONE | AUTOMATED_ONLY | CRITIC_REVIEW | HUMAN_SIGNOFF | FULL`
- Agent API lives at `/api/v1/agent/tasks` (Bearer token auth, separate from user JWT)

### Environment Variables

Copy `.env.example` to `.env` in the repo root for backend config (DB, Redis, JWT secrets). Copy `apps/web/.env.example` to `apps/web/.env` for frontend (`VITE_API_URL`, `VITE_WS_URL`).
