# Parity backlog: Asana / PM–agile leftovers, MS Project scope, Jira workflows

This document **collects open requirements** called out in [`asana-parity.md`](./asana-parity.md) and [`pm-views-agile-roadmap.md`](./pm-views-agile-roadmap.md), and **scopes** how far Vineroot might go toward **Microsoft Project**–class scheduling and **Jira**–class workflow engines (including **post-functions**). It does not replace those docs; it is the **single place for “still open” and “adjacent product”** intent.

**Constraints (from parity docs):** ModelT integration principles (stable IDs, `/api/v1/`, Socket events, first-class agent metadata) still apply. Anything below should be designed so it does not collapse or remove agent/task shapes.

---

## 1. Asana parity — consolidated leftovers

Items are grouped by domain. “Partial” rows in the main matrix imply additional polish unless called out here explicitly.

### 1.1 Search & discovery

| Item | Source | Notes |
|------|--------|--------|
| **Global advanced filters** on `GET /search` (assignee, project, section, dates, status, completion, tags combined) | [`asana-parity.md`](./asana-parity.md) roadmap #6, [global search depth](./asana-parity.md#global-search-parity-depth) | Distinct from **project saved views** (project-local). |
| **Cross-project presets** / workspace-level saved query presets | `asana-parity.md` #6 | May align with dashboards or “My work” rules later. |
| **Saved global searches** (named reports, not the same as saved views) | Search depth table | API + UI for persist + share TBD. |
| **Custom field value search** | Search depth table | Needs indexing / query strategy on `CustomFieldValue` JSON. |
| **Attachment name / content search** | Search depth table | Depends on storage metadata + optional FTS pipeline. |
| **Phrase / boolean query grammar** (quoted phrases, OR) | Search depth table | Today: whitespace tokens → AND; per-field substring. |
| **FTS-quality ranking** (stemming, typo tolerance) vs `ILIKE` | Search depth table | Product decision: Postgres FTS, external engine, or stay simple. |
| **More entity types in omnibox** (portfolios, goals, files as first-class hits) | Search depth table | Optional; matrix rows Portfolios/goals already Partial. |

### 1.2 Custom fields & formulas

| Item | Source | Notes |
|------|--------|--------|
| **Formula / computed fields** (expression, dependencies, cycle detection, read-only or materialized) | `asana-parity.md` depth + “Next feature expansion” | Schema + eval engine + invalidation on dependency change. |
| **Roll-up as custom field** (sum/count/min/max over subtasks) | Custom fields depth table | Alternative: keep roll-ups on epics/points APIs only. |
| **Attachment storage beyond env toggle** | `asana-parity.md` roadmap #1 | **S3 path exists:** `S3_BUCKET` + AWS creds → `S3AttachmentStorage` via `AttachmentStorageRouter`; local disk otherwise. **Leftover:** ModelT blob contract, cross-region, or mandated scanning beyond MIME/extension policy. |

### 1.3 Subtasks, dependencies, tasks

| Item | Source | Notes |
|------|--------|--------|
| **DnD polish:** insert-before index when dropping on sibling in another parent’s list | `asana-parity.md` next expansion | UX refinement. |
| **Keyboard reparent** | Same | Accessibility / power users. |
| **Dependencies:** deeper timeline / cross-project parity vs Asana | Matrix row Partial | Same-project deps today; multi-project + richer timeline behavior TBD. |

### 1.4 Forms (intake)

| Item | Source | Notes |
|------|--------|--------|
| **File upload** on public intake | `asana-parity.md` “Next up” | Security, virus scan policy, storage adapter. |
| **CAPTCHA / bot mitigation** | Same | Public `/i/:token` surface. |
| **Rate limits** on public submit | Same | Abuse prevention. |

### 1.5 Integrations

| Item | Source | Notes |
|------|--------|--------|
| **Outbound webhook retries + delivery log** | `asana-parity.md` next expansion | Reliability vs fire-and-forget today. |
| **Slack OAuth app** (vs incoming webhook URL only) | Same | Install flow, channel pick, richer actions. |

### 1.6 Org, My work, Inbox, Portfolios, Automations, Comments, Activity (matrix “Partial”)

These remain **broad buckets** until broken into own depth tables:

- **Org & access:** guests, finer-grained permissions than project roles + JWT.
- **My work:** rules like “recently assigned”, smart sections vs flat My tasks.
- **Inbox:** triage depth (grouping, snooze, bulk actions) TBD.
- **Portfolios & goals:** cross-project health, dashboard wiring beyond partial widgets.
- **Automations:** rule bundles, parity with Asana’s breadth of triggers/actions (beyond current automations + POST_WEBHOOK / SLACK_NOTIFY).
- **Comments / Activity:** filters on unified story, richer notification semantics.

---

## 2. PM views & agile roadmap — consolidated leftovers

| Item | Source | Notes |
|------|--------|--------|
| **Epic dashboard depth** | `asana-parity.md` #9, `pm-views-agile-roadmap.md` Phase D | **Epics** project tab + `ProjectEpicDashboardView` shipped. **Leftover:** richer metrics, child table, risks, links — product definition. |
| **WIP limits / Kanban policies** per section/column | PM doc gaps + Phase D TBD | Enforcement on move/create; optional override roles. |
| **Portfolio sprint widgets** / cross-project sprint health | PM doc gaps + Phase C TBD | Dashboards exist but not fully wired to sprint metrics portfolio-wide. |
| **Richer dashboard suite** | PM doc suggested order #5 | More widgets, layout, drill-down. |
| **Portfolio roll-ups** (program view) | PM doc Phase C | Align with Portfolio model + APIs. |
| **Timeline → Schedule (Gantt) naming** or **Gantt tab alias** | PM doc Phase A #5 | Product-only. |
| **Structured acceptance criteria** checklist on stories | PM doc §1 user stories | Optional `Task` JSON or child table. |
| **`methodologyPreference` or feature flags** (Scrum vs Kanban emphasis) | PM doc §4 | Coexistence already de facto; formalize settings later. |
| **Burndown API `from` / `to`** window params | PM doc Phase B | Convenience for reporting exports. |
| **SAFe-style program layers** | PM doc explicit non-goals | Deferred until epic/sprint/portfolio depth is stable. |

---

## 3. Microsoft Project parity — scope tiers

The PM roadmap lists **full MS Project parity** as a **non-goal near term**. This section **scopes** what that would mean if Vineroot ever pursued it in **phases**, without committing to delivery.

**Implementation status (2026-04):** calendars, server CPM (including **merged program CPM** when the focal project is in a schedule program), baselines **0–10**, leveling/overallocation APIs (including **program scope** and **day/week** buckets), EVM (**`baselineIndex`**, budget tasks, OT, cost ledger, PV/EV modes), schedule programs, cross-project dependencies, and timeline/network **server critical path** + **driving edges** are shipped — see [`ms-project-parity.md`](./ms-project-parity.md) for decisions and API map.

**Phase 5 deepen (traceability):** URL-synced timephased query params, saved views for **timephased** / **network**, list-row schedule chips from server CPM, and network edge tooltips are catalogued with IDs **D-01–D-10** and optional hardening **T-01–T-05** in [`ms-project-full-parity-implementation-plan.md`](./ms-project-full-parity-implementation-plan.md) §9.

### 3.5 MS Project gap IDs — backlog truth (sync with full plan)

Do **not** duplicate shipped work in Jira. The master **ID → Shipped / Partial / Open** table is **[`ms-project-full-parity-implementation-plan.md`](./ms-project-full-parity-implementation-plan.md) §2.1**. Update this subsection only when that table changes.

| Bucket | IDs (see §2.1 for detail) |
|--------|---------------------------|
| **Shipped** | **E-01, E-02, E-03, E-05, E-08**, **R-01, R-02, R-04**, **C-01–C-05**, **S-02**, **V-04** |
| **Partial** | **E-04, E-06**, **R-03**, **V-01, V-02, V-03**, **F-02** |
| **Open / deferred** | **E-07**, **R-05**, **S-01, S-03**, **F-01** |

### 3.1 Already adjacent in Vineroot

- Bar schedule (**Timeline**), **dependencies** (FS-style graph), **critical path**, **milestones**, **WBS** indentation, **workload** grid by assignee × week, **multi-zoom** timeline.

### 3.2 “MSP-light” (common enterprise asks)

| Area | Typical MSP capability | Vineroot direction sketch |
|------|------------------------|---------------------------|
| **Calendars** | Project calendar + exceptions, resource calendars | `WorkCalendar` per workspace/project; exceptions; optional resource calendar |
| **Effort vs duration** | Work, duration, units (% allocation) | Extend `Task` with `workHours` / `durationDays` / fixed-work vs fixed-duration mode |
| **Resource leveling** | Delay/split tasks to resolve overallocations | Heuristic post-process on dated tasks + assignee capacity; UI “level now” |
| **Baseline** | Baseline start/finish/work vs actual | `TaskBaseline` snapshot rows (**0–10** indices) + variance / EVM vs selected baseline |
| **Constraint types** | ASAP, ALAP, SNET, SNLT, MSO, MFO | Enum on task schedule; solver respects when computing dates |
| **Lag / lead on dependencies** | Dependency offset days | `TaskDependency.lagDays` (positive lag, negative lead) |

### 3.3 “MSP-deep” (heavy investment)

- **Cost** fields, rate tables, **EVM** (SPI/CPI), **multiple projects** master program with shared resource pool.
- **10 baselines**, detailed **split** tasks, **recurring** schedule patterns beyond task recurrence.
- **Server-side scheduling engine** (CPM with calendars) vs client-side SVG layout only.

### 3.4 Explicit exclusions (unless product strategy changes)

- Full **desktop MSP file** import/export fidelity.
- **Enterprise resource pool** across thousands of named resources with HR integration.

---

## 4. Jira parity — scope with emphasis on workflows & post-functions

Jira’s differentiator is **per-project (or global) workflows**: **states**, **transitions**, **validators**, **conditions**, and **post-functions** that mutate issues, fields, links, or call externals **after** a transition commits.

### 4.1 What Vineroot has today (rough mapping)

| Jira concept | Vineroot analog | Gap |
|--------------|-----------------|-----|
| Workflow **states** | `TaskStatus` enum + status machine in task service | Fewer states; transitions enforced in code, not data-driven per project |
| **Transition triggers** | Automations (task events) + outbound webhooks | Not the same graph as Jira “transition”; no transition-scoped UI |
| **Post-functions** | Automation **actions** (e.g. webhook, Slack) | No ordered chain on a single transition; limited action set |
| **Validators / conditions** | Guards in Nest + `reviewGate` / business rules | Not user-authored per transition |

### 4.2 Jira-style workflow engine — component model (scope)

If Vineroot ever builds **Jira-like workflows**, a minimal **engine** would include:

1. **Workflow definition** (per project or workspace template): DAG of **status nodes** and **transition edges**; only some transitions legal from a given status.
2. **Transition instance**: user or automation picks **transition id** (not only “set status”); server runs **conditions** → **validators** → persists → **post-functions** in order.
3. **Post-function types** (illustrative scope):
   - **Field set** (system + custom fields, including assignee, sprint, dates).
   - **Copy field from parent / linked task**.
   - **Create subtask** or **linked task** from template.
   - **Add comment** (system or user).
   - **Fire webhook / automation event** (reuse `WorkspaceOutboundWebhook` envelope).
   - **Reindex / notify** (Socket + notifications) — already implicit; would become explicit steps.

4. **Safety:** transactional boundary (all post-functions succeed or compensating rollback / dead-letter); **idempotency** keys for webhooks; **max depth** for chained mutations.

### 4.3 “Complex post-functions” (the hard part)

| Pattern | Why it’s hard | Scope note |
|---------|----------------|------------|
| **Arbitrary scripting** (Groovy/scripts) | Tenancy security, audit, replay | **Non-goal** unless sandboxed DSL with static analysis |
| **Deep Jira plugin graph** (Java classes per function) | Ops + versioning | Prefer **declarative** JSON workflow + small allowlisted function registry |
| **Cross-issue bulk updates** | Race conditions | Separate **bulk transition** job with progress + partial failure report |
| **Integration post-functions** (Jira → external → mutate Jira) | Distributed transactions | **At-most-once** webhook + **reconciliation** job; avoid two-phase commit |

### 4.4 Pragmatic middle ground (backlog framing)

- **Phase A:** Data-driven **allowed transitions** per project (still map to existing `TaskStatus` or expand enum via DB).
- **Phase B:** **Transition-scoped automation** list (reuse automation model but bind to `transitionId` and run after commit).
- **Phase C:** **Ordered post-functions** with allowlisted types; admin UI; versioning of workflow schema.

This stays **below** full Jira ScriptRunner parity but addresses “**complex post-functions**” in a controlled way.

---

## 5. How to use this doc

- **Planning:** Pull items into a release theme; link PRs to subsection IDs informally.
- **Triaging:** If something ships, remove or mark it in [`asana-parity.md`](./asana-parity.md) / [`pm-views-agile-roadmap.md`](./pm-views-agile-roadmap.md) and trim this file so it stays **leftovers + adjacent scope** only.
- **Non-goals:** MS Project **deep** tiers and Jira **arbitrary scripting** remain **out of scope** unless product explicitly promotes them from this document.

---

## References

- [`asana-parity.md`](./asana-parity.md) — matrix, roadmap order, search/CF depth, changelog.
- [`pm-views-agile-roadmap.md`](./pm-views-agile-roadmap.md) — phases A–D, charts, epic/backlog/sprint UI, explicit non-goals.
- [`ms-project-full-parity-implementation-plan.md`](./ms-project-full-parity-implementation-plan.md) — **§2.1** ID reconciliation (shipped vs open), **§3** historical gap text, **§9** Phase 5 deepen IDs.
- [`ms-project-parity.md`](./ms-project-parity.md) — product decisions, API map, EVM and split/contour behavior.
