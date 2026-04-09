# PM views, charts & agile structures — roadmap

This document extends product direction beyond the Asana-parity matrix: **classic project-manager views** (Gantt-style scheduling, burndown / burnup, portfolio roll-ups) and **Scrum/Kanban-friendly structures** (epics, sprints, user stories). It is written to align with the existing Vineroot model (`Task`, `Project`, `Section`, `TaskDependency`, custom fields, timeline/calendar) and ModelT/agent metadata (no removal of `actorTier`, agent JSON, etc.).

## Current state (baseline)

| Capability | What exists today |
|------------|-------------------|
| Time-based bar view | **Timeline** (`ProjectTimelineView`): sections × tasks, bars from `startDate`/`dueDate`, week/month/quarter zoom, “today” line. |
| Calendar | **Calendar** view: tasks on dates. |
| Dependencies | Same-project **`TaskDependency`** (`waitingOn` on task DTO); editable in task detail; **SVG dependency edges** on the timeline when both tasks have bars. |
| Hierarchy | **`parentTaskId`** subtasks (deep tree on list/board). |
| Grouping / columns | **`Section`** (project-scoped); seed data also uses section names like “This sprint” informally. |
| Sprints & estimation | **First-class `Sprint`** + **`Task.sprintId`**, **`storyPoints`**, **`workItemType`**; API sprint CRUD; project payload **`sprints`**; **sprint filter** (All / Backlog / sprint) on list, board, timeline, calendar, workload; **dedicated Backlog tab** (`/projects/:id/backlog`) forces unscheduled work in list UI without changing the List tab’s stored filter; list/board chips for type, points, sprint name. |
| Estimation / sprint (informal) | **Custom fields** still available for alternate schemes (e.g. T-shirt in seed). |
| Dashboards | Workspace **dashboards** exist at a high level; not yet wired to sprint metrics. |
| Burndown | **Project Burndown tab** + **`GET …/projects/:projectId/sprints/:sprintId/burndown`**: ideal + remaining series; charts **prefer `SprintMetricSnapshot` per day** when present (written on task create/update/delete/duplicate), else reconstruct from current tasks + `completedAt`. |
| Burnup | **`GET …/projects/:projectId/sprints/:sprintId/burnup`** + chart: cumulative completed vs scope; same snapshot preference as burndown. |
| Velocity | **`GET …/projects/:projectId/sprints/velocity?take=`** + bar chart on Burndown page: completed points per recent sprint (DONE in window); team average across returned sprints. |
| CFD / Flow | **`GET …/projects/:projectId/cfd`** + **`ProjectCfdSnapshot`**; **Flow** project tab; workspace dashboard **`PROJECT_CFD`** widget. |
| Epic filter & roll-ups | Header **Epic** dropdown: **All epics** or one epic; filters list, board, backlog, **roadmap**, timeline, calendar, workload to that epic + descendants and **`epicTaskId`** links. **`GET …/epic-rollups`** includes linked work. **`Task.epicTaskId`** + task detail **Epic** selector. Persisted in sessionStorage. |
| Roadmap (epics) | **Roadmap** project tab (`/projects/:id/roadmap`): multi-month grid of **EPIC** rows (start/due bars); saved view surface **`roadmap`**. |
| Critical path | Timeline **Critical path** toggle: longest dependency path highlighted (sessionStorage per project). |
| Workload | **`GET …/projects/:projectId/workload`** (`weeks`, `from`, optional `sprintFilter` / `epicFilter`); **Workload** tab — assignee × week grid. |

**Remaining gaps (near term):** deeper epic **dashboard** (beyond header summary + roadmap); **WIP limits** / Kanban policies; portfolio sprint widgets.

---

## Target structures (agile & hybrid)

### 1. Work item types (lightweight)

Introduce a stable classification on **`Task`** (enum or string), e.g.:

- `TASK` (default), `STORY`, `BUG`, `EPIC`, `CHORE`, `SPIKE` (exact set TBD).

**Epics (recommended mapping):**  
- **Option A (fastest):** `workItemType = EPIC` + child tasks/stories via existing **`parentTaskId`**. Roll-up = sum story points / count children under that root.  
- **Option B:** Optional **`epicTaskId`** on `Task` pointing to an epic task (**shipped**) for cross-parent linking and cleaner queries.  
- **Option C:** Epic = **separate `Project`** linked under a **goal/portfolio** — heavier, better for huge programs.

**User stories:** Prefer **`STORY`** type + description as acceptance criteria (later: optional structured AC checklist). No need for a separate table for v1.

### 2. Sprints

**Option A — First-class `Sprint` model (recommended for burndown/velocity):**

- `Sprint`: `id`, `projectId`, `name`, `startDate`, `endDate`, optional `goal`, `sortOrder` / `state` (PLANNED | ACTIVE | CLOSED).
- `Task.sprintId` optional FK; nullable = backlog.

**Option B — Reuse `Section`:** treat a section as a sprint (add `startDate`/`endDate` on `Section` or a `SectionKind = SPRINT`). Fewer tables; weaker if sections are also used as Kanban columns.

**Option C — Custom field only:** already possible; reporting must key off field values (fragile for APIs and charts).

### 3. Story points & effort

- **First-class `storyPoints` (nullable number)** on `Task` simplifies burndown, velocity, and API filters; keep **custom fields** for teams that want multiple estimation schemes (T-shirt, hours, etc.).  
- Migration path: duplicate or sync from existing custom field where present.

### 4. Kanban vs Scrum

- **Kanban:** WIP limits per section/column (future), **CFD** by status × day.  
- **Scrum:** Sprints + burndown + sprint planning view (filter by `sprintId`).  
Both can coexist per project (project setting: `methodologyPreference` or feature flags).

---

## Charts & views (delivery phases)

### Phase A — Gantt-style enhancements (build on Timeline)

**Goals:** PM-grade schedule clarity without a separate product.

1. ~~**Dependency edges**~~ — **Shipped:** SVG connectors on timeline when both tasks have schedule bars.  
2. ~~**Critical path**~~ — **Shipped:** timeline toggle; longest path on blocking → dependent DAG (`timelineCriticalPath.ts`).  
3. ~~**Milestone** treatment~~ — **Shipped (MVP):** `Task.isMilestone` + same-day bar heuristic (diamond) in UI.  
4. ~~**WBS mode**~~ — **Shipped:** timeline toggle to indent rows by `parentTaskId`.  
5. **Naming:** optional rename **Timeline → Schedule (Gantt)** or add **Gantt** tab alias — product decision.

**Data:** Already have `startDate`, `dueDate`, `TaskDependency`; may need to ensure timeline query includes `waitingOn` / blocking ids for all visible tasks.

### Phase B — Burndown & sprint scope

**Burndown chart (per sprint):**

- **X-axis:** days from `sprint.startDate` to `sprint.endDate`.  
- **Y-axis:** remaining work (sum of **`storyPoints`** for non-done tasks, or **task count** if points missing).  
- **Lines:** ideal (linear from total scope at start to 0), actual (daily snapshot of remaining).  
- **Scope change:** optional third series or events when tasks added mid-sprint.

**Implementation notes:**

- **Snapshots:** **`SprintMetricSnapshot`** rows are written on task create/update/delete/duplicate; charts **use per-day snapshots when available**. **Shipped:** burnup API returns **`initialScope`**, **`scopeChanges`** (day-over-day scope deltas from snapshots), and the Burndown page lists them + marks points on the burnup chart.  
- **API:** `GET /api/v1/projects/:projectId/sprints/:sprintId/burndown` (optional `from`/`to` later).

### Phase C — Velocity, burnup, cumulative flow

| Chart | Purpose | Key inputs |
|-------|---------|------------|
| **Velocity** | Last N closed sprints: sum of story points completed per sprint | Completed tasks per sprint boundary |
| **Burnup** | Scope vs completed over time (sprint or release) | Same + scope additions |
| **CFD** | Flow health by status | Daily counts per status (snapshot table or event stream) |

These belong on **project** or **workspace dashboard** widgets once sprint + points exist.

### Phase D — Organization UI

- **Backlog** view: flat/filtered list, `sprintId is null`. **Shipped:** **Backlog** project tab + route **`/projects/:id/backlog`** (list component, epic + roots-only, forced backlog scope). **Also:** sprint filter **Backlog** on list/board/timeline/calendar/workload still scopes those views without switching tabs. **Shipped:** **`Task.backlogRank`** (integer, nullable) + task detail editor; **Backlog** tab sorts unscheduled roots by rank then `sortOrder`.  
- **Sprint board:** **Shipped:** **Sprint** project tab (`/projects/:id/sprint-board`) — board UI scoped to one sprint; sprint picker shows **concrete sprints only** (no All/Backlog); default sprint = ACTIVE → earliest PLANNED → latest closed. List/Board tab sprint filter in sessionStorage is unchanged until the user picks a sprint on the Sprint tab (then shared).  
- **Epic panel:** **Shipped (MVP):** header **Epic** filter + **`/epic-rollups`** + **`epicTaskId`** + task detail link + **focus strip** when one epic is selected (counts, open epic). **Still TBD:** full epic dashboard beyond header + roadmap.  
- **Roadmap:** **Shipped:** **Roadmap** tab — epics on a multi-month timeline (`ProjectEpicRoadmapView`), separate from task Gantt.

---

## API & events (sketch)

- CRUD **sprints** under project; PATCH task **`sprintId`**, **`storyPoints`**, **`workItemType`**.  
- Extend **`task:updated`** / activity where useful for reporting fan-out.  
- Read-only **report** endpoints to keep aggregations out of generic `GET /projects/:id` payloads.

---

## Suggested implementation order

1. ~~**Schema:** `workItemType`, `storyPoints`, `Sprint` + `Task.sprintId`~~ — **Shipped (2026-04)** (migration `20260407120000_sprints_work_items`).
2. ~~**API + Task detail UI** for those fields~~ — REST sprints + task PATCH; web **Planning** panel.
3. ~~**Timeline:** load deps + draw connectors~~ — project payload includes root-task `waitingOn` + blocking summaries with dates; **SVG edges** on timeline.
4. ~~**Burndown** (MVP)~~ — **Burndown** project tab + burndown API + **`SprintMetricSnapshot`** integration for day-accurate curves when data exists.  
5. ~~**Velocity / burnup / CFD (MVP)**~~ — velocity + burnup on Burndown; **`GET …/cfd`**, **`ProjectCfdSnapshot`**, **Flow** tab, **`PROJECT_CFD`** dashboard widget. **Still TBD:** richer dashboard suite, portfolio roll-ups.  
6. **Epic-centric navigation** (**Phase D**) — ~~epic filter on main views~~ + ~~**`GET …/epic-rollups`** + dropdown hints~~ + ~~**`epicTaskId`** / cross-parent link~~ + ~~multi-month **Roadmap** tab~~ + ~~epic focus strip~~ + ~~**`backlogRank`** on backlog tab~~; **dedicated Backlog tab** + **dedicated Sprint board tab** shipped. **Still TBD:** epic dashboard beyond header strip, WIP limits.

**Next open items (not ordered):** WIP limits / Kanban policies, richer **portfolio** sprint widgets.

---

## Explicit non-goals (near term)

- **MS Project “deep”** extras not yet built: ten baselines, split tasks, timephased grids, network (PERT) view, `.mpp` interchange, enterprise HR resource pool — see [`ms-project-parity.md`](./ms-project-parity.md) for what **is** implemented (calendars, CPM, baselines 0–2, EVM MVP, programs).
- Replacing **Jira** workflow engines (complex post-functions).
- **SAFe** program layers without prior epic/sprint shipping.

---

## References in-repo

- Parity matrix: [`asana-parity.md`](./asana-parity.md) — update matrix rows when views ship.  
- Timeline implementation: `apps/web/src/components/project/ProjectTimelineView.tsx`.  
- Workload: `apps/web/src/components/project/ProjectWorkloadView.tsx`; API `apps/api/src/project/project-workload.util.ts` + `GET …/workload`.  
- Backlog / Sprint board / Roadmap: `apps/web/src/pages/project/ProjectPage.tsx` (`currentView === 'backlog'` | `'sprint-board'` | `'roadmap'`), routes in `apps/web/src/App.tsx`; default sprint: `apps/web/src/lib/pickDefaultSprint.ts`; backlog stack rank: `sortBacklogRoots.ts`; epic roadmap: `ProjectEpicRoadmapView.tsx`; critical path: `timelineCriticalPath.ts` + `ProjectTimelineView.tsx`.  
- Dependencies: `TaskDependency` in `prisma/schema.prisma`, task service `waitingOn` mapping.
