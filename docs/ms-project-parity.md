# Microsoft Project parity — decisions, audit, and implementation map

This document locks **product decisions** for MS Project–class scheduling, points to the **feature audit matrix**, and maps **implemented** APIs and schema. It complements [`parity-backlog-msp-jira-scope.md`](./parity-backlog-msp-jira-scope.md) §3.

## Phase 0 — Locked decisions

| Topic | Decision |
|-------|----------|
| **MPP / file interchange** | **Out of scope** — no `.mpp` import/export fidelity target. |
| **Enterprise resource pool / HR** | **Out of scope** — no external HR-scale pool; in-app resources only. |
| **Generic vs user resources** | **Users:** `TaskAssignee` + `unitsPercent`. **Generics (Phase 2):** `GenericResource` + `TaskGenericResourceAssignment` in the same workspace as the task; `maxUnitsPercent` drives overallocation threshold. |
| **Date ownership** | **Hybrid:** `Task.isManuallyScheduled` (default `true` for existing behavior). When `false`, server **schedule engine** may update `startDate`/`dueDate` from CPM. Users can flip per task or bulk from project settings `defaultManualSchedule`. |
| **Dependency `DependencyType` vs MSP links** | **`WAITING_ON` / `BLOCKING`** remain UI/semantic. **`ScheduleLinkType`** on `TaskDependency` drives CPM: **FS** (default), **SS**, **FF**, **SF**. Legacy rows default to **FS**. |
| **Lag** | **`lagDays`** interpreted as **working-day** offset once project has a `WorkCalendar`; until then, calendar-day compatible with prior behavior. |
| **Agile coexistence** | Sprints remain **filters and reporting**; CPM does not auto-clear `sprintId`. Precedence: manual constraint dates still respected when `isManuallyScheduled` is true. |

## Feature audit matrix (summary)

| MS Project capability | Vineroot | Gap |
|----------------------|----------|-----|
| WBS / hierarchy | `parentTaskId`, timeline WBS | Low |
| Start/finish | `startDate`, `dueDate`, `isMilestone` | Engine + manual flag |
| CPM / calendars | `WorkCalendar`, `ScheduleEngineService` | Was high → implemented (MVP) |
| Link types FS–SF | `ScheduleLinkType` on dependency | Was high → implemented |
| Constraints | `TaskConstraintType` + `constraintDate` | Was high → implemented |
| Duration / work / mode | `durationWorkingMinutes`, `workMinutes`, `TaskScheduleMode` | Was high → implemented |
| Baselines | `TaskBaseline` (0–10) | Was high → implemented |
| Assignments / units | `TaskAssignee.unitsPercent`; generic `TaskGenericResourceAssignment` + `GenericResource.maxUnitsPercent` | Med |
| Leveling / overallocation | `POST …/schedule/level`, overallocation endpoint | Was high → MVP heuristic |
| Cost / EVM | `fixedCost`, rates on user, `GET …/evm` | Was high → MVP |
| Cross-project / program | `ScheduleProgram`, `ScheduleProgramProject`, cross-project deps, program rollup API | Was high → **CPM merges** all projects sharing a program with the focal project (single solver); rollup API unchanged |
| Phase 7 views / exports | `GET …/schedule/network`, `GET …/schedule/timephased`; project **Network** & **Timephased** tabs; timeline row filter + **Export schedule CSV**; task **split segments** (JSON) | Optional MSP-deep polish |
| Network / timephased / split tasks | Network + timephased APIs & views; `scheduleSegments` JSON; **`workContour`** on task for timephased spread; timeline filters & schedule CSV | Phase 4 MVP: contours + segment-aligned timephased; CPM still single interval |

Full narrative audit lives in the archived plan: **MS Project parity audit** (Cursor plan); this file is the maintained source of truth for **decisions** and **code pointers**.

## Implementation map (API / code)

| Area | Location |
|------|----------|
| Prisma models | `prisma/schema.prisma` — `WorkCalendar`, `ScheduleProgram`, `ScheduleProgramProject`, `TaskBaseline`, `GenericResource`, `TaskGenericResourceAssignment`, task/dependency/assignee/project fields |
| Calendars CRUD | `GET/POST …/workspaces/:workspaceId/work-calendars`, `GET/PATCH/DELETE …/work-calendars/:calendarId` |
| Profile scheduling | `PATCH /api/v1/auth/me` — `workCalendarId` (nullable), `resourceStandardRatePerHour`, `resourceOvertimeRatePerHour` |
| Project schedule settings | `PATCH /api/v1/projects/:projectId` — `workCalendarId`, `defaultManualSchedule`, `scheduleProgramId` |
| Run engine / critical path | `POST /api/v1/projects/:projectId/schedule/recalculate`, `GET …/schedule/critical-path` |
| Baselines | `POST /api/v1/projects/:projectId/schedule/baselines`, `GET …/schedule/baselines` |
| Leveling / overallocation | `POST …/schedule/level`, `GET …/schedule/overallocations` |
| EVM | `GET …/projects/:projectId/schedule/evm` (query: `baselineIndex`, `earnedValueBasis`, `pvModel`; see **EVM calculations** below) |
| Task cost ledger | `GET/POST …/projects/:projectId/tasks/:taskId/cost-entries` |
| Program | `POST/GET …/workspaces/:workspaceId/schedule-programs`, link projects, `POST …/dependencies` cross-project when same program |
| Network / timephased | `GET …/projects/:projectId/schedule/network`, `GET …/projects/:projectId/schedule/timephased?granularity=week|day&basis=calendar|working` |
| Task split segments | `scheduleSegments` on `Task` (PATCH task body); timeline renders multiple bars when set |
| Timephased work contour | `workContour` on `Task` (incl. `DOUBLE_PEAK`, `TURTLE`, `EARLY_PEAK`, `LATE_PEAK`); shapes timephased when **no** `scheduleSegments` |
| Generic resources | `GET/POST …/workspaces/:workspaceId/generic-resources`, `GET/PATCH/DELETE …/generic-resources/:id`; task assignments `POST/PATCH/DELETE …/tasks/:id/generic-resource-assignments` |

Nest module: `apps/api/src/schedule/`.

**Remaining work toward full parity (scoped implementation plan):** [`ms-project-full-parity-implementation-plan.md`](./ms-project-full-parity-implementation-plan.md). **Backlog ID status** (which **E-/R-/C-/S-/V-/F-** items are already shipped vs open) is maintained in that doc’s **§2.1** and [`parity-backlog-msp-jira-scope.md`](./parity-backlog-msp-jira-scope.md) **§3.5**.

### Calendars and time zones (engine honesty)

**Phase 2.1 (2026-04):** When `WorkCalendar.timeZone` is a valid **IANA** id (not `UTC`), CPM and working-day math use **local calendar dates** and **local weekdays** in that zone via `Intl` (`schedule-calendar.util.ts`). **Exception** rows (`YYYY-MM-DD`) match those **local** dates. Invalid or empty `timeZone` values fall back to **UTC** (same behavior as Phase 1). Slack is still approximated from early/late `Date` deltas in milliseconds (not a strict “working-day slack” count).

### Constraints (Phase 2.1)

**`MFO`:** Forward pass aligns finish to `constraintDate` when predecessor bounds allow (delay or pull start); milestones snap to that day. Backward pass caps **`lateFinish`** to the same day. **`SNLT`:** **`lateStart`** is capped to `constraintDate` (start no later than). **`MSO`:** Late start is pinned to `constraintDate` and late finish derived from duration. **`ALAP`:** After backward pass, early start/finish are set to late start/finish when `LS ≥ ES` so the task consumes slack toward the project end (MSP-style “as late as possible” display). Infeasible constraint mixes are not separately reported (only dependency cycles throw).

**Project calendar resolution:** if `Project.workCalendarId` is null, the server uses the **workspace default** calendar (`isDefault`) from a workspace linked to the project (deterministic pick by calendar name) for CPM input. New projects get that default assigned when created.

### Splits, contours, and CPM (Phase 4 — MVP)

**Product decision (4.1):** Full **solver-aware splits (S-01)** and **leveling that splits work (S-03)** are **not** in this release. Behavior is explicit and documented:

- **`scheduleSegments`:** Stored JSON for **Gantt display** and for **timephased** row shaping. The **CPM / recalculate engine** continues to use the task’s main **`startDate` / `dueDate`** (and duration/work modes) as the single scheduled interval. Users must keep segment spans consistent with those dates if they want matching bars and engine results.
- **`workContour`:** Affects **`GET …/projects/:projectId/schedule/timephased`** only. When `scheduleSegments` is non-empty and valid, timephased allocation follows **segment boundaries**; **`workContour` is ignored** in that case. Built-in shapes: **FLAT**, **FRONT_LOADED**, **BACK_LOADED**, **BELL** (triangular peak mid-span), **DOUBLE_PEAK** (two peaks along the span), **TURTLE** (U-shaped / low in the middle), **EARLY_PEAK**, **LATE_PEAK**.
- **`basis` query (`calendar` \| `working`, default `calendar`):** **`calendar`** uses UTC calendar-day slots along the task span (legacy). **`working`** uses the project **effective work calendar** (same resolution as CPM default calendar): each **local calendar day** from start→due gets **working minutes** from that calendar; contour weights multiply those minutes so **non-working days receive no work**. If the project has no resolvable calendar, the API falls back to **`calendar`** and echoes `basis: "calendar"` in the JSON.
- **Leveling:** Existing heuristic still shifts whole tasks; **`levelingCanSplit`** remains a future hook for S-03.

### EVM calculations (Phase 3)

- **BAC (per task):** `TaskBaseline.baselineCost` for the selected `baselineIndex` when positive; else estimated cost = fixed cost + per-use fees + labor (user standard/OT rates and generic hourly) from current task rows. **Labor OT:** `Task.overtimeWorkMinutes` is capped to total modeled user labor minutes and split across assignees by work share; each share uses `resourceOvertimeRatePerHour` when set, else standard rate.
- **Operating vs budget:** `Task.isBudgetTask` rows are excluded from the main `bac`/`pv`/`ev`/`ac`/`spi`/`cpi`/`eac` totals. When any budget task has positive BAC, the response includes a `budget` object with the same metrics for budget lines only. Per-task rows include `isBudgetTask` when true.
- **AC (per task):** `actualCost` if set; else sum of `TaskCostEntry.amount` when that sum is positive; else defaults to EV (unchanged legacy behavior).
- **EV:** Query `earnedValueBasis=PERCENT_COMPLETE` (default): `EV = BAC × percentComplete/100`. `WORK_VS_BASELINE`: `EV = BAC × min(1, performedWork / baselineWork)` with `performedWork = actualMin` when set, else `percentComplete/100 × (workMinutes ?? estimatedMin ?? baselineWork)`, using `TaskBaseline.baselineWorkMinutes` for the selected baseline index when present; falls back to percent basis if baseline work is missing.
- **PV (BCWS):** `BASELINE_DURATION_LINEAR` (default): uniform on **calendar** elapsed time between baseline start and finish. `WORK_SCHEDULE_LINEAR`: splits BAC using **current** labor vs non-labor cost shape (fixed + per-use vs hourly labor from assignees/generics). The **non-labor** share accrues on calendar time like the default; the **labor** share accrues by **working minutes** on the project `WorkCalendar` between those dates (falls back to calendar-linear if no calendar resolves). This diverges from pure elapsed-time PV when weekends/holidays sit in the baseline span.
- **Queries:** `GET …/schedule/evm?baselineIndex=0..10&earnedValueBasis=PERCENT_COMPLETE|WORK_VS_BASELINE&pvModel=BASELINE_DURATION_LINEAR|WORK_SCHEDULE_LINEAR&tasks=1|0`.

## ModelT / agent

Scheduling fields are additive. **`actorTier`**, **`agentContext`**, **`agentOutput`**, and agent APIs are unchanged; scheduled dates do not remove agent metadata.
