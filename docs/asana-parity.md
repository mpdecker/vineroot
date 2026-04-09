# Asana parity matrix & roadmap (Vineroot)

Vineroot targets **baseline work-management parity** with Asana-style products while keeping **agent / ModelT PM** as the differentiated lane. This doc is the working matrix and **implementation order**; it should stay aligned with integration into the **larger ModelT** program (shared auth, task/project identity, events, and optional embedding of this UI).

## ModelT integration principles

- **Stable resource IDs**: Tasks, projects, and workspaces use opaque IDs suitable for cross-system references (ModelT orchestration, crew tools, audit).
- **Event surface**: Prefer existing Socket/REST patterns (`task:updated`, `task:created`, …) so ModelT gateways can subscribe without bespoke glue.
- **Agent metadata**: `actorTier`, `agentContext`, `agentOutput`, PM Supabase flows remain **first-class**; parity work must not remove or collapse these shapes—only extend human PM features beside them.
- **API versioning**: Public routes stay under `/api/v1/` for a single contract ModelT and other clients can target.
- **Future**: Document any breaking DTO changes here and in release notes; consider a thin **BFF** if ModelT requires different aggregation than the SPA.

## Parity matrix

| Domain | Asana (reference) | Vineroot | Status |
|--------|-------------------|----------|--------|
| Org & access | Workspaces, teams, guests, granular permissions | Workspaces, teams, project roles, JWT | Partial |
| Projects | Templates, duplication, status, privacy | Projects, sections, multi-workspace link, archive; **project templates** (`isTemplate`, hidden from default lists); **duplicate project** (sections, tasks tree, custom-field links) | Partial |
| Task core | Rich description, mentions, recurring | Title, description, multi-assignee, dates, priority, status, **agent fields**; **recurrence** (RRULE subset: daily/weekly/monthly, spawn on DONE); **task templates** | Partial + **Extra** |
| Subtasks | Deep tree, assignees per subtask, list/board visibility | Nested list/board, DnD (sibling reorder, reparent onto task / subtask drop zone, **promote to column root**), expand/collapse, **roots-only** toggle; depth/cycle validated on API; create/edit still task detail | Partial |
| Dependencies | Timeline integration, cycle safety | Same-project deps, detail UI | Partial |
| Custom fields | Per-project enablement, formulas | Project-linked fields only on `setValue`; **type/required validation**; **block DONE** if required empty; values on **list/board** cards/rows; detail UI — **[depth →](#custom-fields-and-formulas-parity-depth)** | Improving |
| Attachments | Upload, preview, versioning | Local **or S3** uploads when **`S3_BUCKET`** (and related AWS env) is set — `AttachmentStorageRouter` / `S3AttachmentStorage`; otherwise **`UPLOAD_ROOT`** disk. Same policy hooks: blocked exts/MIMEs; storage delete on remove; optional **`ATTACHMENT_UPLOAD_NOTIFY_URL`**; **`ATTACHMENT_RETENTION_DAYS`** purge; `ATTACHMENT_ALLOW_EXECUTABLES=1` | Improving |
| Comments | Threads, @mentions | **Threaded** replies (`parentCommentId`); **`@mentions`** + `CommentMention`; notifications for mentions; task detail thread UI | Partial |
| Activity | Unified story, filters | `ActivityLog` (human story) + **project activity** API & tab; task detail **merged activity + audit** timeline; broader task logs (create, reparent, recurrence, template, duplicate, agent fields, time) | Improving |
| Views | List, Board, Timeline, Calendar, Workload | List, Board, **Backlog**, **Roadmap** (epics), **Sprint** board tab, Timeline, Calendar, **Workload** | Partial |
| PM charts | Gantt-style schedule, burndown, velocity, cumulative flow | Timeline: **dependency edges** (SVG); **Burndown** tab: burndown + burnup + velocity; **daily sprint metric snapshots** when tasks change; **Flow** tab + **`PROJECT_CFD`** dashboard widget (`GET …/cfd`); CFD series from **`ProjectCfdSnapshot`** — [`pm-views-agile-roadmap.md`](./pm-views-agile-roadmap.md) | Partial |
| Agile structures | Epics, sprints, stories, points, backlogs | **`Sprint`** + **`sprintId`**; **`workItemType`** / **`storyPoints`**; **`epicTaskId`** + task detail picker; **sprint** + **epic** filters; **`GET …/epic-rollups`** + roll-up hints; **Roadmap** tab; **Epics** project view (`ProjectEpicDashboardView`) for epic-focused panel (metrics / drill-down polish still TBD); timeline **WBS** + **critical path** + **`isMilestone`** | Partial |
| My work | Rules for “Recently assigned”, etc. | My tasks | Partial |
| Search | Global, advanced | **`GET /search`** tasks (title/description/**comments**, multi-word AND), projects, **sections**, **tags**; web **⌘/Ctrl+K** modal with keyboard nav + highlight — **[depth →](#global-search-parity-depth)** | Partial |
| Inbox | Triage | Inbox page | Partial |
| Portfolios & goals | Cross-project health | Portfolios, goals, dashboards | Partial |
| Automations | Rules, bundles | Automations + **POST_WEBHOOK** / **SLACK_NOTIFY** actions | Partial |
| Forms | Intake | **Project intake form:** builder (`/projects/:id/form`); **published public link** `/i/:token` (no login); submissions create tasks in chosen section; field types short/long text, email, number, dropdown, **checkbox, date, URL**, **section headings**; per-field **help text**, **max length**, number **min/max**; title from short text, email, or URL | Partial |
| Integrations | Slack, webhooks, API | REST + Socket; **workspace Slack** (incoming webhook URL, admin-only); **signed outbound webhooks** (`WorkspaceOutboundWebhook`, event filter); automations **POST_WEBHOOK** / **SLACK_NOTIFY** | Partial |

### Global search parity depth

Reference product behavior is summarized as **global** (fast omnibox) vs **advanced** (structured filters, saved queries, field-aware search). Vineroot today is strong on global text discovery over visible entities; advanced query surfaces are largely **not** merged into `GET /search`.

| Sub-capability | Asana-style reference | Vineroot today | Gap / notes |
|----------------|----------------------|----------------|-------------|
| Omnibox / quick open | Global find for tasks & nav | **`GET /api/v1/search`** + web **GlobalSearchModal** (**⌘/Ctrl+K**); optional **`workspaceId`** narrows to linked projects | — |
| Entities returned | Tasks, projects, (+ product-specific types) | **Tasks**, **projects**, **sections**, **tags** | No portfolios, goals, messages, files as first-class hit types |
| Task text coverage | Title, description, comments, often attachments | Title + description **substring** (`contains`, case-insensitive); **comments** (body) for visible tasks only | No attachment **name** or **content** search |
| Query semantics | Product-specific; often AND across tokens | **Whitespace tokens → AND**: each token must appear in title **or** description (per-token OR); same AND pattern for projects, sections, tags, comments | No quoted **phrase-only** match, no explicit **OR** / boolean grammar |
| Ranking / snippets | Relevance + context | **Rank**: title phrase → title token overlap → description → comment-derived hits lower; **snippet** on comment-driven hits (`SearchService`) | Not full-text-search (no stemming/typo tolerance); `ILIKE`-style |
| Access & scope | Respects membership, workspace/org | Tasks: assignee **or** accessible non-template project **or** creator’s unprojected task; projects: creator/member, not deleted, not template; workspace filter when passed | Templates & deleted tasks excluded; no “include archived” toggle on search API |
| Advanced filters | Assignee, project, section, dates, status, CFs, completion | **Not on `/search`**. **Project saved views** persist sprint/epic/roots-only/surface/workload params — **project-local**, not a global advanced-search builder | Roadmap item: richer **global** advanced filters / cross-project presets (see matrix roadmap #6) |
| Custom field value search | Often available in advanced search | **Not implemented** | Would need JSON containment / indexed CF columns or FTS |
| Saved global searches | Named saved reports | **Not implemented** | Saved views ≠ saved omnibox query |
| API surface | Rich filter params | **`q`**, optional **`workspaceId`**, **`limit`** (`search.controller.ts`) | Extend when advanced filters ship |

### Custom fields and formulas parity depth

| Sub-capability | Asana-style reference | Vineroot today | Gap / notes |
|----------------|----------------------|----------------|-------------|
| Definition model | Workspace (or org) library | **`CustomFieldDefinition`** per **workspace**; types in **`CustomFieldType`** | — |
| Project enablement | Add field to project | **`ProjectCustomField`**; **`setValue`** rejects unlinked fields for project tasks | — |
| Value storage | Per task | **`CustomFieldValue`** (`value` **Json**); upsert in **`CustomFieldService.setValue`** | — |
| Types | Text, number, enum, people, date, formulas, … | **TEXT, NUMBER, DATE, DROPDOWN, CHECKBOX, MULTI_SELECT, PERSON, URL** (`shared-types`) | No **FORMULA** (or rollup-only) type |
| Validation | Type + required + options | **`validateCustomFieldPayload`**; **required** enforced; **cannot DONE** with empty required CF | — |
| Surfacing in views | List/board columns, cards | Values on **list/board** (**TaskRow** / **TaskCard**) + task detail when project loads defs | — |
| **Formulas** | Expression referencing other fields / roll-ups | **Not implemented** — no `formula` on definition, no eval engine, no read-only computed values | Requires schema (`formula` / `computedKind`), cycle detection, eval on read or materialize on dependency change |
| Roll-up columns | Sum/count/min/max over subtasks | **Not as custom fields**; agile **story points** / **epic roll-ups** are separate first-class paths | Could later map roll-ups to formula or dedicated roll-up CF type |
| CF-aware search | Advanced search by field | **Not implemented** | Depends on global advanced search + indexing strategy |

## Roadmap order (do roughly in this sequence)

1. **File attachments** — Upload + list + delete + **authenticated download**; **S3 path shipped (opt-in):** set **`S3_BUCKET`** + credentials so new uploads use **`S3AttachmentStorage`**; retention/delete routes through **`AttachmentStorageRouter`**. **Remaining:** ModelT-specific blob contract, multi-region/DR, or stronger scan pipeline if product requires it beyond current policy.
2. **Project-scoped custom fields** — Only fields linked via `ProjectCustomField` appear on project tasks; API to list/add links.
3. **Richer activity** — **Shipped (2026-04):** expanded `ActivityLog` on PATCH (reparent, recurrence, template, estimates, actor tier/domain/complexity/review gate/phase/parallel group); task create + recurring follow-up + duplicate + project duplicate; `GET /projects/:id/activity-logs`; web **Activity** project tab + merged task story.
4. ~~**Subtasks on list/board**~~ — **Shipped (2026-04):** nested list/board; sibling reorder; reparent (nest under another task / another parent’s subtask list); promote to root via column drop; API `PATCH` + batch reorder accept `parentTaskId`; max depth + cycle checks; **roots-only** checkbox (sessionStorage per project).
5. **Recurring tasks & templates** — **Shipped (2026-04):** `Task.recurrenceRule` / `recurrenceUntil` / `isTemplate`; `Project.isTemplate`; complete recurring task → next instance; `POST /tasks/:id/duplicate`, `POST .../projects/:id/duplicate`; list/board exclude templates; `includeTemplates` on workspace project list. UI: Task detail repeat + template + duplicate; project header duplicate.
6. **Global search & saved views** — **Shipped (2026-04):** workspace-aware **`GET /search`** + web command palette (**⌘/Ctrl+K**); comment + section + tag hits, multi-token AND, snippets/highlighting. **Project saved views:** persist sprint/epic/roots-only and **tab surface** (list, board, backlog, workload + optional workload query params). **Still TBD:** richer global “advanced filters” beyond saved views, cross-project presets.
7. **Comment threads & @mentions** — **Shipped (2026-04):** reply threads, mention extraction/storage, notification fan-out, task detail UI (see migration `20260405193000_comment_threads_mentions`).
8. **Workload** — **Shipped (2026-04):** **Workload** project tab; assignee × week grid; composes with sprint/epic filters and saved-view apply.
9. **PM views & agile methodology** — **Shipped (2026-04, see [`pm-views-agile-roadmap.md`](./pm-views-agile-roadmap.md)):** sprint + epic filters; **Backlog** / **Sprint board** / **Roadmap** tabs; **`Task.epicTaskId`** + roll-ups; Burndown / velocity / **`ProjectCfdSnapshot`** / **Flow** / timeline WBS + critical path + milestones. **Epic dashboard:** **Epics** tab + **`ProjectEpicDashboardView`** shipped as the epic panel; **Still TBD:** richer metrics, child tables, risks — see [`parity-backlog-msp-jira-scope.md`](./parity-backlog-msp-jira-scope.md) §2. **Also TBD:** backlog stack-rank beyond section order, richer burnup narrative.

**Explicit non-goals for parity cloning:** pixel-perfect UI parity, proofing/PDF studio, native mobile apps (unless PWA).

### Next feature expansion (recommended)

Prioritize in short horizons:

1. ~~**Close the subtask gap (incremental)**~~ — **Done:** reparent + promote + roots-only (see changelog). Optional polish: insert-before index when dropping on a sibling in another parent’s list, keyboard reparent.
2. ~~**Roadmap #1–2 hardening**~~ — **Done (2026-04):** attachment policy + notify URL + retention cron + delete via storage router (local **or** S3 when configured); custom-field validation, project gate, required-before-DONE, list/board chips. **Remaining:** formula fields, optional AV/scan integration beyond MIME/extension policy.
3. ~~**Roadmap #5**~~ — **Done:** recurring tasks + templates + duplicate (see changelog).
4. ~~**Roadmap #3**~~ — **Done:** activity/story expansion + project feed + merged audit (see changelog).

Next up: deepen **Forms** (file upload on intake, CAPTCHA, rate limits); **#6** saved-view polish; **#9** polish (epic dashboard depth, stack rank). Hardening: custom-field formulas; attachment **deepening** only if ModelT blob or scanning exceeds current S3/local router. **Integrations:** outbound webhook retries / delivery log; Slack OAuth app (vs incoming webhook only).

## Changelog (high level)

| When | Note |
|------|------|
| 2026-04 | Parity doc added; project custom fields + upload pipeline started per roadmap #1–2. |
| 2026-04 | `GET/POST /projects/:id/custom-fields`, `POST /tasks/:id/attachments/upload`, task `PATCH` activity for human-visible fields; TaskDetail uses project field set + file upload. |
| 2026-04 | Assignee add/remove → `ActivityLog` + `task:updated` socket; link vs uploaded attachment open in UI (blob + JWT). Attachment add/remove, dependency add/remove, and file upload completion emit `task:updated` for subscribers. |
| 2026-04 | **Subtasks on list/board + reparent:** nested list/board (API include + UI); DnD sibling reorder, nest under another task, `subtasks:{parent}` for another parent’s list, column drop to **promote** to root; `PATCH` / batch reorder `parentTaskId` with cycle + max-depth validation; optimistic `sectionId` cascade; **Roots only** toggle (sessionStorage per project); tests for tree, reorder, DnD, API reorder. |
| 2026-04 | **Attachments + custom fields hardening:** upload blocked types/MIMEs; rollback file if DB insert fails; `removeLocalStoredFile` on delete; `ATTACHMENT_UPLOAD_NOTIFY_URL` (JSON POST), `ATTACHMENT_RETENTION_DAYS` + daily job, `ATTACHMENT_ALLOW_EXECUTABLES`; `setValue` requires `ProjectCustomField` link + validates payloads; **cannot mark DONE** with empty required fields; project + task detail loads **customFieldValues** on nested tasks; list/board shows field chips. |
| 2026-04 | **Recurring tasks & templates:** Prisma `Task.recurrenceRule`, `recurrenceUntil`, `isTemplate`; `Project.isTemplate`; on **DONE**, strip recurrence from completed row and create follow-up with shifted dates (RRULE subset: `FREQ=DAILY`, `WEEKLY`, or `MONTHLY`, optional `BYDAY`); template tasks excluded from list/board counts and section payloads; `GET .../projects?includeTemplates=true`; `POST /api/v1/tasks/:id/duplicate`, `POST /api/v1/workspaces/:ws/projects/:id/duplicate`; web Task detail + project header actions. |
| 2026-04 | **Activity / story (roadmap #3):** `TaskActivityLog` logs reparent, recurrence & template toggles, estimates, agent metadata fields; `TASK_CREATED` on every task create (and duplicate); recurring completion + follow-up rows; project duplicate writes project-scoped row (`taskId` null). **`GET /api/v1/projects/:projectId/activity-logs?take=`** with actor + task title. Web: project **Activity** view, task detail **Activity & audit** merged timeline (120 human rows + audit API), cache invalidation hooks. |
| 2026-04 | **Global search (roadmap #6 v1):** **`GET /api/v1/search?q=&workspaceId?&limit=`** — tasks (title/description, assignee or accessible project or creator’s unprojected) and projects (name/description, creator/member; optional workspace link). Web: **GlobalSearchModal** from top bar + **⌘/Ctrl+K**; scopes to **current workspace** when one is selected. |
| 2026-04 | **Search deepen (#6):** same endpoint returns **sections** and **tags**; tasks match **comment bodies** (visible tasks only); **multi-word queries** require every token to match (title/description/comment per task; name/description per project; section/tag names). Task hits include `sectionName`, `matchKind`, optional `snippet`. Web: **Sections** / **Tags** groups, **↑↓ Enter** navigation, query **highlighting**. |
| 2026-04 | **PM views & agile roadmap:** new doc [`pm-views-agile-roadmap.md`](./pm-views-agile-roadmap.md) — Gantt-style timeline evolution, burndown/velocity/CFD, epics/sprints/stories/points mapped onto current `Task`/`Section`/custom fields; parity matrix + roadmap **#9** updated. |
| 2026-04 | **Agile / sprint foundation (#9):** Prisma **`Sprint`**, **`Task.workItemType`**, **`storyPoints`**, **`sprintId`**; API `GET/POST/PATCH/DELETE …/projects/:id/sprints`; project payload includes **`sprints`**; task create/update/duplicate/recurrence copy; **Timeline** draws **dependency** curves when both tasks have bars. Web: task **Planning** (type, points, sprint + create sprint). Migration `20260407120000_sprints_work_items`. |
| 2026-04 | **Sprint scope + burndown MVP (#9):** Project header **sprint filter** (All / Backlog / sprint) for list, board, timeline, calendar, workload (persisted per project in sessionStorage); **Burndown** tab + route `projects/:projectId/burndown`; **`GET /api/v1/projects/:projectId/sprints/:sprintId/burndown`** (ideal + remaining series; prefers **`SprintMetricSnapshot`** per day when rows exist). List/board **TaskRow** / **TaskCard** chips: work item type, story points, sprint name. |
| 2026-04 | **Sprint velocity (MVP):** **`GET /api/v1/projects/:projectId/sprints/velocity?take=`** — last N sprints by `endDate`, **completedPoints** = sum of `storyPoints` for **DONE** tasks completed within each sprint’s calendar window; **averageCompletedPoints** across those sprints. Web: velocity bar chart + average on **Burndown** page. |
| 2026-04 | **Sprint burnup + epic filter:** **`GET /api/v1/projects/:projectId/sprints/:sprintId/burnup`** — per-day **completedCumulative** (DONE completions from sprint start through that day) + flat **scopeTotal**; Burndown page **Burnup** chart. **Epic** header filter (`workItemType` **EPIC** tasks + descendant tree); composed with sprint filter; `vineroot:project:*:epicFilter` sessionStorage. |
| 2026-04 | **Comment threads & @mentions (#7):** `Comment.parentCommentId`, **`CommentMention`**; API + CommentService (access, mentions, notify, socket); task detail threaded UI + @mention picker; migration `20260405193000_comment_threads_mentions`. |
| 2026-04 | **Project saved views (#6):** `ProjectSavedView` + CRUD; config JSON (sprint/epic/roots-only, optional `surface` list/board/**backlog**/workload + workload weeks/from); web **Filter** modal on project header; apply restores filters and navigates. |
| 2026-04 | **Workload (#8):** **`GET /api/v1/projects/:projectId/workload`** (`weeks`, `from`, optional `sprintFilter` / `epicFilter`) + **Workload** project tab; assignee × week buckets. |
| 2026-04 | **Dedicated Backlog tab (#9 / Phase D):** route `projects/:projectId/backlog`; **Backlog** nav tab; list view with **forced** backlog sprint scope (`sprintId` null) without overwriting List tab’s stored sprint filter; epic + roots-only; saved view surface **`backlog`**. |
| 2026-04 | **Dedicated Sprint board tab (#9 / Phase D):** route `projects/:projectId/sprint-board`; **Sprint** nav tab; **ProjectBoardView** with sprint filter resolved to ACTIVE → PLANNED → closed default when stored filter is All/Backlog; sprint dropdown **sprint-only** (no All/Backlog); epic + roots-only; saved view surface **`sprint-board`** (`pickDefaultSprintId`). |
| 2026-04 | **PM views & agile (#9 close):** Prisma **`Task.epicTaskId`** (optional FK to epic task); API + duplicate/remap; epic rollups + subtree include linked work; **Roadmap** tab + saved view **`roadmap`**; timeline **critical path** toggle (`timelineCriticalPath.ts`); task detail **Epic** link selector. |
| 2026-04 | **PM roadmap follow-up:** **`Task.backlogRank`** + Backlog tab sort; burnup **`scopeChanges`** / **`initialScope`** + UI narrative; epic **focus** strip in project header when filtered. |
| 2026-04 | **Forms / intake:** `ProjectIntakeForm` (one per project); **`GET/PUT …/projects/:id/intake-form`**, **`POST …/publish`**, **`POST …/unpublish`**; public **`GET/POST /api/v1/public/intake-forms/:token`** (+ `/submit`); web builder + **`/i/:token`** public page; migration `20260412120000_project_intake_form`. |
| 2026-04 | **Integrations (parity):** `Workspace.slackIncomingWebhookUrl` + `PATCH /workspaces/:id` (owner/admin); **`WorkspaceOutboundWebhook`** + CRUD **`/workspaces/:workspaceId/outbound-webhooks`** (admin); signed **`POST`** (`X-Vineroot-Signature`, `X-Vineroot-Event`, `X-Vineroot-Delivery`); task pipeline mirrors automation triggers; automation actions **`POST_WEBHOOK`**, **`SLACK_NOTIFY`**; web **Integrations** + **Automations** UI; optional **`APP_PUBLIC_URL`** for `{link}` in Slack templates. Migration `20260416120000_outbound_webhooks_slack`. |
| 2026-04 | **Doc sync:** matrix + roadmap updated for **opt-in S3** attachment storage (`S3_BUCKET`) and **Epics** tab / epic dashboard view; backlog cross-refs in [`parity-backlog-msp-jira-scope.md`](./parity-backlog-msp-jira-scope.md). |
