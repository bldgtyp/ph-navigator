---
DATE: 2026-05-12
TIME: 10:30 EDT
STATUS: Active implementation roadmap. Update as slices land.
AUTHOR: Ed May (with Codex)
SCOPE: Vertical-slice implementation plan for PH-Navigator V2 MVP.
RELATED: context/README.md, context/PRD.md, context/TECH_STACK.md,
         context/ENVIRONMENT.md, context/USER_STORIES.md,
         context/technical-requirements/,
         docs/plans/2026-05-13/phase-1-full-buildout-plan.md
---

# PH-Navigator V2 - Implementation Roadmap

## Purpose

Use this as the active execution tracker for PH-Navigator V2. The PRD
and technical requirements remain the source of truth for product and
architecture. This file sequences the work into thin tracer-bullet
slices that can be built, tested, and verified in the browser.

The Phase 1 tracer bullets have a separate close-out / full-buildout
planning artifact:
`docs/plans/2026-05-13/phase-1-full-buildout-plan.md`. Keep TB-00
through TB-06 below as historical tracer evidence, then add accepted
Phase 1 full-buildout slices here as they are scheduled.

## How To Use This Plan

- Keep each slice vertical: schema -> backend -> API -> UI -> tests ->
  browser verification -> lesson log.
- Prefer AFK slices. Mark HITL only when a human decision, credential,
  design review, or external setup action is required.
- Do not create a separate testing phase. Each slice carries its own
  test and verification scope.
- Do not create pure setup slices. Environment and tooling work lands
  only when needed to make a visible slice work end-to-end.
- If a slice looks larger than one focused day, split it before starting.
- When a slice lands, update its checkbox, verification notes, and the
  Lessons Learned section at the bottom of this file.
- Each slice's `References` row lists the load-bearing context docs for
  that slice. Read those before starting; the frontmatter `RELATED:` list
  covers always-useful docs (PRD, TECH_STACK, ENVIRONMENT, USER_STORIES).
- From TB-02 onward, the browser-check happy path must also pass on
  staging, not only on local dev.

## Verification Budget

Use the smallest useful verification set for each slice.

Backend:
- Formatting/linting: black, isort, ruff.
- Tests: pytest for domain rules, document validation, repository
  contracts, save/version behavior, access checks, and non-trivial API
  routes.
- Avoid broad API tests for pass-through CRUD unless the route enforces
  meaningful workflow rules.

Frontend:
- Formatting: Prettier.
- Tests: targeted Vitest for unit conversion, complex state machines,
  table paste/coercion, or non-trivial reducers/stores.
- Browser verification: Playwright MCP for every user-visible slice.
- Avoid snapshot-heavy UI testing and broad component tests for simple
  presentational glue.

End-to-end:
- One browser happy path per slice is usually enough.
- Add negative-path browser checks only for important user-facing
  boundaries: public read-only mode, locked versions, stale drafts,
  auth write rejection, and MCP/browser edit lease.

## Decision Queue

Resolve these at the named slice, not all up front:

| Decision | Needed by | Current lean |
|---|---|---|
| Repo split: one repo or two | TB-00 | One repo for MVP scaffold: `backend/` + `frontend/` in this checkout |
| Generated OpenAPI/TS client in CI from day 1 | TB-02 or TB-04 | Lean yes, keep client thin |
| V2 staging URL | TB-02 | Render staging is live: frontend `https://ph-navigator-v2-staging.onrender.com`, API `https://ph-navigator-v2.onrender.com`; custom domain post-MVP |
| `ProjectDocumentV1` schema evolution policy | TB-04 | Saved/locked versions immutable; drafts may up-migrate on schema bump; `schema_version` is the explicit signal |
| MCP transport | TB-04b | Streamable HTTP at `/mcp` plus stdio via `PHN_MCP_TOKEN`; legacy SSE deferred unless a concrete client requires it |
| Project version name uniqueness | TB-05 | Enforce unique per project |
| Diff UI scope | TB-05 | Structured text summary in v1 |
| Draft GC threshold and warning timing | TB-05 | 30-day GC; warnings can tune later |
| Multi-editor concurrency scope | TB-06 | MVP supports single-active-editor per project; Rooms same-editor tabs use table-slice broadcast with row-scoped freeze for overlapping active edits; generalized cross-table/cross-editor conflict UX deferred to v1.1 |
| HBJSON file-size cap | TB-14 | Start with 50 MB unless real files exceed it |

## Phase 1 Full Build-Out

Accepted plan:
`docs/plans/2026-05-13/phase-1-full-buildout-plan.md`.

These slices close out the Phase 1 tracer-bullet debt before Phase 2
catalog/builder work begins. TB-00 through TB-06 remain below as the
historical tracer-bullet ledger and evidence trail.

### P1-00 - Phase 1 Baseline And Gap Matrix

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Establish the current Phase 1 gap matrix before changing code. |
| References | `docs/plans/2026-05-13/phase-1-full-buildout-plan.md`; `docs/plans/2026-05-13/phase-1-baseline-gap-matrix.md`; `docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md`; `context/TECHNICAL_REQUIREMENTS.md`; `context/USER_STORIES.md`. |
| Includes | Rerun current local smoke/test path; resolve TB-06 staging status; inventory Phase 1 user-story and technical-requirement gaps; classify each gap as now/deferred/later. |
| Tests | Existing local checks only; this is an inventory slice. |
| Browser check | Blocked; see G-01 in `docs/plans/2026-05-13/phase-1-baseline-gap-matrix.md`. |
| Lessons | Accepted Phase 1 scope and gap classifications live in the baseline matrix; implementation should resume at P1-01. |

### P1-01 - Code-Review P0 Architecture Close-Out

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Resolve the project-document/table boundary issues that would otherwise be copied into later table work. |
| References | `docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md`; `context/technical-requirements/data-model.md`; `context/technical-requirements/save-versioning.md`; `context/technical-requirements/api.md`. |
| Includes | Split project-document workflow responsibilities; introduce the table-registry boundary; make unsupported table behavior registry-owned; preserve current public routes and behavior. |
| Tests | Backend project-document tests; existing Rooms draft/save/version/download tests; MCP read smoke if touched. |
| Browser check | Existing Rooms edit/save smoke still works if frontend behavior is touched. |
| Lessons | Backend table behavior now goes through `features/project_document/tables/registry.py`; the next table should add a registered contract, not route/service branches. Registry iteration is deterministic by table name, and document body-size calculation lives with project-document validation helpers. |

### P1-02 - Document Summary And Header Decoupling

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Make project header/version chrome table-neutral. |
| References | `context/user-stories/00-foundation-shell.md`; `context/technical-requirements/save-versioning.md`; `context/technical-requirements/frontend-viewer-units.md`; `docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md`. |
| Includes | Document-level draft summary state; table-neutral Save, Save As, Discard, Lock/Unlock, diff, and dirty/clean indicators; remove direct Rooms/Equipment coupling from project shell controls. |
| Tests | Backend draft-summary behavior; frontend header states for clean, dirty, locked, Viewer, and public read. |
| Browser check | Edit Rooms, confirm header detects draft, Save/Discard works, lock/read-only states remain clear. |
| Lessons | Document chrome state is owned by `features/project_document`: the header reads `/draft` summary for dirty state and save ETags, while table-specific downloads live with the table surface. Rooms writes invalidate the document summary instead of being queried by the header. |

### P1-03 - MVP Document Recovery Scope

| Field | Plan |
|---|---|
| Type | HITL scope decision recorded; implementation aid in review |
| Status | [x] Complete |
| Goal | Define MVP recovery behavior for invalid or unsupported project documents. |
| References | `context/user-stories/00-foundation-shell.md` (US-Errors-SchemaFallback); `context/technical-requirements/llm-mcp-schema.md`; `docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md`. |
| Includes | MVP guarantee: raw project JSON remains downloadable; typed table reads/writes fail closed when the saved/draft body cannot validate. Full schema-upgrade shims, golden fixtures, MCP read-safe behavior, and polished recovery UX are deferred until real schema evolution exists. Current Phase 1 implementation may keep the document-level read-safe envelope as a helpful recovery aid, but it is not the MVP contract. |
| Tests | Invalid/unsupported saved body download and strict table-read failure; recovery-state tests only where the aid exists. |
| Browser check | Opening an invalid/unsupported version never traps the user without raw JSON recovery; full older-schema workspace behavior is explicitly deferred. |
| Lessons | MVP protects data, not editability: invalid/unsupported documents must keep raw Project JSON recoverable, while typed editing may fail closed. The current `/document` and editor `/draft` envelope plus recovery panel can ship as a Phase 1 aid, but forward upgrade shims, golden schema corpus, MCP read-safe behavior, and production recovery polish are post-MVP hardening. |

### P1-04 - BLDGTYP Design-System Foundation

| Field | Plan |
|---|---|
| Type | AFK; design review if the visual direction is uncertain |
| Status | [x] Complete |
| Goal | Move the Phase 1 app from scaffold styling to the BLDGTYP V2 product language. |
| References | `context/UI_UX.md`; BLDGTYP branding tokens; `context/technical-requirements/stack-auth-migration.md`. |
| Includes | Tailwind/shadcn token alignment; fonts; shared app primitives for buttons, dialogs, popovers, toasts, tabs, table chrome, badges, banners, and empty states; project shell polish. |
| Tests | Frontend lint/format/build; targeted tests only for non-trivial state. |
| Browser check | Desktop and narrow-tablet screenshots for sign-in, dashboard, project shell, Status, Equipment/Rooms, settings, and version dialogs show consistent styling with no broken layout. |
| Lessons | P1-04 foundation loads the published BLDGTYP `tokens.css` once from `frontend/index.html`, loads the active Outfit + JetBrains Mono weights once from the same file, sets `data-theme="light"` on `<html>`, and maps existing app chrome to `--bg-*`, `--text-*`, `--border-*`, `--accent`, and `--highlight` variables in `frontend/src/App.css`. PH-Navigator-specific primitives stay class-based for now because Tailwind/shadcn is not yet installed in the scaffold; future shadcn/Tailwind work should map to these same variables rather than reintroducing a separate palette. The named React primitives (`Button`, `Dialog`, `Popover`, `Toast`, `Tabs`, `Badge`, `Banner`, `EmptyState`) are deferred to the slice that installs Tailwind/shadcn. Graph-paper treatment is limited to technical empty/auth states and uses the BLDGTYP `--svg-line-*` helper tokens. The current semantic warning/danger colors remain PHN-local and should be reconciled when shadcn semantic tokens land. Settings-specific styling could not be browser-checked because the Settings UI is owned by P1-07. |

### P1-05 - Dashboard And Project Shell Completion

| Field | Plan |
|---|---|
| Type | HITL only if pin/reorder is re-scoped |
| Status | [x] Complete |
| Goal | Finish the Phase 1 shell stories enough that later tabs land inside a stable frame. |
| References | `context/user-stories/00-foundation-shell.md`; `context/UI_UX.md`; `context/technical-requirements/api.md`. |
| Includes | Dashboard row metadata; New Project modal polish; Catalogs dropdown routing without full catalog management; workspace header, breadcrumbs, tab routing, Viewer/read-only separation; no AirTable affordance. |
| Tests | Project create/list/open contracts; frontend route/header behavior; write rejection for Viewer/public mode. |
| Browser check | Sign in, create/open project, navigate tabs, return dashboard, reopen same URL as Viewer on local and staging. |
| Lessons | First P1-05 pass added live Catalogs dropdown routing for Materials, Window-Frame Elements, and Window-Glazing placeholder routes; context-aware workspace breadcrumbs; dashboard `My Projects` / `All projects` row metadata with relative last-modified timestamps and `bt_number DESC` backend ordering; empty-dashboard New Project CTA reuse; and Viewer header read-only pill instead of a full-width banner. Pin/reorder remains deferred because the `user_project_preferences` persistence table/API does not exist yet; pin/menu controls should stay absent until they have real semantics. Project-shell account identity still renders as `Editor` until a later shell/auth cleanup decides whether public project routes should also probe `/auth/session`. |

### P1-06 - Status Tab Full MVP

| Field | Plan |
|---|---|
| Type | HITL only if drag reorder remains deferred |
| Status | [x] Complete |
| Goal | Move Status from tracer feature to complete Phase 1 workflow. |
| References | `context/user-stories/00-foundation-shell.md` (US-Status); `context/UI_UX.md` (Status tab); `context/technical-requirements/data-model.md`. |
| Includes | Empty state; populated vertical timeline; current-step visual; add/edit/delete/state/date/description behavior; Markdown decision; reorder decision; public Viewer rendering; MCP-readable status posture. |
| Tests | Status API transitions; date behavior; reorder; frontend state helpers where non-trivial. |
| Browser check | Empty state, template apply, edit, reorder, delete, Viewer read-only, and current-step visual on local and staging. |
| Lessons | Local P1-06 review/simplify follow-up added sanitizer regression coverage, explicit shared Markdown policy constants, delete-dialog error handling, segmented-control pressed state, empty-state copy cleanup, shared fractional `order_index` helper, drag/drop no-op guards, and same-reference delete-cache no-op handling. Deliberate MVP deferrals: inline title edit, `⋯` row-action menu, production icon-library drag handle, touch drag/drop support, richer drop-target affordance, and Markdown renderer lazy-loading/bundle-budget work. Current v1 behavior keeps title click/Edit opening the row modal, visible row buttons instead of a hidden `⋯` menu, desktop HTML5 drag/drop plus up/down buttons and `Alt+↑/↓` keyboard reorder. |

### P1-07 - Project Settings And MCP Token UI

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Make settings and MCP token administration user-accessible. |
| References | `context/user-stories/50-settings-ops-llm.md`; `context/technical-requirements/llm-mcp-schema.md`; `context/technical-requirements/stack-auth-migration.md`; `context/UI_UX.md`. |
| Includes | Project Settings modal; editable Phase 1 metadata; MCP token issue/list/revoke UI; one-time token display; revoked-token feedback; no project delete in settings. |
| Tests | Settings metadata behavior; token issue/list/revoke; revoked token rejection; Viewer access rejection. |
| Browser check | Editor issues and revokes a token from Settings; Viewer cannot open Settings; revoked token fails on next MCP request. |
| Lessons | Settings/token UX review fixed the current correctness/privacy items: public project detail no longer exposes owner display name, no-op metadata PATCH skips `updated_at`/audit churn, token plaintext has an explicit copy control, MCP token cache clears on auth-boundary transitions, and certification-program diffing is order-insensitive. Simplify follow-up rejected explicit null/blank required PATCH fields, reused project metadata validators and the certification-program fieldset, folded editor owner display into detail/update queries, kept settings-save cache updates local, and made clipboard/test handling less brittle. Staging acceptance required re-seeding `ed@example.com`; after that, browser Settings issue/revoke and Viewer-hidden Settings passed. Revoked tokens fail the next staging MCP request with `401 invalid_token`; active-token MCP reads still hit a staging transport/config issue (`421 Invalid Host header`) and are routed to P1-13/TB-04b staging hardening rather than the P1-07 UI gate. Deliberate MVP deferrals: move Settings into the future header `⋯` menu, add field-level blur/tooltip validation when form primitives land, split the large settings modal before substantial new work, add revoke confirmation/copy polish for Project ID, and keep strict ownership ACL post-MVP because `owner_id` is dashboard organization only in V2 v1. |

### P1-08 - Shared DataTable Extraction

| Field | Plan |
|---|---|
| Type | AFK; design review if POC parity regresses |
| Status | [x] Complete |
| Goal | Replace the tracer table with the real reusable table primitive. |
| References | `context/technical-requirements/data-table.md`; `context/user-stories/30-tables-equipment.md`; `context/UI_UX.md` §1.7; `research/poc-plans/grid-spike-results.md`; `research/poc-plans/poc-evaluation.md`; `research/poc-plans/poc-lessons-for-real-build.md`. |
| Includes | TanStack/shadcn table path; stable row-id state; keyboard navigation; frozen identifier column; row gutter; selection/copy/paste; stacked sort/filter/group; read-only mode; a11y baseline. |
| Tests | Targeted helper tests for brittle POC behaviors: selection, copy/paste planning, coercion, toolbar state, and read-only behavior. |
| Browser check | Compare extracted table against POC workflows: selection/copy, paste with overflow, single-select paste, grouping/sorting, and fill/undo if included. |
| Lessons | First extraction deliberately lands the reusable controlled API, TanStack rendering, stable row-id identity, keyboard active-cell/range-selection state, TSV/HTML copy helpers, paste planning helpers, frozen gutter/identifier column, local sort affordance, read-only chrome, and focused helper tests. Review follow-up fixed the immediate correctness/a11y items: paste now either emits a semantic `paste` write op or announces that paste is not enabled, read-only paste remains blocked, header/gutter buttons no longer trap Tab focus, filtered-empty tables get a distinct empty state, dead TanStack column metadata was removed, and command shortcuts accept Ctrl as well as Cmd. Still deferred before POC parity: toolbar popovers/stacked sort-filter-group, click-drag/shift-click selection, header column selection, full field-registry coercion, single-select option-order behavior, and virtualization for catalog-scale tables. |

### P1-09 - Single-Select Field And Option Manager

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Finish the user-defined single-select behavior Rooms depends on. |
| References | `context/user-stories/30-tables-equipment.md` (US-Builder-Tables criteria 16-17); `context/technical-requirements/data-table.md`; `research/poc-plans/poc-evaluation.md`. |
| Includes | Shared single-select field display/edit/paste/sort/filter behavior; option colors; duplicate prevention; missing-option warnings; header option manager for rename, reorder, recolor, delete, and merge/replace decisions. |
| Tests | Option validation; paste match/create; option-order sorting; missing-option recovery; delete/merge impact behavior. |
| Browser check | Rooms floor/building-zone options can be created, pasted, reordered, recolored, and used for sorting without data loss. |
| Lessons | Initial implementation moved single-select option metadata into the shared `DataTable` field definitions so copy/filter/sort/paste all resolve labels through the same registry. Paste-created options are emitted in the same semantic write op as cell writes, then Rooms persists them through the existing replace-slice endpoint. Option reorder must preserve the manager's array order before assigning new `order` values; sorting by single-select uses `option.order` with nulls last. Header popovers inside sticky table headers need the table wrapper/header stacking raised while open, otherwise visible controls can fail pointer hit-testing. |

### P1-10 - Rooms Full MVP On Shared DataTable

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Complete US-EQ-2 on top of the shared table path. |
| References | `context/user-stories/30-tables-equipment.md` (US-EQ-2); `context/technical-requirements/data-model.md`; `context/technical-requirements/save-versioning.md`; `context/technical-requirements/data-table.md`. |
| Includes | Default Rooms columns; validation; natural sort; add row; row-detail modal; inline edit where appropriate; delete; notes; JSON download; locked/Viewer behavior; iCFA factor handling; explicit no-sync-from-HBJSON posture. |
| Tests | Rooms validation; number uniqueness; single-select references; JSON download; locked/public write rejection. |
| Browser check | Rooms edit/save/save-as/discard/lock/download/diff flows still work after migrating off the stub; Viewer can sort/filter/copy without edit affordances. |
| Lessons | P1-10 closed with visible filter/search explicitly deferred to TB-20; current Viewer browser evidence covers sort/copy/read-only behavior but not filtering because no filter/search control exists yet. |

### P1-11 - Draft, Version, And Concurrency UX Completion

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Make the file-app lifecycle safe enough for real Phase 1 use. |
| References | `context/technical-requirements/save-versioning.md`; `context/user-stories/00-foundation-shell.md` (US-Concurrency); `context/technical-requirements/frontend-viewer-units.md`. |
| Includes | Restore/discard prompt; dirty-draft prompt before version switch; beforeunload warning; stale ETag conflict UI; generalized same-editor tab conflict behavior; live lock downgrade; local undo invalidation rules. |
| Tests | Draft restore/discard; version-switch prompt; stale write; lock with open draft; same-editor tab conflict behavior. |
| Browser check | Two tabs, locked version, stale write, restore, and discard paths preserve local edits until the user chooses. |
| Lessons | Record the reusable concurrency UX before MCP writes. |

### P1-12 - Diff, Downloads, Schemas, And API Docs Baseline

| Field | Plan |
|---|---|
| Type | HITL if OpenAPI/schema timing is explicitly deferred |
| Status | [x] Complete |
| Goal | Finish the inspectability surface expected by Phase 1. |
| References | `context/technical-requirements/api.md`; `context/technical-requirements/llm-mcp-schema.md`; `context/technical-requirements/save-versioning.md`; `context/user-stories/00-foundation-shell.md` (US-Versions-Lifecycle). |
| Includes | Project/table JSON downloads across normal and recovery states; version-vs-version and version-vs-draft diff UX at the planned stub level; OpenAPI and project/table schema baseline or explicit deferral; request-id/structured-error visibility. |
| Tests | Download validation; diff behavior; schema/OpenAPI endpoint checks if included; structured error/request-id checks. |
| Browser check | Normal state: download raw project JSON and Rooms JSON, and open a useful diff. Recovery state: raw project JSON remains downloadable; typed table/download/diff surfaces may fail closed, but must show structured/supportable errors rather than trapping the user. |
| Lessons | Record schema/OpenAPI readiness before MCP write tools; recovery-mode acceptance protects raw document access, not typed table editability. |

### P1-13 - Phase 1 Hardening, Docs, And Release Gate

| Field | Plan |
|---|---|
| Type | AFK with HITL for final scope acceptance |
| Status | [x] Complete |
| Goal | Mark Phase 1 done with evidence. |
| References | `docs/plans/2026-05-13/phase-1-full-buildout-plan.md`; `docs/plans/2026-05-14/phase-1-release-gate.md`; `context/README.md`; `context/TECHNICAL_REQUIREMENTS.md`; `context/USER_STORIES.md`; `context/UI_UX.md`. |
| Includes | Complete requirements matrix; update roadmap ledger; focused docs-pass; move unresolved questions to the open-question router or later roadmap slices. |
| Tests | `make lint`; `make typecheck`; `make test`; `make e2e`; staging browser smoke for all Phase 1 paths. |
| Browser check | Full Phase 1 staging smoke: sign in, dashboard, project shell, Status, Settings/token UI, Rooms table, Save/Save As/Discard/Lock, public Viewer, downloads/diff/recovery if included. |
| Lessons | Local P1-13 hardening traced the active-token staging MCP `421 Invalid Host header` to FastMCP DNS-rebinding host validation after bearer auth. PHN now configures MCP transport security explicitly from `MCP_ISSUER_URL`, `MCP_RESOURCE_SERVER_URL`, Render's `RENDER_EXTERNAL_URL` / `RENDER_EXTERNAL_HOSTNAME`, `CORS_ORIGINS` for origin validation, and optional `MCP_ALLOWED_HOSTS` / `MCP_ALLOWED_ORIGINS`; staging health/session, CLI browser e2e, Settings issue/revoke/Viewer-hidden checks, and active-token MCP reads now pass. Ed approved P1-13 as complete on 2026-05-14. |

## Historical Tracer-Bullet Slices [Phase 1 - Table Pages]

### TB-00 - Bootable App Health Tracer

| Field | Plan |
|---|---|
| Type | AFK; repo-split resolved as one repo for MVP scaffold |
| Status | [x] Complete |
| Goal | Backend, DB, and frontend boot; the browser can display backend health/version. |
| References | `context/ENVIRONMENT.md`; `context/TECH_STACK.md`. |
| Includes | Minimal repo scaffold; Docker Postgres path; backend settings; Alembic baseline; `/api/v1/health` and `/api/v1/version`; frontend route that reads and displays service status; initial Make recipes for setup/dev/smoke; CI workflow (GitHub Actions) running lint + tests + build on push and PR, no deploy yet. |
| Tests | Backend health/version contract; DB connectivity smoke; frontend service-status fetch only if state is non-trivial. |
| Browser check | Start dev stack, open the frontend, see live backend health/version from `/api/v1`. |
| Lessons | Record scaffold choices, tooling friction, and any command naming that did not work. |

### TB-01 - Sign-In To Empty Dashboard

| Field | Plan |
|---|---|
| Type | AFK after seed credentials are agreed |
| Status | [x] Complete |
| Goal | Editor signs in and lands on an empty dashboard. |
| References | `context/technical-requirements/stack-auth-migration.md`; `context/user-stories/00-foundation-shell.md`; `context/technical-requirements/api.md`. |
| Includes | Users/session schema; password hashing; seed user command; login/logout/session API; dashboard shell; auth guard; request IDs and structured errors. |
| Tests | Password/session rules; single-active-session behavior; auth dependency; login/logout API. |
| Browser check | Sign in as seed editor, refresh, remain signed in, sign out, protected dashboard redirects to sign-in. |
| Lessons | Record auth/session decisions and any dev-login shortcuts explicitly accepted or rejected. |

### TB-02 - Create And Open Project Shell

| Field | Plan |
|---|---|
| Type | HITL for staging URL and deploy credentials; otherwise AFK |
| Status | [x] Complete |
| Goal | Editor creates a project, opens `/projects/{id}/status`, and sees the workspace shell; the same shell is reachable on staging. |
| References | `context/user-stories/00-foundation-shell.md`; `context/technical-requirements/api.md`; `context/technical-requirements/data-model.md`; `context/UI_UX.md`. |
| Includes | Project and initial version metadata; owner dashboard query; project create/list/open API; access-check dependency; shell header, tab bar, version dropdown placeholder, settings menu placeholder; public read route with edit controls hidden; first staging deploy (Render) for backend + frontend so subsequent slices can be verified end-to-end against a real environment. |
| Tests | `bt_number` uniqueness; project create/list/open contracts; view vs edit access dependency; public write rejection for one representative mutating route. |
| Browser check | Create project from dashboard, open Status tab, copy URL into signed-out context, confirm read-only shell. Re-run the same happy path against the staging URL. |
| Lessons | Record URL/access assumptions, shell navigation choices, deploy/staging friction, proxy-aware client-IP handling, JSON application-log setup, and the first `require_project_access(project_id, mode)` implementation. |

### TB-03 - Status Tab Lifecycle

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Status tab has the default cert-agnostic tracker and editable item state. |
| References | `context/user-stories/00-foundation-shell.md` (Status tab); `context/technical-requirements/data-model.md` (relational tables). |
| Includes | `project_status_items` relational table; apply default template; add/edit/reorder/delete item workflow as scoped for v1; current-step visual; read-only public display. |
| Tests | State enum and completion-date rules; default template creation; reorder/delete behavior; API tests for non-trivial transitions. |
| Browser check | Apply default template, mark an item done, edit completion date, delete one item, reload, confirm public viewer can read but not edit. |
| Lessons | Status stayed relational and outside `ProjectDocumentV1`; date-only completion values must parse as local calendar dates in the frontend; drag-and-drop was cut from the tracer in favor of explicit up/down controls plus keyboard movement; description Markdown shipped as a v1 scope cut with only sanitized external links rendered; the in-place session-expiry/device-collision modal remains a blocking auth-hardening follow-up before production editable workflows. |

### TB-03.5 - Frontend Server-State Structure

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Align the frontend with the feature-first/TanStack Query shape before TB-04 adds document-editing server state. |
| References | `context/CODING_STANDARDS.md` (frontend shape/server state); `context/TECH_STACK.md`; `docs/code-reviews/2026-05-12/tb-03-code-review.md` (H1/M4/M5/M6). |
| Includes | `QueryClientProvider` and query defaults; feature-local API/types/hooks for project shell and project status; split `StatusTab` into route, components, and shared helpers; shared local-calendar date formatter; pure helper tests for status state cycle, order-index movement, and date-only formatting. |
| Tests | `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; targeted browser smoke for dashboard -> Status tab load and template display. |
| Browser check | Open a project Status tab as editor and public viewer after the split; confirm the existing status happy path still renders with no console warnings/errors. |
| Lessons | Query provider and feature modules are sufficient for project/status server state; route/page bodies also need feature ownership, not just feature-local API/hooks; auth boundary changes must refresh or clear project queries so public viewer cache does not survive sign-in/sign-out. |

### TB-04 - Minimal Project Document And Rooms Draft

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | First project-document edit path works through Rooms without version-save polish. Not user-visible on its own: drafts created here have no terminal action until TB-05 ships Save/Discard. |
| References | `context/technical-requirements/data-model.md` (ProjectDocumentV1); `context/technical-requirements/save-versioning.md` (draft lifecycle); `context/technical-requirements/data-table.md`; `context/user-stories/30-tables-equipment.md` (Rooms). |
| Includes | `ProjectDocumentV1` minimal body with empty tables; Rooms and single-select option structures; draft row created on first edit; table-slice read; guarded draft patch; minimal Equipment -> Rooms UI using a temporary table-render stub. |
| Tests | Pydantic document validation; golden empty document; guarded patch rules; Rooms row validation; single-select duplicate/missing-option rules. |
| Browser check | Add a room, edit floor level and building zone options, reload, restore draft, confirm row remains in draft. |
| Lessons | Document validation now owns Rooms and project-defined option integrity; the first Rooms write uses an ETag-guarded whole-table replacement into `project_version_drafts`; Rooms REST routes are version-scoped and draft-scoped per `api.md`; `TablePrimitiveStub` is intentionally not the canonical `<DataTable>` from `data-table.md`; verify `expires_at`/keepalive behavior before relying on long-lived editable draft state. |

### TB-04b - MCP Read-Only Tracer

| Field | Plan |
|---|---|
| Type | HITL for MCP transport decision and local client setup |
| Status | [x] Complete |
| Goal | Claude can authenticate via MCP and read project + draft state through a real local client. De-risks transport, token, and access-check choices before TB-05 introduces version semantics. |
| References | `context/technical-requirements/llm-mcp-schema.md`; `context/user-stories/50-settings-ops-llm.md`; `context/technical-requirements/api.md` (shared access-check). |
| Includes | MCP server scaffold with chosen transport(s); token schema and hashing; project-scoped read-only scopes; list/get tools for projects, status items, and document slices; shared access-check dependency reuse; structured MCP error shape. |
| Tests | Token scope validation and revocation; read-only enforcement (write attempt is rejected, not silently no-op); MCP and REST share the access-check dependency; targeted tool I/O contract tests. |
| Browser check | Run MCP list/get against a project from a local MCP client; cross-check that the same data appears in the browser dashboard for the same user. |
| Lessons | Streamable HTTP is mounted at `/mcp` and stdio is available through `python -m scripts.mcp_stdio` with `PHN_MCP_TOKEN`; token admin is backend-only until the Project Settings modal lands; write tools remain deferred to TB-17, with a read-only token write attempt returning a structured `mcp_scope_insufficient` tool error instead of a silent no-op. |

### TB-05 - Save, Save As, Lock, Diff Stub, Downloads

| Field | Plan |
|---|---|
| Type | HITL for version-name uniqueness and diff scope confirmation |
| Status | [x] Complete |
| Goal | File-app-style version workflow is usable on the Rooms slice. |
| References | `context/technical-requirements/save-versioning.md`; `context/technical-requirements/api.md` (version endpoints, ETag); `context/user-stories/00-foundation-shell.md` (version dropdown). |
| Includes | Save, Save As, Discard, Lock; version dropdown behavior; denormalized save metadata; project JSON download; Rooms table JSON download; structured diff endpoint with v1 UI stub; locked-version read-only behavior. |
| Tests | Save/version service; ETag conflicts; locked-version write rejection; JSON round-trip validation; table download validation; draft discard and restore paths. |
| Browser check | Edit Rooms draft, Save, Save As, lock old version, try blocked edit, download project JSON and Rooms JSON, open diff stub. |
| Lessons | Backend diff is a structured per-table/path summary; v1 UI is a text modal stub. Full side-by-side visual diff remains deferred. |

### TB-06 - Same-Editor Tabs And Stale Draft Boundaries

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Local implementation complete; staging browser check pending |
| Goal | Basic concurrency rules are visible before more editors are built on top. |
| References | `context/technical-requirements/save-versioning.md` (stale-draft + ETag rules); `context/user-stories/00-foundation-shell.md`. |
| Includes | Same-editor tab coordination; stale ETag handling; dirty-draft warning; restore/discard prompt; read-safe-mode fallback for older or invalid schema bodies. |
| Tests | Same-editor disjoint edit path; same-scope stale conflict; schema fallback raw-body download; draft age metadata if present. |
| Browser check | Open two tabs to one project, edit in one, verify the other handles stale state without silent overwrite. |
| Lessons | Browser tabs coordinate accepted Rooms draft writes with `BroadcastChannel`; broadcasts include the previous Rooms ETag guard so out-of-order tab messages invalidate/refetch instead of rolling cache backward. Overlapping active Rooms edits freeze and require an intentional reload rather than merge, while disjoint same-table writes can update the cached slice and continue. No-op Rooms replacements return the current slice without creating a draft row. Saved project JSON downloads now return raw body JSON so invalid/older schemas can still be recovered when table slices reject validation. Staging verification is still required before checking this slice complete. |


## Tracer-Bullet Slices [Phase 2 - Builder Pages]

Phase 2 is gated. Do not start TB-07 catalog work until P1-01, P1-02,
P1-03, and the DataTable extraction gate (P1-08, or an explicit
re-scope of that gate) have either landed or been intentionally
re-scoped in this roadmap.

### TB-07 - Catalog Manager Tracer

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | One catalog can be managed in the app and read by downstream pickers. |
| References | `context/technical-requirements/data-model.md` (catalogs / bookshelf copy); `context/user-stories/10-windows.md` (downstream picker shape). |
| Includes | Relational catalog schema for the first envelope/window catalog row type; catalog list/create/edit/deactivate API; dashboard Catalogs entry; catalog table UI; `catalog_schema_version: 1` hook only, no migration tooling. |
| Tests | Catalog validation; active/inactive filtering; bookshelf copy metadata shape; no live project mutation when catalog row changes. |
| Browser check | Add/edit/deactivate one catalog row, refresh, confirm the row appears in picker-ready API output. |
| Lessons | Materials chosen as the tracer catalog: smallest typed field set, lets TB-08 (Window Type pick) add Frame/Glazing catalogs against the same primitives without growing the tracer scope. Identity row + versions table land together with a deferred `current_version_id` FK to avoid a circular reference at create time. In-place edit per §7.3 patches the current version row instead of forking a new version; the new-version-flow UI is deferred. `catalog_schema_version: 1` is denormalized on every version row so the API response carries the future migration hook without a join. Soft-delete on the identity row (`deleted_at`) doubles as the "deactivate" gesture; the joined select keeps inactive rows queryable so historical picks remain readable for refresh-from-catalog (TB-09). Frontend catalog page intentionally uses a plain HTML table rather than the project-document `<DataTable>` primitive because catalog rows are not draft-scoped. |

### TB-08 - Window Type Pick From Catalog (parent)

Tracer-bullet for the bookshelf model against a non-Rooms project table.
**Not** the full US-WIN-1..12 Window-Builder — just enough Windows
surface to pick a frame and a glazing into a project, copy values in
with `catalog_origin`, edit one local field, save through the existing
draft/version system, and reload.

Split into four methodical sub-slices below. Confirmed scope choices
(2026-05-14):
- FrameRef/GlazingRef store both the catalog identity `catalog_record_id`
  and the pinned `catalog_version_id` so refresh-from-catalog (US-WIN-11,
  deferred) can re-find the row across versions.
- "Add window type" creates one 1×1 element with all-null frames and null
  glazing per US-WIN-1 §8 and Q-WIN-3 lean (b).
- Picker UI is plain HTML (matching the TB-07 materials catalog page);
  no shadcn `Combobox` / `Command` primitives in this slice.
- **Catalog record IDs use AirTable `rec` + 14-char base62 format
  uniformly across all three catalogs** (Materials, Frame, Glazing) so
  V1 / AirTable import is a literal `INSERT … id = airtable_record_id`
  with no remapping table and cross-references in legacy data continue
  to resolve. Version IDs stay V2-native and table-prefixed
  (`matv_<ULID>`, `framev_<ULID>`, `glazingv_<ULID>`) because AirTable
  has no version concept. Document-level entity IDs
  (`win_<ULID>`, `winel_<ULID>`, `pmat_<ULID>`, etc.) stay as-is —
  they are project-document internal, not imported.

Deliberately deferred from TB-08 (routed to later US-WIN slices):
manufacturer filter (US-WIN-8), refresh-from-catalog (US-WIN-11),
full SVG canvas (US-WIN-9), dimensions panel + parser (US-WIN-10),
operation editor (US-WIN-5), U-value calc (US-WIN-6), copy/paste
(US-WIN-7), element merge/split (US-WIN-3), inline override of all
fields (only `u_value_w_m2k` ships as the override tracer), the
"hand-enter" path, more than one element per window type, view-direction
toggle, and MCP write tools for window types.

### TB-08.a - Frame & Glazing Catalogs

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Stand up the two remaining v1 catalogs (Window-Frame Elements, Window-Glazing) using the TB-07 Materials pattern so TB-08.c can pick from real data. |
| References | `context/technical-requirements/data-model.md` §7.0–§7.3 (catalog roster, identity+versions schema, in-place edit, soft delete); `context/user-stories/10-windows.md` US-WIN-4 criterion 3 (FrameType / GlazingType field shape); TB-07 lessons (audit + null-version_date rejection). |
| Includes | Alembic migration adding `catalog_frame_types` + `catalog_frame_type_versions` and `catalog_glazing_types` + `catalog_glazing_type_versions` with deferred `current_version_id` FK and denormalized `catalog_schema_version: 1`; second Alembic migration rebadging existing dev-seeded `catalog_materials.id` from `mat_<...>` to the new uniform `rec`-format (versions stay `matv_<...>`); shared `_new_catalog_record_id()` helper that returns `rec` + 14-char base62 used by all three catalogs going forward; `backend/features/catalogs/frame_types/` and `.../glazing_types/` siblings to the existing Materials submodule (models, repository, service, routes) mounted at `/api/v1/catalogs/frame-types` and `/api/v1/catalogs/glazing-types`; audit rows via existing `catalogs/audit.py` (`catalog_record_create/_update/_delete/_reactivate`); reuse of frontend `MaterialsCatalogPage` pattern (plain HTML table) for both routes, replacing the existing placeholder pages. FrameType fields: `name`, `manufacturer`, `brand`, `width_mm`, `u_value_w_m2k`, `psi_g_w_mk`, `psi_install_w_mk`, `argb_color`, `notes`, `source_provenance`. GlazingType fields: `name`, `manufacturer`, `brand`, `u_value_w_m2k`, `g_value`, `argb_color`, `notes`, `source_provenance`. |
| Tests | Catalog CRUD + audit for both new catalogs; `include_inactive` filtering; null `version_date` rejection (TB-07 regression); unauthenticated read/write rejection; ID-shape unit test asserts generated record IDs match `^rec[A-Za-z0-9]{14}$` across all three catalogs and that version IDs keep their V2-native table prefix. |
| Browser check | Visit `/catalog/frame-types` and `/catalog/glazing-types`, add a row, in-place edit one numeric field (same `current_version_id`), deactivate and reactivate. |
| Lessons | Record any deviations from the TB-07 Materials shape and whether the catalog submodule generalized cleanly across three row types. |

### TB-08.b - Window Types Document Shape & Table Contract

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Extend `ProjectDocumentV1` with `tables.window_types[]` and register the table contract so generic saved/draft table routes work for Windows. No frontend in this slice. |
| References | `context/technical-requirements/data-model.md` §6.2 (`window_types` sketch, `catalog_origin` block) and §6.3 (registered table contracts); `context/user-stories/10-windows.md` US-WIN-1 §8 (add-window-type defaults), US-WIN-4 criterion 3 (FrameRef/GlazingRef shape); P1-01 lessons (table-registry boundary). |
| Includes | New Pydantic models in `backend/features/project_document/`: `WindowTypeEntry`, `WindowElement`, `FrameRef`, `GlazingRef`, `CatalogOrigin`. `WindowTypeEntry`: `id` (`win_<ULID>`), `name`, `row_heights_mm: list[float]` (>=1, all >0), `column_widths_mm: list[float]` (>=1, all >0), `elements: list[WindowElement]` (>=1). `WindowElement`: `id` (`winel_<ULID>`), `row_span: [int,int]` inclusive, `column_span: [int,int]` inclusive, both within grid bounds, `frames: {top, right, bottom, left}` each nullable FrameRef, `glazing: nullable GlazingRef`. FrameRef/GlazingRef carry the full catalog field set inline plus `catalog_origin: { catalog_table, catalog_record_id, catalog_version_id, catalog_schema_version, synced_at, local_overrides: list[str] } \| null`. Add `tables/window_types.py` table contract registered in `tables/registry.py`: payload validation, document replacement, row extraction for downloads/MCP, diff extraction, schema endpoint metadata. Unique window-type names per version (trim + case-insensitive per US-WIN-1 §9a). Catalog values are validated as data only — **no live FK or join** against `catalog_*` tables. |
| Tests | `ProjectDocumentV1` validation: unique window-type name, valid span ranges, row/column count >=1, FrameRef/GlazingRef shape; `catalog_origin` schema (all five fields required when present, `local_overrides` defaults to `[]`); registered table contract round-trip (replace → read → diff → download); table-schema endpoint returns Window Type schema; unsupported-name behavior still goes through `document_table_not_found`. |
| Browser check | None — backend-only slice. |
| Lessons | Record whether the table-registry boundary held for the second registered table without service-layer special cases, and whether the FrameRef/GlazingRef shape needed to diverge from the data-model sketch. |

### TB-08.c - Minimal Windows Frontend & Picker

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Land a minimal `/projects/:id/windows` route that creates window types, picks frame/glazing from the catalogs landed in TB-08.a, and saves through the existing draft/version system. |
| References | TB-08.a (catalog APIs); TB-08.b (table contract + FrameRef/GlazingRef shape); `context/user-stories/10-windows.md` US-WIN-1 §8 (add-type defaults), US-WIN-4 (bookshelf pick); P1-08/P1-09/P1-10 lessons (draft replace-slice path, query invalidation). |
| Includes | New `frontend/src/features/windows/` feature module: api/types/hooks/query-keys, `WindowsPage` route, sidebar list of window types in the active draft (sorted naturalSortCompare per US-WIN-1 §3), Add button (defaults per US-WIN-1 §8 + Q-WIN-3b: one 1×1 element, all four frames null, glazing null, name auto-suffixed for uniqueness), per-element card showing four frame slots + one glazing slot, plain combobox picker (HTML `<select>` or simple search-filter list — no shadcn Combobox in this slice) fed by `/api/v1/catalogs/frame-types` and `/api/v1/catalogs/glazing-types` filtered to `include_inactive=false`. On pick: bookshelf-copy the catalog version's typed values into the FrameRef/GlazingRef, stamp `catalog_origin` with `catalog_table`, `catalog_record_id`, `catalog_version_id`, pinned `catalog_schema_version`, ISO `synced_at`, empty `local_overrides`. Inline editable `u_value_w_m2k` on each picked FrameRef/GlazingRef as the **override tracer**: editing adds the field key to `catalog_origin.local_overrides` (no other inline overrides ship in this slice). All writes go through the existing whole-table replace-slice path with `If-Match` ETag. Document/draft summary integration so the project header Save/Discard/dirty indicator works out of the box. Locked-version + Viewer hide Add and disable picker controls (read the existing access-mode / lock signals). |
| Tests | Feature hooks (load list, replace-slice mutation); pure helper tests for bookshelf-copy stamping (asserts `local_overrides: []` on pick) and override-tracking (editing `u_value_w_m2k` adds `"u_value_w_m2k"` to `local_overrides`, editing back to catalog value still records it as overridden — confirm behavior matches lean before assertion); naturalSort sidebar order; add-type unique-name auto-suffix. |
| Browser check | Sign in, open a project, navigate to Windows, add window type "Test", confirm sidebar entry + 1×1 default element with all-null slots, pick a frame into the top slot, confirm `catalog_origin` badge appears in DOM, pick a glazing, edit `u_value_w_m2k` locally, observe header dirty indicator, Save, reload, confirm values + `catalog_origin` + `local_overrides: ["u_value_w_m2k"]` persist. Public Viewer read-only check is deferred — TB-08.c will rely on shared draft/version plumbing without a dedicated Viewer browser pass. |
| Lessons | Record V1 window-builder behavior adopted versus deferred and any draft-replace ergonomics that should change before TB-09 lands refresh-from-catalog. |

### TB-08.d - Hardening, Verification, Documentation

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Close TB-08 with full local gates, evidence, and a lessons-learned entry covering all sub-slices. |
| References | All TB-08.a–.c slice notes; `context/CODING_STANDARDS.md`; `context/USER_STORIES.md`. |
| Includes | Full `make lint`, `make typecheck`, `make test`, `make e2e`; one E2E happy-path script for the TB-08.c browser flow if it generalizes cleanly; targeted `docs-pass` if data-model/API docs drifted (especially `context/technical-requirements/data-model.md` §6.2 if FrameRef/GlazingRef shape changed); ledger row updates; consolidated Lessons Learned entry. |
| Tests | All existing suites still pass; new TB-08 tests stable. |
| Browser check | Re-run TB-08.c happy path against staging Render once local gates pass. |
| Lessons | Single consolidated TB-08 entry covering catalog generalization (TB-08.a), table-registry second-customer evidence (TB-08.b), bookshelf-copy + override tracer (TB-08.c), and any V1 behavior adopted or deferred. |

### TB-08.e - Shared Table-Slice API Factory (Pre-TB-09 Refactor)

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Stop Rooms and Windows from duplicating the project-document table-slice client shape before TB-09 (or any third consumer) entrenches the duplication. Frontend-only, no behavior change. |
| References | TB-08 close-out lessons (consolidated entry, "Follow-up"); `context/CODING_STANDARDS.md` (frontend server-state shape); `frontend/src/features/equipment/api.ts` / `hooks.ts` / `query-keys.ts`; `frontend/src/features/windows/api.ts` / `hooks.ts` / `query-keys.ts`. |
| Includes | Extract a shared `createTableSliceFeature<TSlice, TReplaceBody>({ tableName, ... })` (or pair of `useTableSliceQuery` / `useReplaceTableSliceMutation` hook factories) into `frontend/src/features/project_document/lib/` (or `shared/table-slice/`). Must preserve: saved/draft branch on `versionState`, `If-Match` + `If-Match-Version` ETag plumbing, document-summary invalidation after writes, structured error mapping with `request_id`, stable query-key shapes used by existing tests, and the existing `enabled` gating for Viewer/locked contexts. Migrate `features/equipment/` (Rooms) and `features/windows/` to the factory. Do not generalize beyond what the two existing call sites need. |
| Tests | Existing backend suite unchanged. Frontend unit tests for the factory's saved/draft branching and ETag header construction. All existing Rooms + Windows hook tests still pass against the migrated modules. |
| Browser check | Rooms draft add/save/reload and Windows draft pick/save/reload still work locally; no console errors. |
| Lessons | The factory generalized cleanly: both Rooms and Windows reduced to a one-call `createTableSliceFeature<TSlice, TReplaceBody>({ tableName, missingVersionMessage })` site that returns `{ queryKeys, fetchSlice, replaceSlice, useSliceQuery, useReplaceSliceMutation }`. Document-level option lists were never part of the slice API surface (they ride inside `RoomsSlice` / `RoomsReplacePayload`), so no special-case was needed. Rooms keeps the `useRoomsDraftBroadcast` BroadcastChannel hook outside the factory because Windows has no equivalent yet — TB-09 should add a parallel broadcast for Windows the same way, not pull it into the factory until the second concrete shape forces a generalization. Query-key shapes preserved exactly (`["project-document-tables", "project", projectId, "table", tableName, "slice", versionId, accessMode]`), so all existing hook tests and `App.test` paths kept passing. The optional `onAcceptedSlice(slice, previous)` callback (previously Rooms-only) is now exposed by the factory and Windows can adopt it for TB-09 broadcast plumbing without an API change. |

### TB-09 - Window Refresh-From-Catalog (parent)

Explicit catalog drift review for `FrameRef` / `GlazingRef` in
`tables.window_types[]`. Per-entry only — no bulk auto-apply, no
project-wide "update everything" button. Local overrides
(`catalog_origin.local_overrides`) remain authoritative for fields the
user has touched: those fields default to **Keep mine** in the dialog
and are not auto-overwritten on Update.

Split into three sub-slices below. Confirmed scope choices:
- Drift is computed against the catalog row's **current version**
  (`catalog_record_id` -> identity row -> `current_version_id`), not against
  the pinned `catalog_version_id`. A ref is "drifted" when its
  `catalog_version_id` differs from the current catalog version or when
  any catalog field differs from the ref's stored value.
- Soft-deleted (deactivated) catalog rows surface as a distinct
  `source_deactivated` state, not a drift; Update is disabled, Keep mine
  remains available, and the entry still appears in the Review all
  report so it is visible.
- "Update from catalog" copies non-overridden catalog field values into
  the ref, refreshes `catalog_version_id`, `catalog_schema_version`, and
  `synced_at`, and **never** strips entries from `local_overrides` — a
  field stays overridden until the user explicitly clears it.
- The apply path writes through the existing replace-slice endpoint
  (whole-table `If-Match` ETag), reusing the TB-08.e factory.
- MCP write tools for refresh-from-catalog are deferred (TB-17 owns the
  general MCP write path).

Deliberately deferred from TB-09: bulk Update-all, refresh for Project
Materials / Envelope materials (those tables don't exist yet), inline
field-level override management UI beyond the existing
`u_value_w_m2k` tracer, undo of a just-applied refresh.

### TB-09.a - Drift Detection Backend

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [x] Complete |
| Goal | Backend can report, for a given project version (saved or draft), every `FrameRef` / `GlazingRef` in `window_types[]` and whether it is `in_sync`, `drifted`, or `source_deactivated`, with per-field current-catalog vs ref deltas. |
| References | `context/user-stories/10-windows.md` (US-WIN-11 refresh-from-catalog); `context/technical-requirements/data-model.md` §6.2 + §7.3 (catalog drift/override rules); TB-08.b table-contract module; `features/catalogs/` repositories (Frame + Glazing). |
| Includes | New module `features/project_document/refresh.py` (or co-located in `tables/window_types.py`) that walks every window type's elements, collects (`catalog_table`, `catalog_record_id`) pairs, batches-loads current catalog rows (active + soft-deleted), and for each ref emits `{ window_type_id, element_id, slot: "frame.top" \| "frame.right" \| "frame.bottom" \| "frame.left" \| "glazing", state: "in_sync" \| "drifted" \| "source_deactivated", catalog_table, catalog_record_id, pinned_catalog_version_id, current_catalog_version_id, local_overrides: list[str], fields: list[{ key, ref_value, catalog_value, is_overridden }] }`. New GET endpoint `/api/v1/projects/{project_id}/versions/{version_id}/refresh/window-types` honoring the `?source=draft|version` query param used elsewhere; editor-only access; ETag passthrough so the frontend can detect stale state before applying. Refs without a `catalog_origin` (hand-entered) are omitted from the report. |
| Tests | Backend: in-sync (pinned == current, all fields equal) -> `state=in_sync`; drifted version but identical fields -> `state=drifted`, fields list shows all equal; drifted version with one differing field -> `state=drifted`, only that field shows `ref_value != catalog_value`; field in `local_overrides` is flagged `is_overridden=true` regardless of value equality; soft-deleted catalog row -> `state=source_deactivated`, no `current_catalog_version_id`; hand-entered ref (`catalog_origin=null`) is excluded; unauthenticated read rejected; non-editor (Viewer) read rejected per access seam. |
| Browser check | None — backend-only slice. |
| Lessons | The report shape is per-slot keyed by `(window_type_id, element_id, slot, catalog_table, catalog_record_id)` with frame slots labeled `frame.top/right/bottom/left` and glazing as `glazing`; that matches how TB-09.b will scope its dialog without growing the report. Comparable-field sets are hard-coded per catalog (`FRAME_REF_COMPARED_FIELDS`, `GLAZING_REF_COMPARED_FIELDS`) so a new catalog typed column will not silently slip out of drift detection — the test suite will fail if a ref carries a field the report does not compare. Soft-deleted rows surface as a distinct `source_deactivated` state (not just `drifted`) and emit `current_catalog_version_id: null` with `catalog_value: null` for every field; that is the correct boundary because TB-09.b must disable Update from catalog for those slots, whereas a drifted slot keeps Update available. Drift detection batch-loads catalog rows by `(catalog_table, catalog_record_id)` per request — fine for current window-type sizes, but TB-11 should reuse the same shape across Materials and call sites can grow into a true `id IN (...)` batch repository method if windows ever scale past one slot per element. Hand-entered refs (`catalog_origin = null`) are excluded entirely; that lets the TB-09.c "Review all" report stay focused on actionable rows. The route reuses existing `ProjectEditAccess` so Viewer/unauthenticated reads are rejected by the seam, not by ad-hoc logic in the report builder. |

### TB-09.b - Per-Entry Refresh Dialog

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Editor can open a drift-review dialog from a specific `FrameRef`/`GlazingRef` slot, see per-field Keep mine vs Update from catalog with overridden fields defaulting to Keep mine, and apply through the existing draft replace-slice path. |
| References | TB-09.a (drift endpoint); TB-08.c (`WindowsTab` slot UI, `applyUValueOverride`, `stampCatalogOrigin`); TB-08.e (shared slice factory); `context/UI_UX.md` (dialog patterns); P1-11 lessons (stale-ETag / locked-version reconciliation). |
| Includes | New `frontend/src/features/windows/refresh/` submodule: api/hooks/types for the TB-09.a endpoint, `RefreshDialog` component scoped to one slot showing per-field rows (field key, ref value, catalog value, radio Keep mine / Update from catalog, overridden badge). Default selections: overridden fields = Keep mine; non-overridden fields with `ref_value != catalog_value` = Update from catalog; equal fields = Keep mine (no-op). Add a "Review refresh" affordance on each drifted slot in the existing Windows picker UI (small badge + button next to the catalog-origin badge); hide in Viewer / locked / read-safe contexts. Apply: compute new FrameRef/GlazingRef by merging chosen fields, refresh `catalog_origin.catalog_version_id`, `catalog_schema_version`, `synced_at`, leave `local_overrides` unchanged, write through the shared replace-slice factory with `If-Match`. On stale ETag or version lock, surface the existing inline conflict messaging from P1-11 instead of swallowing. `source_deactivated` slots render the dialog read-only with Update disabled and explanatory copy. |
| Tests | Frontend unit tests: default-selection logic across drifted/in-sync/overridden/deactivated; apply-merge produces correct ref + bumped catalog_origin; `local_overrides` preserved verbatim; soft-deleted dialog renders Update disabled. Hook tests cover query-key shape and apply mutation invalidating both the refresh query and the window_types slice. |
| Browser check | Sign in, open a project with a window type whose frame is pinned to an older catalog version, click Review refresh on the frame slot, observe per-field defaults match drift state + override flags, toggle one field to Update and one overridden field stays Keep mine, Apply, confirm the slot's catalog-origin badge advances to the new `catalog_version_id`, override badge still present, header dirty -> Save -> reload -> values persist. |
| Lessons | Record whether per-slot dialog is the right granularity vs per-element, and whether default selections for overridden fields should ever auto-update. |

### TB-09.c - Review All Report, Hardening, Staging

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Close TB-09 with a project-wide "Review all" entry point, full local gates, an e2e spec, a small docs-pass, and staging acceptance. |
| References | TB-09.a, TB-09.b; `context/user-stories/10-windows.md` (Review all behavior); `context/USER_STORIES.md`; `context/technical-requirements/data-model.md` §6.2. |
| Includes | Frontend: `RefreshReviewAllModal` opened from the Windows tab header that lists every drifted / deactivated ref across all window types, grouped by window type and element, with per-entry "Review" buttons that open the TB-09.b dialog scoped to that slot. **No** bulk Update-all action. Empty-state when nothing has drifted. Hidden in Viewer / locked. New Playwright e2e spec `tests/e2e/windows-tb-09.spec.ts` driving sign-in -> seed Frame catalog row -> create project + pick frame -> patch catalog row to bump current version -> open Review all -> open one slot dialog -> Update one field, Keep one overridden -> Apply -> Save -> reload -> assert via API that the saved slice has bumped `catalog_version_id` and preserved `local_overrides`. Targeted docs-pass on `context/technical-requirements/api.md` (add refresh endpoint) and `context/user-stories/10-windows.md` if US-WIN-11 behavior diverged. Update the consolidated TB-09 lessons entry. |
| Tests | All existing suites; new e2e stable. `make lint`, `make typecheck`, `make test`, `make e2e`. |
| Browser check | Re-run TB-09.b happy path against staging Render after local gates pass. |
| Lessons | Single consolidated TB-09 entry covering drift backend (TB-09.a), per-entry dialog (TB-09.b), and Review all (TB-09.c). Record why refresh is explicit and per-entry, and any behavior that should change once Materials / Envelope refresh lands. |

### TB-10 - Envelope Assembly Skeleton

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Envelope tab can create one assembly with layers and segments, even before material picking. |
| References | `context/user-stories/20-envelope.md`; `context/technical-requirements/data-model.md` (assemblies/layers/segments); `context/UI_UX.md` (canvas). |
| Includes | Assemblies document shape; assembly sidebar; header; canvas with layer/segment layout; add/edit/delete layer and segment; locked/public read-only states. |
| Tests | Assembly/layer/segment validation; at-least-one layer/segment guards; UI state tests only if canvas state becomes complex. |
| Browser check | Create wall assembly, add layers and segments, edit thickness, reload draft/save, confirm read-only public view. |
| Lessons | Record canvas simplifications versus V1. |

### TB-11 - Material Pick And Effective R/U Display

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | One assembly segment can pick a material and show backend-owned effective R/U values. |
| References | `context/user-stories/20-envelope.md` (material pick + R/U); `context/technical-requirements/data-model.md` (project materials, overrides). |
| Includes | Project Materials de-dup; material bookshelf picker; local material overrides; backend effective R/U calculation service; stale/loading/error display in the assembly header. |
| Tests | Project-material de-dup; local override rules; R/U calculation fixtures; no frontend recomputation of domain values. |
| Browser check | Pick material into segment, edit a copied value, confirm R/U updates and persists through Save/reload. |
| Lessons | Record calculation assumptions and any PH convention choices. |

### TB-12 - Specifications And Asset Attach

| Field | Plan |
|---|---|
| Type | HITL if R2 credentials or local object-storage substitute are missing |
| Status | [ ] Not started |
| Goal | Datasheets and photos attach to project materials/segments through the generic asset backbone. |
| References | `context/user-stories/20-envelope.md` (Specifications sub-tab); `context/technical-requirements/data-model.md` (`project_assets`); `context/technical-requirements/api.md` (signed URL / upload). |
| Includes | `project_assets`; upload metadata; signed URL or local dev substitute; Specifications sub-tab; per-material datasheet/spec status; per-segment photos; detach semantics. |
| Tests | Asset metadata validation; attach/detach reference behavior; signed URL permission/scope; no hard-delete on detach. |
| Browser check | Upload datasheet and site photo, attach them, reload, view as public reader, detach without deleting older references. |
| Lessons | Record storage dev setup and deletion semantics. |

### TB-13 - Envelope Export

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Envelope data can be exported without implying HBJSON import. |
| References | `context/user-stories/20-envelope.md` (export boundary); `context/technical-requirements/api.md` (export endpoint shape). |
| Includes | Construction JSON/HBJSON construction export endpoint; download UI; validation against current document; clear separation from Model-tab HBJSON viewer uploads. |
| Tests | Export validates against fixtures; R/U conventions shared with TB-11; no import path mutates builder tables. |
| Browser check | Build one wall assembly, download construction export, validate it via backend test/fixture path. |
| Lessons | Record the one-direction PHN -> downstream model boundary. |

## Tracer-Bullet Slices [Phase 3 - HBJSON Model]

### TB-14 - HBJSON Upload And File Picker

| Field | Plan |
|---|---|
| Type | HITL for file-size cap confirmation if real project files exceed 50 MB |
| Status | [ ] Not started |
| Goal | Model tab can upload, list, select, and delete HBJSON files. |
| References | `context/user-stories/40-model-viewer.md` (file picker, upload UX); `context/technical-requirements/data-model.md` (`project_hbjson_files`); `context/technical-requirements/api.md` (upload/list/delete). |
| Includes | `project_hbjson_files`; asset metadata integration; active-file selection; upload/list/delete API; Model tab file picker; optional prompt to associate with a project version. |
| Tests | Upload validation; file-size/type checks; active-file selection; public read vs editor write permissions. |
| Browser check | Upload two HBJSON files, switch active file, delete one if unreferenced, confirm public user can download/view metadata but not upload. |
| Lessons | Record HBJSON size/performance observations from real files. |

### TB-15 - Model Data And Nonblank R3F Viewer

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Uploaded HBJSON renders as an interactive, nonblank 3D scene. |
| References | `context/user-stories/40-model-viewer.md`; `context/technical-requirements/frontend-viewer-units.md` (SI canonical values, conversion). |
| Includes | Backend `/model_data` extraction; SI canonical values; R3F canvas; camera/lighting/orbit controls; loading/error states; basic select. |
| Tests | Model extraction fixtures; SI unit conversion; frontend viewer state only where non-trivial; Playwright screenshot/canvas nonblank check. |
| Browser check | Upload HBJSON, load scene, orbit/pan/zoom, select an element, verify no blank canvas on desktop and mobile-ish viewport; record parse-time and first-paint numbers against a real-sized project file as a baseline for later slices. |
| Lessons | Record parser performance and any geometry compromises. |

### TB-16 - Viewer Viz, Measure, Color-By, Info Panel

| Field | Plan |
|---|---|
| Type | AFK, with design review if visual choices feel uncertain |
| Status | [ ] Not started |
| Goal | Model viewer reaches MVP parity for core inspection workflows. |
| References | `context/user-stories/40-model-viewer.md` (viz/measure/color-by/info); `context/technical-requirements/frontend-viewer-units.md`; `context/UI_UX.md`. |
| Includes | Viz state machine; Select/Measure tools; color-by modes and legend; element info panel; display-unit conversion. |
| Tests | Viewer state machine; unit format/parse helpers; color grouping logic; targeted browser checks for tool modes. |
| Browser check | Switch viz mode, color by construction, measure a distance, select an element, inspect converted fields. |
| Lessons | Record V1 parity decisions and any viewer controls deferred. |


## Tracer-Bullet Slices [Phase 4 - Refine]

### TB-17 - MCP Write Path And Edit Lease

| Field | Plan |
|---|---|
| Type | AFK (MCP transport, tokens, and read tools landed in TB-04b) |
| Status | [ ] Not started |
| Goal | Claude can patch a draft, save it through the version system, and the browser reflects the change under an edit lease. |
| References | `context/technical-requirements/llm-mcp-schema.md` (write tools, scopes); `context/technical-requirements/save-versioning.md` (ETag, save service); `context/user-stories/50-settings-ops-llm.md` (edit lease UX). |
| Includes | Write-scope tools (patch/save) extending TB-04b's MCP surface; ETag rules shared with REST; MCP/browser edit lease indicator; audit logging for MCP writes. |
| Tests | Write scope rejected for read-only tokens; MCP and REST share ETag rules; edit lease freezes browser write controls; audit row is written. |
| Browser check | Run MCP edit against Rooms or Status, observe browser lease/freeze, reload, confirm saved change appears. |
| Lessons | Record write-path tool boundaries, lease UX, and any prompt/tool ergonomics issues uncovered in real use. |

### TB-18 - Mechanical Tables Completion

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Equipment tab has Rooms, ERVs, Fans, and v1 placeholders for Thermal Bridges/Pumps. |
| References | `context/user-stories/30-tables-equipment.md`; `context/technical-requirements/data-model.md` (ERV/Fan tables, Rooms reference); `context/technical-requirements/data-table.md`. |
| Includes | ERV and Fan document tables; Rooms referential link to ERV; placeholder Thermal Bridges and Pumps routes/views; shared DataTable reuse; JSON download for each full table. |
| Tests | ERV/Fan validation; name/number uniqueness; Rooms reference handling when ERV is deleted; table slice downloads. |
| Browser check | Add ERV, assign it to a room, add fan, Save/reload, confirm placeholders route and public read-only state. |
| Lessons | Record mechanical scope intentionally deferred to v1.1+. |

### TB-19 - Release Hardening And First Real Import

| Field | Plan |
|---|---|
| Type | HITL for real V1 project selection and any production credential cut-over |
| Status | [ ] Not started |
| Goal | MVP can run a full smoke on staging with one imported V1 project. |
| References | `context/user-stories/90-open-questions.md`; `context/ENVIRONMENT.md`; `context/PRD.md` (MVP scope/exit criteria). |
| Includes | Final smoke script; OpenAPI/schema docs generated from code; one V1 import script path; performance/bundle sanity against the TB-15 baseline; unresolved question triage; docs cleanup. |
| Tests | Full `make test`, lint/format gates, Playwright e2e smoke, import fixture validation, public read/write-negative smoke. |
| Browser check | On staging, sign in, open seed project, import/open one V1 project, edit/save one table, upload/view HBJSON, verify public read-only URL. |
| Lessons | Record deployment friction, import assumptions, and remaining post-MVP work. |

### TB-20 - DataTable Polish And Mutation Hardening

| Field | Plan |
|---|---|
| Type | AFK unless table interaction scope is re-prioritized |
| Status | [ ] Not started |
| Goal | Resolve DataTable interaction polish deliberately deferred from P1-08 through P1-10. |
| References | `context/technical-requirements/data-table.md`; `context/user-stories/30-tables-equipment.md`; P1-09/P1-10 ledger notes. |
| Includes | Visible Rooms filter/search controls that drive the existing `ViewState.filter`; stacked sort/filter/group toolbar parity; inline single-select cell editor; FIFO draft mutation queue; paste-review dialog; option-manager stale-open conflict handling; drag-reorder/palette-popover/delete-subdialog polish; cell-local error UI; shared structured validation results; validator consolidation. |
| Tests | Filter/search unit and browser checks in editor and Viewer; queued mutation ordering; single-select edit/paste/recovery; option-manager conflict handling; cell-local error regression. |
| Browser check | Public Viewer can sort, filter/search, and copy; editor can filter/search, inline-edit text, number, and single-select cells; rapid paste/edit operations preserve draft order without stale ETag fallout. |
| Lessons | Record which spreadsheet-like controls are genuinely needed before broad catalog-scale tables. |

## Progress Ledger

| Phase | Slice | Status | Last updated | Verification evidence |
|---|---|---|---|---|
| 01 | TB-00 | Complete | 2026-05-12 11:58 EDT | `make smoke`; `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e`; Browser check at `http://127.0.0.1:5173/` passed with live `/api/v1` health/version and no console warnings/errors. |
| 01 | TB-01 | Complete | 2026-05-12 12:46 EDT | `make migrate`; `make seed-dev-user`; `cd backend && uv run ruff check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e`; Browser check at `http://127.0.0.1:5173/` passed for root sign-in redirect, editor sign-in, dashboard reload/session persistence, and signed-out protected-route redirect. |
| 01 | TB-02 | Complete | 2026-05-12 17:13 EDT | Local path complete: `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e`. Staging Render deploy verified at `https://ph-navigator-v2-staging.onrender.com`: sign in as seeded editor, create `Staging Smoke Test`, open `/projects/e5365d5e-a2b0-4059-9c7a-a212600a0574/status`, sign out, reopen the project URL, and confirm read-only public shell with edit controls hidden. |
| 01 | TB-03 | Complete | 2026-05-12 16:04 EDT | `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make seed-dev-user`; `make e2e`; in-app Browser at `http://127.0.0.1:5173/projects/e64eb07f-d37b-4350-896d-63287df0220c/status` showed the populated editor status timeline with no console warnings/errors after sign-in/navigation. |
| 01 | TB-03.5 | Complete | 2026-05-12 18:08 EDT | `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test` (12 tests); `cd frontend && npm run build`; Playwright browser smoke at `http://127.0.0.1:5173/dashboard` -> `/projects/114b7e10-05d6-41d1-acae-981dcb346e2f/status` verified dashboard and editor Status tab after simplify cleanup, with no console errors. Earlier smoke also verified public read-only Status tab, sign-in transition to editor controls, and populated default template. |
| 01 | TB-04 | Complete | 2026-05-12 19:24 EDT | `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test` (17 tests); `cd frontend && npm run build`; `make e2e` against fresh local API `:8001` via Vite proxy `:5173` passed for Status plus Rooms draft add/reload. Staging Render verification: signed in as editor, opened `Staging Smoke Test`, added room `test` on Equipment/Rooms, confirmed `Unsaved Rooms draft restored` and the room row rendered in the live app. |
| 01 | TB-04b | Complete | 2026-05-12 21:10 EDT | `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (35 passed after simplify cleanup); local MCP protocol smoke against `http://127.0.0.1:8002/mcp/` using a project-scoped bearer token verified `list_projects`, `get_project`, `list_status_items`, and `get_document`; automated in-process MCP tests cover saved/draft `get_document`, `get_table`, read-token metadata shape, read-only `replace_table` structured rejection, and write-only token-scope rejection; Playwright dashboard cross-check at `http://127.0.0.1:5173/dashboard` showed the same `MCP Smoke Project` / `MCP-001` with no post-login console errors. |
| 01 | TB-05 | Complete | 2026-05-13 08:48 EDT | `docker compose up -d db`; `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (43 passed); `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test` (17 passed); `cd frontend && npm run build`; `make seed-dev-user`; `make e2e` passed with TB-05 browser path covering Rooms draft Save, Save As submitted/locked version, URL-scoped Open of the Working version, Lock, blocked locked edit, Project JSON and Rooms JSON downloads, and diff modal. In-app Browser at `http://127.0.0.1:5173/projects/745bfd13-fdc2-4884-81c4-d6bc5d5f62a7/status` showed the locked submitted version header controls and clean state; only console error was the expected pre-login `/auth/session` 401. |
| 01 | TB-06 | Local complete; staging pending | 2026-05-13 10:51 EDT | Previous TB-06 local evidence still stands. P1-00 rerun and current staging blocker are recorded in `docs/plans/2026-05-13/phase-1-baseline-gap-matrix.md` G-01. |
| P1 | P1-00 | Complete | 2026-05-13 11:20 EDT | Baseline matrix recorded in `docs/plans/2026-05-13/phase-1-baseline-gap-matrix.md`; local checks rerun; TB-06 staging blocker tracked as G-01 until staging credentials are available or staging is re-seeded. |
| P1 | P1-01 | Complete | 2026-05-13 11:39 EDT | Backend project-document service split; registered Rooms table contract added; unsupported table names fail through registry for REST and MCP; simplify cleanup moved body-size calculation to document helpers, made registry diff order deterministic, shared MCP HTTP error mapping, avoided full-document dump/validation on unchanged Rooms replacements, and removed duplicate saved-version loading from draft diff. Verified with `cd backend && uv run ruff check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (46 passed). |
| P1 | P1-02 | Complete | 2026-05-13 | Added document draft summary API and project-document frontend version chrome; project header no longer imports Equipment/Rooms state; Rooms JSON moved to Equipment/Rooms. Verified with backend/frontend tests, build, and local E2E. |
| P1 | P1-03 | Complete | 2026-05-13 | Approved closed after MVP re-scope around raw JSON recovery plus strict typed editing failure. Current implementation keeps document-level read-safe envelope/recovery panel as an aid, not a full schema-migration contract. Verified with `make lint`; `make typecheck`; `make test` (backend 50 passed, frontend 23 passed); `cd frontend && npm run build`; browser Playwright recovery check at `http://127.0.0.1:5173/projects/.../equipment` with intercepted unsupported-schema `/draft` response. |
| P1 | P1-04 | Complete | 2026-05-13 | BLDGTYP token/font foundation and class-based app primitives landed for current Phase 1 scaffold surfaces. Follow-up review/simplify addressed theme-aware graph paper, light-only `color-scheme`, token stylesheet load order, active font weights, visible `/ v2` markup, read-safe link reuse, status-empty grid layout, icon-button sizing, and narrowed primary button cascade. Verified with `cd frontend && npm run format:check`; `cd frontend && npm run lint`; `cd frontend && npm test` (23 passed); `cd frontend && npm run build`; `cd frontend && npm run test:e2e` (2 passed). Browser screenshots captured for sign-in, dashboard, project shell/Status, Equipment/Rooms, and version popover/dialog at desktop plus narrow-tablet where applicable; Settings is deferred to P1-07 because that UI does not exist yet. Accepted on Render.com by Ed on 2026-05-13: GUI and styling look great. |
| P1 | P1-05 | Complete | 2026-05-13 | First shell-completion pass: Catalogs dropdown routes to placeholder catalog pages; topbar breadcrumbs render on catalog and project routes; dashboard rows show section/count, BT number, project, client, relative last-modified, and backend list ordering now follows documented `bt_number DESC`; Viewer and read-safe Viewer shell use a compact Read-only pill. Review follow-up fixed schema-doc numbering, removed inert dashboard pin/menu placeholders until real semantics exist, tightened empty-dashboard a11y, split backend ordering coverage, and made the catalog-route test less brittle. Simplify cleanup moved catalog registry/menu ownership into the Catalogs feature, kept `WorkspaceTopbar` layout-only with nav/account slots, centralized catalog path use, removed stale topbar/banner CSS, computed dashboard relative-date `now` once per render, and replaced brittle E2E `.page-heading` scoping with the header button's accessible name. Verified with `cd backend && uv run ruff check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (51 passed); `cd frontend && npm run format:check`; `cd frontend && npm run lint`; `cd frontend && npm test` (24 passed); `cd frontend && npm run build`; `cd frontend && npm run test:e2e` (2 passed). Browser plugin reached sign-in but could not type into `input[type=email]`; Playwright fallback captured dashboard, Catalogs, editor shell, and Viewer shell screenshots at `127.0.0.1:5173`. Ed confirmed P1-05 complete on 2026-05-13. Pin/reorder remains deferred pending `user_project_preferences` persistence/API. |
| P1 | P1-06 | Complete | 2026-05-13 | Local implementation/browser pass landed: Status now keeps empty state/template apply, current-step timeline, add/edit/delete/state/date behavior, keyboard/up-down reorder, public Viewer rendering, MCP-readable REST posture, plus sanitized Markdown display with edit-modal preview, modal delete confirmation, and HTML5 drag/drop reorder using fractional `order_index`. Review/simplify follow-up added sanitizer regression tests, shared Markdown policy constants, delete-dialog error placement, segmented-control pressed state, empty-state copy cleanup, shared `order_index` helper, redundant drag-state removal, adjacent-drop no-op guards, and same-reference delete-cache no-op handling; inline title edit, `⋯` row menu, icon-library drag handle, touch DnD, richer drop-target affordance, and Markdown lazy-loading are deliberate MVP deferrals. Verified with `cd backend && uv run pytest tests/test_project_status.py` (6 passed); `cd frontend && npm run format:check`; `cd frontend && npm run lint`; `cd frontend && npm test` (30 passed); `cd frontend && npm run build`; `cd frontend && npm run test:e2e` (2 passed). In-app browser smoke at `http://127.0.0.1:5173/projects/.../status` verified Markdown preview/display and Status layout; only console error was the expected pre-login `/auth/session` 401. Ed confirmed P1-06 complete on 2026-05-13. |
| P1 | P1-07 | Complete | 2026-05-14 | Local implementation landed: Project Settings modal opens from editor project header and remains hidden for Viewers; metadata edits go through `PATCH /api/v1/projects/{id}` with self-safe BT-number uniqueness, HTTP(S) Dropbox URL validation, owner/read-only metadata display for editors only, query cache refresh, and `project_update_metadata` audit logging only when fields materially change; MCP token UI lists active/revoked tokens, issues scoped tokens with plaintext shown once plus copy control, and revokes tokens through existing REST admin routes. Backend MCP summaries exclude detail-only `owner_display_name` to preserve the MCP `ProjectSummary` contract, public Viewer project detail returns `owner_display_name: null`, MCP token query cache clears on sign-in/sign-out boundaries, and certification-program diffing is order-insensitive. Review/simplify follow-up added explicit required-field PATCH rejection, shared project metadata validators, dynamic metadata UPDATE SQL, folded owner display loading, shared certification-program fieldset, local settings-save list-cache update, safer clipboard fallback, and less brittle settings tests; large settings-modal split remains deferred before substantial new Settings/MCP work. Verified after simplify with `cd backend && uv run ruff format --check features/projects tests/test_projects.py`; `cd backend && uv run ruff check features/projects tests/test_projects.py`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (60 passed); `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test` (31 passed); `cd frontend && npm run build`. Earlier local browser smoke at `http://127.0.0.1:5173/projects/1caf924d-cd7f-4b9c-8fa8-34b984fc1792/status` signed in as editor, opened Settings, issued/revoked a token with one-time plaintext display, confirmed Viewer has zero Project Settings buttons, and confirmed the revoked token returns `401 Unauthorized` on the next MCP request. Staging acceptance on 2026-05-14: re-seeded `ed@example.com`, direct login succeeded with `200` (request id `afe93bcb-ffeb-4221-9884-51e4eed7dc67`), created and patched project `3bfaaf7b-c70e-4655-addf-b371bf4bd261`, browser Settings issued and revoked an MCP token with one-time plaintext display, fresh Viewer context showed zero Project Settings buttons and no console errors, and a revoked token failed the next MCP request with `401 invalid_token` (request id `bfad7a3a-51ba-4e66-ae7a-75fb85020629`). Follow-up for P1-13/TB-04b staging hardening: active-token MCP reads currently return `421 Invalid Host header` on `/mcp/` (request id `d220be53-5ea0-47b7-8ac5-509d68ad104c`), while unauthenticated `/mcp/` reaches FastMCP with `401`; verify Render MCP URL/env/host handling before release. |
| P1 | P1-08 | Complete | 2026-05-13 | Shared `frontend/src/shared/ui/data-table/` extraction started and Rooms now renders through `<DataTable>` instead of `TablePrimitiveStub`; review/simplify cleanup fixed immediate paste/a11y/filtered-empty issues and tightened table helper reuse/hot paths. Verified with `cd frontend && npm run format:check`; `cd frontend && npm run lint`; `cd frontend && npm test` (44 passed); `cd frontend && npm run build`. Ed accepted P1-08 complete on 2026-05-13; remaining table parity work is tracked in P1-09/P1-10 follow-up scope. |
| P1 | P1-09 | Complete | 2026-05-13 20:42 EDT | Initial local implementation landed for shared single-select display/filter/copy/paste/sort behavior, paste match/create with new options in the same write op, Rooms option-color pills/missing warnings, and the Floor/Zone header option manager for rename, reorder, recolor, delete-clear, and delete-merge payloads. Review follow-up fixed missing-option clipboard round-tripping, required Floor delete clearing, typed `newOptions`, key-based field lookup, shared option creation, and referenced-option replacement assertions. Simplify cleanup removed duplicate option/id helpers, aligned option-label duplicate checks, made equipment `SingleSelectOption` an alias of the shared `FieldOption`, avoided O(rows*writes) paste application, and removed duplicate option scans in Rooms pill rendering. Verified with `cd frontend && npm run format:check`; `cd frontend && npm run lint`; `cd frontend && npm test` (50 passed); `cd frontend && npm run build`; local browser check at `http://localhost:5173/projects/.../equipment` created/pasted `Level 2`, renamed/recolored it to `Level Two`, reordered it ahead of `Ground`, and confirmed Floor sorting follows option order. Ed accepted deferring drag-reorder/palette-popover/delete-subdialog polish, inline single-select cell editor, FIFO draft mutation queue, paste-review dialog, and option-manager stale-open conflict handling on 2026-05-13; those are routed to TB-20. |
| P1 | P1-10 | Complete | 2026-05-13 20:49 EDT | Initial Rooms MVP pass started on the shared DataTable path: backend now requires floor-level refs, preserves duplicate-number/missing-option validation, rejects non-empty `erv_unit_ids` until the ERV table contract exists, and table downloads emit keyed slices (`{ "rooms": [...] }`); frontend add-room defaults to the lowest-order Floor option, simple text/number cells emit inline `cell` writes through the same replace-slice path, numeric clears normalize to `0`, Tab commits inline edits, Rooms payloads are preflighted before draft writes, ERVs are display-only/deferred, notes live behind a row-detail expander, and delete uses the app modal pattern. Review/simplify disposition from `docs/code-reviews/2026-05-13/p1-10-code-review.md`: fixed H1/H2/H3, M1/M3/M5, L1/L2/L4; simplify cleanup then moved Delete into the active Room modal, shared Rooms draft commit/error handling, reused table value coercion/formatting, skipped no-op inline edits, and centralized room normalization. Deferred auto-suffix, single-select inline editor, cell-local error UI, validator consolidation, structured validation results, and FIFO write queue to later P1 table work. Verified with `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd frontend && npm run format:check`; `cd frontend && npm run lint`; `cd frontend && npm test -- --run` (58 passed); `cd frontend && npm run build`; `make migrate`; `make seed-dev-user`; `cd backend && uv run pytest` (63 passed); `cd frontend && npm run test:e2e` (2 passed); targeted local browser smoke created Rooms rows, committed inline text edit on Tab, confirmed natural room-number sort, deleted through the confirmation modal, saved, discarded an unsaved draft, created a locked submitted version via Save As, downloaded Project JSON and Rooms JSON, opened Rooms diff, and verified public Viewer read-only sort/copy with no edit affordances. Ed accepted deferring visible filter/search controls on 2026-05-13; the concrete follow-up is routed to TB-20 and must add UI controls that drive `ViewState.filter` plus browser checks for editor and public Viewer filtering. |
| P1 | P1-11 | Complete | 2026-05-13 20:42 EDT | Initial frontend UX pass landed: draft restore/discard modal, dirty-version-switch Save/Save As/Discard gate, `beforeunload` warning for dirty drafts, stale Save conflict modal, shared project-document conflict classifiers, same-session draft-write prompt suppression keyed by draft ETag, and Rooms live lock downgrade that freezes open local edits instead of dropping them. Existing two-tab E2E was updated for the current DataTable row-open gesture. Review follow-up fixed the local-draft marker semantics, suppressed duplicate inline conflict copy while modal exits are open, and documented the recovered-draft timing heuristic plus Save As switch-target behavior. Simplify cleanup then bounded the local draft marker cache per project/version, keyed recovered-draft prompt initialization by draft ETag, reused shared date formatting, centralized document error-code literals, collapsed duplicate Equipment conflict state into one edit blocker, and parallelized lock-conflict query invalidations. Undo invalidation is deferred because no undo stack exists yet; MCP edit-lease UX is routed to TB-17. Verified with `make db-up`; `make migrate`; `make seed-dev-user`; local backend/frontend servers; `cd frontend && npm run format:check`; `cd frontend && npm run lint`; `cd frontend && npm test -- --run` (62 passed); `cd frontend && npm run build`; `cd frontend && npm run test:e2e` (2 passed). Manual browser checklist on 2026-05-13 verified recovered-draft restore, recovered-draft prompt discard, header discard, dirty beforeunload prevention, dirty version-switch modal with Save/Save As/Discard choices, discard-and-open target version, locked-version save conflict preserving local draft UI, stale-save conflict with Save As/discard exits while keeping the local draft visible, and the existing same-editor two-tab freeze/reload path. |
| P1 | P1-12 | Complete | 2026-05-13 20:58 EDT | Schema/OpenAPI baseline landed: backend now serves cached generated Pydantic schemas at `/api/v1/schemas/project-document/v1.json` and `/api/v1/schemas/room/v1.json`, with Room schema ownership routed through the registered table contract; FastAPI serves the versioned OpenAPI endpoint at `/api/v1/openapi.json`; frontend API errors append request IDs when the structured error envelope provides one; unsupported table downloads assert structured `request_id` behavior. Ed accepted deferring material/window-type schemas until those table contracts are implemented. Verification: `make migrate`; `cd backend && uv run pytest tests/test_schemas.py tests/test_project_document.py -q` (23 passed); prior full gates remain `cd backend && uv run pytest` (62 passed), `cd backend && uv run ruff check .`, `cd backend && uv run ty check`, `cd frontend && npm run lint`, `cd frontend && npm run format:check`, `cd frontend && npm test -- --run` (62 passed), `cd frontend && npm run build`, endpoint smoke for project-document schema, room schema, and OpenAPI, and `cd frontend && npm run test:e2e` (2 passed, covering normal Project JSON, Rooms JSON, and diff). Targeted local browser recovery smoke on 2026-05-13 created/saved a normal Rooms document, confirmed normal Project JSON download, Rooms JSON download, and diff, then corrupted the saved body to `schema_version=999`; the browser rendered Project format recovery with diagnostics, raw Project JSON download preserved the unsupported body, and authenticated browser fetches confirmed Rooms JSON and diff fail closed with `invalid_project_document` plus matching `X-Request-ID`/`request_id`. |
| P1 | P1-13 | Complete | 2026-05-14 | MCP transport-security hardening landed for the active-token staging `421 Invalid Host header` blocker: backend settings now expose `MCP_ENABLE_DNS_REBINDING_PROTECTION`, `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`, `RENDER_EXTERNAL_URL`, and `RENDER_EXTERNAL_HOSTNAME`; FastMCP receives explicit DNS-rebinding host allowlists derived from MCP URLs plus Render's external URL/hostname plus local defaults, with origin allowlists derived from MCP URLs/CORS. First redeploy evidence: staging health `200` (request id `44000b0d-3cb7-48b4-a811-613c69d0a572`), unauthenticated session structured `401 not_authenticated` (request id `fb95c3e1-891d-4f2e-ac5f-97c4ce7a9667`), staging CLI e2e passed (2 Chromium tests), and browser Settings smoke patched metadata, issued an active MCP token, revoked a second token, and confirmed Viewer has no Project Settings button. Second redeploy evidence: staging health `200` (request id `c2fc67a3-d51a-477e-b46a-71cefa097cd5`), unauthenticated session structured `401 not_authenticated` (request id `0781f025-05c5-43ba-b53f-1054013d3645`), staging token issue succeeded (request id `aec1a039-10c1-43c4-8b81-35fe389f2d39`), but active-token MCP read still returned `421`; Render logs showed `Invalid Host header: ph-navigator-v2.onrender.com`, so the follow-up now derives from Render's built-in external hostname instead of relying only on manually configured MCP URL env vars. Third redeploy evidence: health `200` (request id `0fcea900-b949-4e8e-b786-24fbbadc4e39`), unauthenticated session structured `401 not_authenticated` (request id `f1f2dc25-2dbb-4678-b129-03e9e9a0423f`), login `200` (request id `ac1ca526-0d3f-4c48-8fb6-38f8f0e372c5`), project create `201` (request id `9862e168-e091-4951-afc0-4fd20a3d8738`), token issue `201` (request id `67f9460a-effa-4c8b-9406-c9edf47d127e`), active-token MCP read passed `list_projects`, `get_project`, `list_versions`, `list_status_items`, `get_document`, and `get_table` against project `544faa6d-ff90-409b-897b-7a87c7198a62`, and the test token was revoked (request id `95eae472-a5eb-4b63-b7ba-15df717c9aba`). Requirements/evidence matrix recorded in `docs/plans/2026-05-14/phase-1-release-gate.md`. Local verification remains passed: `make db-up`; `make migrate`; `cd backend && uv run pytest tests/test_mcp.py -q` (6 passed); `make lint`; `make typecheck`; `git diff --check`; `make test` (backend 64 passed, frontend 62 passed); `cd frontend && npm run format:check`; `cd frontend && npm run build`; `make seed-dev-user`; `make e2e` (2 passed). Ed approved P1-13 as complete on 2026-05-14. |
| 02 | TB-07 | Complete | 2026-05-14 | Local backend implementation, lint, `uv run ty check`, `cd backend && uv run pytest` (70 passed including 6 new catalog tests); `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test -- --run` (65 passed); `cd frontend && npm run build`; `make migrate` applied `20260514_0007_catalog_materials`; in-app browser smoke at `http://127.0.0.1:5173/catalog/materials` signed in, added XPS, edited conductivity in place from 0.034 → 0.030 (same `current_version_id` confirmed), deactivated XPS, toggled "Show deactivated" and confirmed the deactivated row remains queryable for refresh-from-catalog with `Edit` disabled and `Reactivate` available. Zero console errors. |
| 02 | TB-08 | Split into TB-08.a–.d on 2026-05-14 | 2026-05-14 | See sub-slices below. |
| 02 | TB-08.a | Complete | 2026-05-14 | `cd backend && uv run alembic upgrade head` applied `20260514_0008` (rebadge materials.id to `rec` format) and `20260514_0009` (frame + glazing catalogs); `cd backend && uv run ruff format --check .`; `cd backend && uv run ruff check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (90 passed, +20 since TB-07: shared id-helper + frame + glazing contract tests); `cd frontend && npm run lint`; `cd frontend && npm run format`; `cd frontend && npm test -- --run` (66 passed); `cd frontend && npm run build`; `make seed-dev-user`; `cd frontend && npm run test:e2e` (2 passed); in-app Playwright browser smoke at `http://127.0.0.1:5173/catalog/frame-types` created `Skyline Ridge SR-3` (`rec7Mu2IxjnBDCHBI` / `framev_…`) and at `http://127.0.0.1:5173/catalog/glazing-types` created `Triple-Pane LowE Argon` (`rec2zQ0SQr7eSVd01` / `glazingv_…`); fresh material via `/catalog/materials` returned `recSD1AXmSiGU7NKE` / `matv_…` confirming new V2-created records also use the uniform `rec` shape; zero console errors across all three pages. |
| 02 | TB-08.b | Complete | 2026-05-14 | `ProjectDocumentV1` extended with typed `tables.window_types[]`: new Pydantic models `WindowTypeEntry`, `WindowElement`, `WindowElementFrames`, `FrameRef`, `GlazingRef`, `CatalogOrigin` in `features/project_document/document.py`. Document-level validator enforces unique window-type names (trim + case-insensitive); `WindowTypeEntry.model_validator` enforces span bounds, ordered spans, positive grid dimensions, and >=1 rows/cols/elements. New table contract at `features/project_document/tables/window_types.py` registered in `tables/registry.py`; `RegisteredTableResponse` widened to `RoomsSliceResponse \| WindowTypesSliceResponse`. New schema endpoint `/api/v1/schemas/window-type/v1.json`. New test module `tests/test_project_document_window_types.py` (7 tests: dimension/element guards, span bounds + ordering, unique-name trim/casefold, catalog_origin required-fields + `local_overrides` default, contract round-trip via generic draft routes including diff, schema endpoint contract, registry lookup). Existing supported-tables assertions in `tests/test_project_document.py` and `tests/test_mcp.py` updated to `["rooms", "window_types"]`. Verified: `cd backend && uv run ruff check .`; `uv run ruff format --check .`; `uv run ty check`; `uv run pytest` (97 passed, +7). No frontend in this slice. |
| 02 | TB-08.c | Complete | 2026-05-14 | New `frontend/src/features/windows/` feature module (types, api, hooks, query-keys, lib, `WindowsTab` route) plus minimal CSS layout. Wired into `ProjectTabContent` so `/projects/:id/windows` now renders a real page. Sidebar lists draft window types sorted via naturalSort; Add button creates a 1×1 element with all-null frame/glazing slots and a unique-name auto-suffix; plain HTML `<select>` pickers feed off `/api/v1/catalogs/frame-types` and `/api/v1/catalogs/glazing-types` (filtered to active rows); picking stamps `catalog_origin` with `catalog_table`, `catalog_record_id`, `catalog_version_id`, `catalog_schema_version`, ISO `synced_at`, and `local_overrides: []`. Inline U-value (W/m²K) edit on each picked ref is the override tracer: editing adds `"u_value_w_m2k"` to `local_overrides` (and keeps it there even when reverted to the catalog value). All writes go through whole-table replace-slice with `If-Match`/`If-Match-Version` ETag and invalidate the document draft summary. Locked-version and Viewer hide Add and disable picker controls. Unit tests cover naturalSort, unique-name auto-suffix, default-element shape, frame/glazing bookshelf-copy stamping, override tracking, and hand-entered no-op. Code-review disposition (`docs/code-reviews/2026-05-14/tb-08c-code-review.md`): P2-1 (add defaults drift from US-WIN-1 §8) addressed — Add now defaults to `"Unnamed Window Type"`, ` (2)`/` (3)` suffixes, and `row_heights_mm: [1000]`; P2-2 (Viewer/locked still firing authenticated catalog queries) addressed — `useFrameTypesQuery`/`useGlazingTypesQuery` gained an optional `enabled` arg and `WindowsTab` passes `canEdit`, eliminating 401 noise for public Viewer and avoidable firm-catalog fetches in read-only contexts. Simplify pass: unified `FrameSlot`/`GlazingSlot` into one generic `CatalogPickerSlot<TRow, TRef>` (removed ~60 dup lines), collapsed `applyFrameUValue`/`applyGlazingUValue` into `applyUValueOverride`, hoisted inline catalog-type imports, tightened `OVERRIDE_TRACKER_FIELD` to `keyof FrameRef & keyof GlazingRef`, and narrowed the sort `useMemo` dep to `sliceQuery.data?.window_types` so cache-replace no-ops do not re-sort. Verified locally after simplify: `cd frontend && npm run lint`; `cd frontend && npm run format`; `cd frontend && npm test -- --run` (74 passed, +8 in `features/windows/lib.test.ts`); `cd frontend && npm run build`; `make typecheck`. TB-08.d closed local browser smoke at `http://127.0.0.1:5173/projects/52761c30-147e-4737-ba45-98855256b384/windows` (sign in → add window type → pick Skyline Ridge SR-3 into top + Triple-Pane LowE Argon into glazing → both `data-testid` badges visible → edit frame U to 0.85 via type+Tab → override badge appears → Save → reload → draft banner gone, Clean indicator, badges + override + U-values persisted) and staging acceptance against `https://ph-navigator-v2-staging.onrender.com/projects/f4b7db40-b79f-47f4-8a90-b00b809f0103/windows` with the same sequence; saved-version slice round-trip on both confirmed `local_overrides: ["u_value_w_m2k"]` on frame.top and `[]` on glazing. Zero console errors. Deferred to a later extraction slice (do not duplicate-and-walk into TB-09): generic `useTableSliceQuery` / `useReplaceTableSliceMutation` factory to absorb the rooms/windows slice-API duplication; BroadcastChannel cross-tab sync and draft-stale/version-locked reconciliation for windows (parallel to `useRoomsDraftBroadcast` / Equipment `editBlocker`). |
| 02 | TB-08.d | Complete | 2026-05-14 | Closed TB-08 with full local gates plus staging acceptance. Verified: `make lint`, `make typecheck`, `make test` (backend 97 passed, frontend 74 passed), `make e2e` (3 chromium tests passed, now including new `tests/e2e/windows-tb-08c.spec.ts` covering the picker / override / save / reload / `local_overrides` round-trip). Docs-pass updated `context/technical-requirements/api.md` §9.12 to list `/api/v1/schemas/window-type/v1.json` as shipped and tightened the deferred-schemas note; `context/technical-requirements/data-model.md` §6.2 now names FrameRef/GlazingRef inline fields and points at the authoritative schema endpoint. Staging acceptance against `https://ph-navigator-v2-staging.onrender.com` signed in as `ed@example.com`, seeded Frame `reczYtOnQwBVZ06tf` (Skyline Ridge SR-3) and Glazing `rec6Gu9YFjZP5uSdD` (Triple-Pane LowE Argon), created project `f4b7db40-b79f-47f4-8a90-b00b809f0103`, added a window type, picked frame top + glazing, edited frame U-value to 0.85, Saved; after reload both `frame-top-catalog-origin` / `glazing-catalog-origin` badges, override badge, frame U=0.85, glazing U=0.6 all persisted; saved-version slice round-trip confirmed `local_overrides: ["u_value_w_m2k"]` on frame.top and `local_overrides: []` on glazing; zero console errors. |
| 02 | TB-08.e | Complete | 2026-05-14 | New `frontend/src/features/project_document/table-slice.ts` exposes `createTableSliceFeature<TSlice, TReplaceBody>({ tableName, missingVersionMessage })` returning `{ queryKeys, fetchSlice, replaceSlice, useSliceQuery, useReplaceSliceMutation }` with the existing saved/draft branch, `If-Match` / `If-Match-Version` ETag plumbing, `markLocalDraftTouched` + draft-summary invalidation, and the optional `onAcceptedSlice(slice, previous)` callback. `features/equipment/api.ts` + `hooks.ts` and `features/windows/api.ts` + `hooks.ts` migrated to the factory; existing public names (`fetchRoomsSlice`, `replaceRoomsSlice`, `roomsQueryKeys`, `useRoomsSliceQuery`, `useReplaceRoomsSliceMutation`, and the Windows equivalents) re-exported unchanged so `EquipmentTab` / `WindowsTab` / `useRoomsDraftBroadcast` and all existing tests keep working without edits. New `table-slice.test.ts` (3 cases) covers query-key shape, fetch-path saved/draft branching, and ETag header construction. Verified with `cd frontend && npm run lint`; `cd frontend && npm run format`; `cd frontend && npm test -- --run` (77 passed, +3 in the new factory test); `make typecheck` (backend ty check passed); frontend `tsc -b && vite build` still fails on the pre-existing `tests/e2e/_helpers.ts:37` `string \| undefined` error from before this slice (confirmed unchanged by stashing the diff). |
| 02 | TB-09 | Split into TB-09.a–.c on 2026-05-14 | 2026-05-14 | See sub-slices below. |
| 02 | TB-09.a | Complete | 2026-05-14 | New `features/project_document/refresh.py` walks every `WindowTypeEntry → WindowElement → FrameRef / GlazingRef` (only refs with a `catalog_origin`), batch-loads catalog rows by `(catalog_table, catalog_record_id)` through the existing frame/glazing repositories (which return soft-deleted rows too), and emits per-slot `RefreshSlotReport` records keyed by `(window_type_id, element_id, slot)` with `state ∈ {in_sync, drifted, source_deactivated}`, `pinned_catalog_version_id`, `current_catalog_version_id`, `local_overrides`, and a per-field `RefreshFieldDelta` list (`key`, `ref_value`, `catalog_value`, `is_overridden`). Comparable-field tuples are hard-coded per catalog so future typed-column growth fails loudly instead of silently. New editor-only `GET /api/v1/projects/{project_id}/versions/{version_id}/refresh/window-types?source=draft\|version` returns `WindowTypesRefreshReport` (project_id, version_id, source, version_etag, draft_etag, slots). Code-review disposition (`docs/code-reviews/2026-05-14/tb-09a-code-review.md`): P2 (drift semantics disagreed with two stable context docs) addressed by reconciling `context/technical-requirements/data-model.md` §7.4 and `context/user-stories/10-windows.md` US-WIN-11 criterion 1 + Q-WIN-11.1 to bless the TB-09 contract — drift is version-mismatch OR field-delta because in-place catalog edits (§7.3) patch the current version row without bumping `current_version_id`; P3 (test matrix overstated) addressed by adding `test_drifted_on_new_current_version_with_identical_fields` that forks a new current version with identical typed values via direct SQL and asserts `state=drifted` with all `ref_value == catalog_value`, and by clarifying the unauthenticated-rejection test docstring (V2 v1 has no logged-in non-owner state — editor access is "any signed-in user", so unauthenticated is the only Viewer-equivalent path). Seven new tests in `tests/test_project_document_refresh.py` cover in-sync, drifted-by-field, drifted-by-version-only, overridden-field flag, soft-deleted → `source_deactivated`, hand-entered exclusion, and unauthenticated rejection. Verified with `docker compose up -d db`; `cd backend && uv run alembic upgrade head`; `uv run ruff check .`; `uv run ruff format --check features/project_document/refresh.py features/project_document/routes.py tests/test_project_document_refresh.py`; `uv run ty check`; `uv run pytest tests/test_project_document_refresh.py -q` (7 passed); `uv run pytest -q --no-cov` (105 passed across the full backend suite). |
| 02 | TB-09.b | Not started | 2026-05-14 | Per-entry refresh dialog with Keep mine / Update from catalog. |
| 02 | TB-09.c | Not started | 2026-05-14 | Review all report, e2e, docs-pass, staging acceptance. |
| 02 | TB-10 | Not started | 2026-05-12 | - |
| 02 | TB-11 | Not started | 2026-05-12 | - |
| 02 | TB-12 | Not started | 2026-05-12 | - |
| 02 | TB-13 | Not started | 2026-05-12 | - |
| 03 | TB-14 | Not started | 2026-05-12 | - |
| 03 | TB-15 | Not started | 2026-05-12 | - |
| 03 | TB-16 | Not started | 2026-05-12 | - |
| 04 | TB-17 | Not started | 2026-05-12 | - |
| 04 | TB-18 | Not started | 2026-05-12 | - |
| 04 | TB-19 | Not started | 2026-05-12 | - |
| 04 | TB-20 | Not started | 2026-05-13 | DataTable polish and mutation-hardening follow-up accepted as owner for P1-09 deferrals and the P1-10 visible filter/search controls. |

## Lessons Learned Log

Append one entry per slice. Keep failed paths in the log; do not rewrite
history down to only the winning approach.

### Entry Template

```text
Slice:
Date:
What changed:
Why:
What we tried:
What did not work:
What worked:
Verification:
Follow-up:
```

### TB-00

```text
Slice: TB-00
Date: 2026-05-12
What changed: Added versioned `/api/v1/health` and `/api/v1/version`, frontend live service-status screen, backend DB connectivity script, Alembic baseline revision, CI workflow, and a committed npm lockfile for CI.
Why: TB-00 needs a real backend/frontend tracer before auth and project shells land.
What we tried: Backend lint/tests, frontend lint/unit/build, local dev servers, in-app Browser verification, `uv run alembic upgrade head`, `make smoke`, and CLI Playwright E2E.
What did not work: Initial local Docker daemon was not running, so Postgres-dependent Alembic and `make smoke` failed. After Docker started, V1's `ph-navigator-postgres` already occupied host port 5432. CLI Playwright initially could not launch because its Chromium binary was not installed locally, then exposed an ambiguous `getByText("tb-00")` locator. Local `npm install` warned that Node 20.18.0 is below one dependency's preferred `20.19+`/`22.13+` engine floor.
What worked: Keep V2 on a separate Postgres 16 container and volume, published on host port 5433 (`phn-v2-postgres`, `5433->5432`), while V1 keeps `ph-navigator-postgres` on host port 5432. Backend route contracts passed, DB smoke passed, Alembic baseline applied, frontend service-status fetch passed, production build passed, CLI Playwright E2E passed after exact locator fix, and the in-app Browser verified the rendered status page against live backend data with no console warnings/errors.
Verification: `make smoke`; `make migrate`; `docker ps` showed `phn-v2-postgres` on `5433->5432` and `ph-navigator-postgres` on `5432->5432`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e`; Browser at `http://127.0.0.1:5173/` showed `ok`, `ph-navigator-v2`, `tb-00`, `v1`, and `0.1.0`; Refresh re-fetched successfully.
Follow-up: Real staging/production Postgres credentials are deferred to TB-02 deploy setup. TB-01 should only add local seed-user credentials and auth/session secrets needed for sign-in development.
```

### TB-01

```text
Slice: TB-01
Date: 2026-05-12
What changed: Added users/sessions/action-log schema, Argon2id password hashing, seed-user CLI, login/session/logout API, request-id and structured-error envelopes, mutating-route Origin checks, frontend sign-in route, protected empty dashboard shell, and auth E2E coverage.
Why: Editors need a real server-side session boundary before project creation, project shells, and write routes land.
What we tried: Auth repository/API tests, frontend guard tests, local migration, dev-user seeding, CLI Playwright E2E, and in-app browser verification.
What did not work: Logging failed sign-ins inside a transaction that raised immediately rolled back the audit row; fixed by committing the failed-login action before raising the structured 401. Backend auth tests truncate the local auth tables, so `make seed-dev-user` must run after backend tests before browser/E2E sign-in checks. The root `next=/` redirect looped back to sign-in after login until the sign-in handler normalized root to `/dashboard`. Follow-up review also found an unknown-email timing oracle, an unversioned `/api/health` leftover, optional DB-backed auth tests, an unsafe seed-user script, dead TB-00 frontend status client code, and a concurrent-login race against the one-active-session partial unique index.
What worked: Argon2id via `argon2-cffi`, raw SQL repositories, a partial unique index for one active session per user, `X-Request-ID` response propagation, generic failed-login copy, HTTP-only session cookies, and a narrow dashboard shell with disabled New Project placeholder. Follow-up cleanup kept login verification outside the write transaction, verifies a valid dummy Argon2id hash for unknown users, removed the unversioned health route, guarded local seed-user reset, locked the user row during login session swaps, removed dead TB-00 frontend client code, and aligned tests/router usage with local helpers. Final docs pass corrected the canonical docs to actual implementation names/settings (`phn_session`, `make seed-dev-user`, Argon2 parameters, CORS origins, UUID auth tables, migration/index names) and separated implemented TB-01 ops from Phase 0 targets still owned by later slices.
Verification: `make migrate`; `make seed-dev-user`; `cd backend && uv run ruff check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e`; in-app Browser at `http://127.0.0.1:5173/` showed `/sign-in?next=%2F`, signed in as `ed@example.com`, rendered `/dashboard` with `Ed May` and `No projects yet`, preserved the session on dashboard reload, and redirected a signed-out protected dashboard request back to sign-in.
Follow-up: TB-02 can reuse the auth dependency and dashboard shell; project creation should add real dashboard data and replace the disabled New Project button. TB-02 owns proxy-aware client IP, JSON app logs, and the first project access-check seam. TB-03/TB-04 must not ship editable state without the in-place re-auth/modal behavior, and TB-06 should revisit session-row locking under same-editor multi-tab traffic. Keep future docs passes focused on correcting source-of-truth values after implementation, not restating obvious diffs.
```

### TB-02

```text
Slice: TB-02
Date: 2026-05-12
What changed: Added `projects` and `project_versions` schema, initial "Working" version creation with an empty `ProjectDocumentV1` skeleton, dashboard project list/create, BT-number availability checks, project detail/version metadata, a first `require_project_access(project_id, mode)` seam, and a public read-only project shell with edit controls hidden.
Why: Editors need a real project shell before Status items, document drafts, version-save behavior, catalogs, and model uploads can land.
What we tried: Raw-SQL repository/API tests, frontend route/state tests, local migration, CLI Playwright E2E, and an attempted in-app Browser MCP check.
What did not work: The first backend response model leaked an internal `owner_id` column from the detail query; fixed by narrowing the repository projection. Playwright strict locators treated `PHI` as ambiguous with `Phius`, and the BT-number text check matched both the title and metadata; fixed by exact checkbox and metadata assertions. The in-app Playwright MCP browser was locked by an existing `mcp-chrome` profile, so browser verification used CLI Playwright only. The first Render split-origin staging deploy accepted login but the browser did not retain the API cookie because `SameSite=Lax` is insufficient across separate frontend/backend default subdomains.
What worked: Keeping ownership as a dashboard filter only, while public project reads go through the same access seam and return `access_mode='viewer'` when unauthenticated. The initial document skeleton is created once with project metadata and empty arrays, and the project shell can remain mostly placeholder UI while still proving routing, header, tabs, active version metadata, and public read-only behavior. Render staging works as two services plus Postgres when backend `CORS_ORIGINS` is the exact static-site origin, frontend `VITE_API_BASE_URL` is the API origin, and backend `SESSION_COOKIE_SAMESITE=none`.
Verification: `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make seed-dev-user`; `make e2e` at `http://127.0.0.1:5173/` created a project, opened `/projects/{id}/status`, and confirmed a fresh browser context saw the public read-only shell. Staging verification at `https://ph-navigator-v2-staging.onrender.com` signed in as seeded editor, created `Staging Smoke Test`, opened `/projects/e5365d5e-a2b0-4059-9c7a-a212600a0574/status`, signed out, reopened that URL, and confirmed read-only public shell with edit controls hidden.
Follow-up: TB-03 can build Status items on the existing project shell and access seam. Before adding more server-owned project state, introduce the TanStack Query provider / `useQuery` path from `context/TECH_STACK.md` or explicitly keep the TB-02 manual `useEffect` loading as a short-lived tracer. Proxy-aware client IP and JSON application logs are still not materially implemented beyond the existing request-id/error envelope and should be handled with staging/ops setup rather than assumed complete.
```

### TB-03

```text
Slice: TB-03
Date: 2026-05-12
What changed: Added relational `project_status_items`, status item REST endpoints, cert-agnostic default template application, editor/public access checks, editable Status tab UI, direct state/date writes, add/edit/delete, explicit up/down reorder controls, frontend tests, backend contract tests, and E2E browser coverage.
Why: The project shell needs a real lifecycle tracker before the versioned project-document and Rooms draft work begins.
What we tried: Backend migration/API tests, frontend unit tests, production build, CLI Playwright E2E, and in-app Browser verification against a live E2E-created project.
What did not work: The first E2E check exposed a date-only rendering bug: `new Date('2026-05-01')` parsed as a UTC instant and could display as April 30 in New York. The browser check also confirmed that the unauthenticated root redirect can log an expected 401 resource error before sign-in, so console checks should be interpreted after the authenticated navigation under test. Drag-and-drop was not added in this tracer because the explicit reorder controls already prove the fractional `order_index` backend path without adding a DnD dependency.
What worked: Keeping status relational avoided touching `ProjectDocumentV1`; the existing `require_project_access(project_id, mode)` seam cleanly produced public read-only and editor write behavior; template application is one-shot on an empty list; state `todo -> done` auto-populates `completion_date`; date-only strings now render as local calendar dates; soft delete keeps admin recovery possible.
Verification: `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make seed-dev-user`; `make e2e`; in-app Browser smoke showed the populated Status tab with no console warnings/errors after sign-in/navigation.
Follow-up: Add the in-place session-expiry/device-collision modal before considering editable workflows production-ready. If drag-and-drop remains important after a few real projects, add it as a focused UX polish pass on top of the verified `order_index` API. Description Markdown intentionally shipped with only sanitized external-link rendering; add an allow-listed Markdown renderer when richer notes become necessary. TB-03.5 should introduce TanStack Query and feature-first frontend modules before TB-04 adds Rooms/DataTable server state.
```

### TB-03.5

```text
Slice: TB-03.5
Date: 2026-05-12
What changed: Added `QueryClientProvider` and query defaults, moved app routing/composition under `frontend/src/app/`, added `app/router.tsx`, split auth/projects/status API calls and types into feature modules, moved auth/project route bodies and project shell components into feature-owned route/component files, moved shared fetch/error/modal handling to `shared/`, moved local-calendar date formatting to `shared/lib/dates.ts`, split the Status tab into route/components/helpers, and added pure helper tests for status state cycling, order-index movement, and date-only formatting.
Why: TB-04 will add document-editing server state, so the TB-02/TB-03 manual `useEffect` fetch pattern needed to stop before another editable surface copied it.
What we tried: Straight feature-first refactor, TanStack Query hooks for session/project/project-list/status-item loads and mutations, local browser smoke across public and editor views, and frontend lint/format/test/build gates.
What did not work: The first browser smoke after the file move showed stale Vite hot-reload console errors, so Vite was restarted before accepting browser evidence. The first auth-query cut also kept a public `ProjectDetail` cache after sign-in, leaving the project shell in viewer mode even though login succeeded.
What worked: Feature-local hooks plus shared query keys are enough for current auth/project/status server state. Feature-owned route/component files keep `App.tsx` and `app/router.tsx` small enough to serve as composition surfaces. Invalidating project queries on sign-in and removing project queries on sign-out fixes auth-boundary access-mode transitions without avoidable post-sign-out 401 refetches. Status mutations can update the cached list from returned rows instead of paying for `PATCH/DELETE + GET list` on every edit. Keeping the BT-number availability check as a debounced query preserved cancellation/stale response handling without turning the debounce itself into server-state logic.
Verification: `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test` (12 tests); `cd frontend && npm run build`; Playwright browser smoke verified public read-only Status tab, sign-in transition to editor controls, populated default template, and no console errors after Vite restart.
Follow-up: TB-04 can reuse the feature-local API/types/hooks/routes/components shape for Rooms/DataTable. Future auth-sensitive feature queries should either use access-mode-aware keys or participate in the auth-boundary refresh/clear policy; otherwise public caches can survive editor login.
```

### TB-04

```text
Slice: TB-04
Date: 2026-05-12
What changed: Added the `project_version_drafts` table, strict `ProjectDocumentV1` Rooms/single-select validation, version-scoped Rooms saved/draft table APIs, feature-owned Equipment/Rooms frontend, a temporary `TablePrimitiveStub`, targeted backend/frontend tests, and e2e coverage for add-room/reload draft restore. Follow-up cleanup moved document schema types into `features/project_document/document.py`, made Rooms option lists required for replace writes, and added Rooms query invalidation on auth-boundary changes.
Why: Rooms are the first versioned project-document edit path and need to prove lazy draft creation before TB-05 adds Save/Discard/version actions.
What we tried: Backend migration/API tests, frontend unit tests, local e2e through Status plus Rooms, and an in-app browser smoke attempt.
What did not work: The existing local `:8000` backend process was stale and returned 404 for `/document/rooms`; verification used a fresh API on `:8001`. Running the frontend cross-origin on `:5174` failed CORS, and running with `VITE_API_BASE_URL` cross-origin made local e2e cookie scope diverge from the Vite proxy path. The in-app Browser workflow hit a tool limitation filling the email input, so CLI Playwright is the accepted browser evidence for this pass.
What worked: Keep local browser verification same-origin through the Vite `/api` proxy, now overridable with `VITE_API_PROXY_TARGET`. The first accepted Rooms write creates a user/version draft from the saved version, guarded by `If-Match-Version`; later writes use `If-Match` on `draft_etag`. Rooms rows reference option ids, while creating floor/zone labels creates the options in the same semantic write. Keeping the temporary table renderer named `TablePrimitiveStub` reserves the canonical `DataTable` name for the later TanStack/keyboard/paste implementation.
Verification: `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e` with fresh API `:8001` proxied through Vite `:5173`; staging Render smoke confirmed a room could be added on Equipment/Rooms and restored as an unsaved draft in the live app.
Follow-up: TB-05 should add Save/Discard and version-body persistence, plus a real dirty/save indicator. TB-06 should revisit same-editor tab coordination with draft ETags. Before long-lived editable drafts matter, add or explicitly defer `expires_at`/keepalive/stale-warning behavior.
```

### TB-04b

```text
Slice: TB-04b
Date: 2026-05-12
What changed: Added `mcp_tokens`, editor-only token issue/list/revoke REST routes, high-entropy bearer-token hashing, FastMCP read tools, Streamable HTTP mounting at `/mcp`, stdio startup via `PHN_MCP_TOKEN`, and a local MCP smoke client.
Why: Claude/agent clients need authenticated project-scoped reads before TB-05 version semantics and later MCP write leases are added.
What we tried: Official MCP Python SDK Streamable HTTP mounting, bearer-token verification through `TokenVerifier`, local FastAPI + MCP client smoke, and dashboard cross-check through Playwright.
What did not work: Mounting the MCP sub-app under FastAPI without running the MCP session manager lifespan returned `500 Task group is not initialized`; fixed by adding the main FastAPI lifespan around `phn_mcp.session_manager.run()`. The first dashboard browser check counted the expected pre-login `/auth/session` 401 as a console error; the accepted browser evidence starts console capture after sign-in.
What worked: Store only token hash/prefix, return plaintext once, throttle `last_used_at` updates during token verification, and rehydrate the normal `ProjectAccess` object from the token's issuing user/project for read tools. Streamable HTTP plus stdio covers current local-client needs; legacy SSE stays deferred unless a concrete client requires it. Follow-up review tightened the slice by gating env-token auth to stdio, adding MCP URL env docs, adding in-process MCP tool tests, sharing the current document-view loader with REST, aligning the `replace_table` stub signature with the future write contract, and documenting the current FastMCP structured-error wire shape.
Verification: `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (35 passed); `python -m scripts.smoke_mcp_read --url http://127.0.0.1:8002/mcp/ --token <project-scoped-token>`; MCP calls for `get_project`, `list_status_items`, `get_document`, `get_table`, and read-only `replace_table` rejection; Playwright dashboard check for `MCP Smoke Project` / `MCP-001`.
Follow-up: Build the Project Settings token UI when the settings modal slice lands; TB-17 owns real MCP draft writes, save/discard, and edit lease UX; TB-06 owns read-safe-mode across REST, MCP, and frontend.
```

### TB-05

```text
Slice: TB-05
Date: 2026-05-13
What changed: Drafted the file-app lifecycle layer for Rooms: Save flushes the current draft into the open version, Save As creates a new active/default version, Discard deletes the current user's draft, Lock/Unlock update version metadata, saved project/table JSON downloads return attachments, and diff returns a structured per-table/path summary. The frontend project header now exposes version picker, URL-scoped Open, Save, Save As, Discard, Lock/Unlock, Project JSON, Rooms JSON, and a simple diff modal; locked versions freeze Rooms editing and point the user to Save As.
Why: TB-04 created recoverable drafts but had no terminal persistence action. TB-05 makes the Rooms slice usable as an explicit-version workflow.
What we tried: Service-layer-only saved-body writes, route-level lifecycle endpoints matching `api.md`, frontend TanStack Query invalidation after lifecycle mutations, URL-scoped open-version state rather than making Open mutate the project default, and a text diff modal instead of a side-by-side visual diff.
What did not work: Initial local DB-backed verification could not run because Docker was not running; `docker compose up -d db` failed with "Cannot connect to the Docker daemon at unix:///Users/em/.docker/run/docker.sock." After Docker started, the first DB-backed project-document test run exposed a real diff-path mismatch: the backend returned `[rm_living]` instead of the intended `rooms[rm_living]`. The first two E2E reruns exposed loose locators for repeated `Open` buttons and the word `rooms`, both fixed in the test.
What worked: Static backend checks and frontend checks passed. The saved-body write path stays narrow: repository helpers expose Save / Save As instead of a generic update-body API. Submitted/Closed Save As variants auto-lock. Save As from locked versions remains available and copies the existing draft when present, otherwise the saved body. Follow-up review fixed Open/default semantics, scoped Rooms query invalidation to the project, removed redundant table-download validation, added Unlock confirmation, made Save As uniqueness errors constraint-specific, and gave the diff modal a version-vs-version target.
Verification: `docker compose up -d db`; `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (43 passed); `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test` (17 passed); `cd frontend && npm run build`; `make seed-dev-user`; `make e2e`; in-app Browser opened the latest E2E project and confirmed the locked submitted version header controls, JSON links, and clean state.
Follow-up: Defer the full Restore / Discard prompt, a dedicated draft-status endpoint for the header, and route-module ownership cleanup to TB-06/TB-06 prep.
```

### TB-06

```text
Slice: TB-06
Date: 2026-05-13
What changed: Added same-editor Rooms draft broadcasts in the frontend, stale `draft_etag` conflict classification, a frozen active Room modal state with explicit Reload draft, a local E2E two-tab conflict path, and raw saved-document downloads that bypass `ProjectDocumentV1` validation for read-safe recovery.
Why: TB-05 made Rooms version saves usable, but same-editor tabs could still attempt stale whole-table replacements without a visible boundary. Older or invalid saved document bodies also needed a recovery download even when typed table reads fail validation.
What we tried: `BroadcastChannel` for same-browser-tab coordination, existing whole-draft ETags for server conflict authority, local Playwright with two same-session pages, and a backend invalid-schema fixture that mutates a saved version body directly.
What did not work: The in-app Playwright MCP browser was locked by an existing `mcp-chrome` profile, so local browser evidence used CLI Playwright. The first E2E run executed both tests in parallel and collided with the app's single-active-session auth rule; the file is now serial. The first reload click matched both the page banner and modal action; the assertion is now scoped to the active modal.
What worked: Accepted Rooms writes publish the new slice and `draft_etag` to sibling tabs through a stable `BroadcastChannel` subscription with a previous-ETag guard; out-of-order tab messages invalidate/refetch instead of overwriting newer cache. Tabs with no active Room modal adopt the server draft directly; tabs with an active Room edit freeze only when the active room row, deletion state, or referenced option changed, preserving the local in-memory edit until the user chooses to reload. Disjoint same-table writes can update the cached slice and continue. No-op Rooms replacements return the current slice without creating/touching a draft row. Backend table reads still reject invalid schemas, while Project JSON download returns the raw body for recovery.
Verification: `make migrate`; `make seed-dev-user`; `make smoke`; `make lint`; `make test` (backend 45 passed, frontend 19 passed); `make typecheck`; `git diff --check`; `cd backend && uv run ruff check features/project_document/routes.py features/project_document/service.py tests/test_project_document.py`; `cd backend && uv run pytest tests/test_project_document.py` (15 passed); `cd frontend && npm run format:check`; `cd frontend && npm test -- --run src/features/equipment/lib.test.ts` (6 passed); `cd frontend && npm run build`; `cd frontend && npx playwright test tests/e2e/health.spec.ts --project=chromium` (2 passed). Staging browser check remains pending before TB-06 should be marked complete.
Follow-up: Run the same two-tab stale-draft path on Render staging before checking TB-06 complete. The full workspace-level schema fallback banner/error-code contract, Restore / Discard prompt, and dedicated draft-status endpoint are still deferred; future non-Rooms document tables should reuse the same conflict boundary before adding merge UI.
```

### P1-01

```text
Slice: P1-01
Date: 2026-05-13
What changed: Split `features/project_document/service.py` into focused store, drafts, versions, diff, downloads, validation, audit, and table-contract modules. Added `features/project_document/tables/registry.py` with Rooms as the first registered table contract, routed REST plus MCP table reads through the registry, moved document body-size calculation into project-document validation helpers, made registered-table iteration deterministic by table name, shared MCP HTTP-to-tool-error mapping, avoided full-document dump/validation on unchanged Rooms replacements, and removed duplicate saved-version loading from draft diff.
Why: The generic `/document/tables/{name}` and `/draft/tables/{name}` routes should be reusable before Phase 2 clones the Rooms tracer into more project-document tables.
What we tried: Behavior-preserving backend refactor with a compatibility facade for existing imports, then focused REST/MCP regression tests before full backend gates.
What did not work: The first split left a registry/Rooms circular import and type-check narrowing failures after 404 helpers. Moving `TableContract` to `tables/contracts.py` and marking the shared version-not-found helper as `NoReturn` fixed both.
What worked: Keep route URLs and Rooms response shape stable, parse replace payloads inside the registered contract, and make unsupported names fail before payload parsing. Downloads, diff, MCP `get_table`, and draft replacement now use table contracts instead of route/service branches. Follow-up code review confirmed remaining findings are later-slice concerns; simplify pulled in the small body-size ownership, deterministic-order, MCP error-mapping, Rooms no-op/diff extraction, and duplicate-load cleanups.
Verification: `cd backend && uv run ruff check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (46 passed). Focused preflight also ran `cd backend && uv run pytest tests/test_project_document.py tests/test_mcp.py` (21 passed).
Follow-up: P1-02 should build document/header summary state on top of this boundary. The next editable project-document table should add a table contract under `features/project_document/tables/` and register it, not add new generic route branches. `RegisteredTableResponse = RoomsSliceResponse` remains intentionally deferred until OpenAPI/schema strategy or a second table makes the response-model decision concrete.
```

### P1-02

```text
Slice: P1-02
Date: 2026-05-13
What changed: Added a document-level draft summary response at `GET /api/v1/projects/{project_id}/versions/{version_id}/draft`, with source, version/draft ETags, dirty table names, last patched time, lock state, and editability. Moved version chrome into `frontend/src/features/project_document/`, removed the header's Rooms query dependency, and made Rooms writes invalidate the document summary. Project JSON remains document chrome; Rooms JSON moved to the Equipment/Rooms table surface.
Why: Save, Save As, Discard, Diff, Lock/Unlock, and dirty/clean indicators are document-version actions. The header should not need to know whether Rooms, Windows, or another future table caused the current draft.
What worked: The summary can stay small and table-neutral while deriving dirty table names from registered table contracts. Header Save now uses the document summary's `version_etag`; table-specific downloads stay in table UI. The existing E2E Rooms lifecycle still covers the browser path once the Rooms JSON link lives in Equipment instead of the header. Follow-up review fixed option-only Rooms dirty/diff visibility, remote-tab summary invalidation, the API-spec drift for `/draft`, and the temporary hardcoded Rooms table-query invalidation key.
Verification: `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check features/project_document tests/test_project_document.py`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (49 passed after follow-up review amendments); `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test` (21 passed); `cd frontend && npm run build`; `make seed-dev-user`; local `cd frontend && npm run test:e2e` (2 passed) against FastAPI `:8000` and Vite `:5173`.
Follow-up: P1-03 re-scopes MVP recovery around raw Project JSON access and strict typed-surface failure, with the `/draft` read-safe envelope retained as a Phase 1 aid. P1-04/P1-05/P1-11 own the remaining UI polish: modal prompts instead of `window.confirm`, component splitting, dirty-switch workflow, beforeunload/session-expiry handling, and future lock/edit-lease signals.
```

### P1-03

```text
Slice: P1-03
Date: 2026-05-13
What changed: Re-scoped MVP recovery around data preservation instead of full schema-evolution behavior. The hard MVP contract is: raw Project JSON remains downloadable, and typed table reads/writes fail closed when the saved/draft body cannot validate. Current Phase 1 also returns a `schema_version_unsupported: true` envelope from `GET /document` and editor `GET /draft`, and the project shell renders a recovery panel, but that is a helpful aid rather than the full older-schema migration/read-safe workspace contract.
Why: Before `ProjectDocumentV2` exists, full upgrade-shim infrastructure and production recovery UX are premature. MVP should guarantee that user data is not lost without promising old documents remain editable or fully migratable.
What worked: Keep strict table contracts for typed table surfaces while preserving raw-body recovery at document-level surfaces. The editor shell can reuse the `/draft` summary query to detect unsupported bodies; public viewer fallback uses the `/document` read-safe response. The backend logs the structured read-safe error code while still returning HTTP 200 for recovery envelopes.
Verification: `make lint`; `make typecheck`; `make test` (backend 50 passed, frontend 23 passed); `cd frontend && npm run build`; browser Playwright check against Vite `:5173` with intercepted unsupported-schema project/draft responses confirmed the recovery panel, raw JSON CTA, diagnostics, and no Save button.
Follow-up: Future schema-version slices still need real forward-only upgrade shims and golden fixture corpora before "older documents load successfully" becomes a product guarantee. MCP read-safe behavior should be revisited when TB-17 adds draft writes and schema migration is no longer V1-only. If public viewer document bodies become large, replace the current `/document` read-safe probe with a lightweight read-safety/status signal.
```

### TB-07

```text
Slice: TB-07
Date: 2026-05-14
What changed: Materials chosen as the first envelope/window catalog row type. New tables `catalog_materials` (identity) and `catalog_material_versions` (typed values + `catalog_schema_version` INT default 1) landed via Alembic `20260514_0007_catalog_materials`. New backend feature module `backend/features/catalogs/` with models, raw-SQL repository, service, and routes mounted at `/api/v1/catalogs/materials` (list with `include_inactive`, create, get, patch, delete = deactivate, reactivate). Catalog writes/reads require an authenticated user; ACL hardening beyond "any signed-in editor" is deferred. New frontend feature module `frontend/src/features/catalogs/` (api/hooks/query-keys/types, `MaterialEditorModal`, `MaterialsCatalogPage`). Router now serves the real page at `/catalog/materials` while `/catalog/:catalogSlug` keeps the placeholder for Window-Frame Elements and Window-Glazing. App.test asserts both branches.
Why: TB-07 proves the bookshelf data-model end-to-end with one row type before TB-08 reuses the primitives for Frame/Glazing pick into Window Types.
What we tried: Raw-SQL repository with `psycopg.sql.SQL` composition for dynamic UPDATEs across identity vs version fields; deferred FK on `current_version_id` added after both tables exist to break the circular reference at create time; joined SELECT that exposes everything a future `catalog_origin` block needs (`id`, `current_version_id`, `catalog_schema_version`, `version_label`, `version_date`); in-place edit on the current version per §7.3 rather than forking a new version row; plain HTML `<table>` for the catalog UI rather than the project-document `<DataTable>` primitive because catalog rows are not draft-scoped.
What did not work: First repository pass used f-string SQL composition for the dynamic UPDATE SETs which `ty check` rejected because `Connection.execute` requires a `LiteralString`/`SQL`/`Composed` query; rewritten using `sql.SQL("{} = {}").format(sql.Identifier(...), sql.Placeholder(...))` to match the existing project-metadata UPDATE pattern. First backend test pass missed the Origin header on DELETE requests and got `403 Forbidden` from the mutating-route Origin check; tests now mirror the existing `headers={"Origin": ORIGIN}` convention on every mutating call.
What worked: Identity + versions land together with the deferred current-version FK; `catalog_schema_version` is denormalized on every version row so the API response carries the future migration hook without a join; soft-delete via `deleted_at` doubles as "deactivate" and the joined SELECT keeps inactive rows queryable so already-picked entries remain readable for refresh-from-catalog. Frontend uses a plain HTML table — sufficient for catalog management and avoids coupling to the draft/ETag plumbing the `<DataTable>` primitive carries. Browser smoke confirmed add → in-place edit (same `current_version_id` after a conductivity change) → deactivate → toggle "Show deactivated" round-trips correctly with zero console errors.
Verification: `docker compose up -d db`; `make migrate` applied `20260514_0007`; `cd backend && uv run ruff check features/catalogs/`; `cd backend && uv run ruff format --check features/catalogs/ tests/test_catalogs.py`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (70 passed, 6 new catalog tests covering bookshelf metadata shape, active/inactive filtering, no-side-effects on `project_versions`, validation rejection, unauthenticated read/write rejection, and deactivate idempotency + reactivate); `cd frontend && npm run format:check`; `cd frontend && npm run lint`; `cd frontend && npm test -- --run` (65 passed including a `catalogQueryKeys` unit test and updated App.test branches for the live page vs the still-placeholder catalogs); `cd frontend && npm run build`; `make seed-dev-user`; in-app browser smoke at `http://127.0.0.1:5173/catalog/materials` signed in, added XPS (Insulation, λ=0.034, ρ=35, c=1500, ε=0.9), edited conductivity in place from 0.034 → 0.030 (same `current_version_id`), deactivated XPS, toggled "Show deactivated" and confirmed both the curl-seeded and UI-created XPS rows render as Deactivated with `Edit` disabled and `Reactivate` available, while Mineral Wool remains Active. Zero console errors.
Review follow-up (Codex, `docs/code-reviews/2026-05-14/tb-07-code-review.md`): H1 (catalog writes bypassed `user_action_log` despite US-OPS-1 v1 scope + data-model.md §7.3 "Audit-logged") and M1 (frontend allowed clearing `version_date` → null → DB NOT NULL → 500) both addressed in TB-07. Added `features/catalogs/audit.py` paralleling `project_document/audit.py`; create/update/delete/reactivate now emit `catalog_record_create`/`_update`/`_delete`/`_reactivate` rows with `catalog_table`, `record_id`, `version_id`, and (for updates) `changed_fields`. `CatalogMaterialUpdateRequest` rejects explicit `version_date: null` via a `model_validator` so PATCH returns 422 instead of letting the NOT NULL constraint produce a 500; the modal omits the field entirely when blank instead of sending null. Two regression tests added (audit ledger contents + null-version_date rejection).
Follow-up: TB-08 will add the Frame catalog (and likely Glazing) against the same primitives, then prove the bookshelf copy into Window Types with `catalog_origin`. Deferred from TB-07 by design: new-version-flow UI (current slice patches the current version in place); standalone catalog audit log table separate from `user_action_log` (the §6.1 sketch mentions `catalog_audit_log` but `user_action_log` already covers the v1 audit need per US-OPS-1); field-level update payload validation beyond the simple non-negative / `[0,1]` guards; bulk import; ACL beyond "any signed-in editor"; richer empty/loading states; refresh-from-catalog drift detection (TB-09); category single-select instead of free-text; ARGB color picker UI; promoting hand-entered values back into the catalog.
```

### TB-08.a

```text
Slice: TB-08.a
Date: 2026-05-14
What changed: Catalogs feature split into per-catalog submodules (`materials/`, `frame_types/`, `glazing_types/`) under `backend/features/catalogs/`, with shared primitives in `_shared.py` (id helpers, base validators, audit). Added two Alembic migrations: `20260514_0008_catalog_materials_rec_ids` rebadges existing `catalog_materials.id` from `mat_<token>` to AirTable `rec` + 14-char base62; `20260514_0009_catalog_frame_and_glazing` adds the `catalog_frame_types[_versions]` and `catalog_glazing_types[_versions]` tables mirroring catalog_materials. Record-id generator (`new_catalog_record_id`) is uniform across all three catalogs so V1 / AirTable imports can drop in as `INSERT … id = airtable_record_id`. Version ids stay V2-native and table-prefixed (`matv_`, `framev_`, `glazingv_`) because AirTable has no version concept. Frame fields: name, manufacturer, brand, width_mm, u_value_w_m2k, psi_g_w_mk, psi_install_w_mk, argb_color, notes, source_provenance. Glazing fields: name, manufacturer, brand, u_value_w_m2k, g_value (validated as [0, 1] fraction), argb_color, notes, source_provenance. Backend mounts both new routers via `features/catalogs/__init__.py` (`routers: tuple[APIRouter, ...]`), looped in main.py. Frontend extends shared `api.ts` / `types.ts` / `hooks.ts` / `query-keys.ts` with frame/glazing variants; new `FrameTypeEditorModal` / `GlazingTypeEditorModal` + their pages reuse a `form-helpers.ts` module for parse/format/today helpers; CSS classes renamed from `materials-catalog-*` to `catalog-*` so all three pages share styling. `CatalogPlaceholder` route removed because all three catalogs now have real pages. Slug renames: `lib.ts` `CATALOGS` now uses `frame-types` / `glazing-types` to match API paths and code module names; user-facing labels stay "Window-Frame Elements" / "Window-Glazing" per PRD §7.0.
Why: TB-08.b extends `ProjectDocumentV1` with `tables.window_types[]` and TB-08.c stamps `catalog_origin` from a real picker — both need the two new catalogs landed first. Uniform `rec` ids let V1 / AirTable cross-references resolve unchanged after import; the rebadge migration was small (dev-seeded data only) and kept consistency across the three catalogs.
What we tried: Submodule directory split rather than name-suffixed flat files so the per-catalog seams scale to Phase 2 catalogs (ERV/Pump/Fan/Appliance/HWH); generic schema migration factored through `_create_catalog(...)` parameterized by value-column list; rebadge migration uses Alembic `op.get_bind()` + Python `secrets.choice` per row in a loop (drop versions FK → update both materials.id and versions.record_id → recreate FK) instead of SQL `gen_random_bytes` (pgcrypto extension may not be present); reused the existing TB-07 raw-SQL repository / in-place edit / soft-delete pattern; frontend reused the existing TanStack Query / hook shape, just with three families of mutations.
What did not work: First catalog migration helper typed columns as `list[sa.Column[object]]` which `ty check` rejected with `invalid-argument-type` against `sa.Uuid()` and friends (23 diagnostics) — the SQLAlchemy stubs don't accept generic parameters cleanly in dynamic lists. Removing the explicit type and passing columns positionally via `*value_columns` cleared `ty` with no other changes. Playwright MCP `browser_snapshot` repeatedly showed the empty-state instead of the editor modal after `browser_click` on "Add frame type" because React hadn't committed yet; `browser_evaluate` with a 100 ms `setTimeout` after the click confirmed the modal renders correctly — accessibility snapshots are point-in-time and miss state during React's commit phase. CSS rename `materials-catalog-*` → `catalog-*` was done with `sed -i ''` across `App.css` + `MaterialsCatalogPage.tsx` simultaneously; doing it piecemeal would have left orphan styles.
What worked: Identity row + versions table land together with the deferred `current_version_id` FK to break the create-time cycle (matches TB-07). The shared `new_catalog_record_id` produces `rec` + 14 base62 chars (1000-call uniqueness asserted in `test_catalogs_shared.py`). Rebadge migration: Python loop with `secrets.choice` keeps the FK drop/restore window scoped to the lockstep id update, no temp tables needed. Bookshelf metadata exposed on every list/get response (`catalog_schema_version`, `version_label`, `version_date`) so TB-08.c can stamp `catalog_origin` without a second round-trip. Frontend `form-helpers.ts` (parseOptionalNumber, numberOrEmpty, stringOrEmpty, trimToNull, todayIso, formatNumber, hasInvalidNumber) collapsed three near-identical editor modals into focused field-list components. Browser smoke: Frame `rec7Mu2IxjnBDCHBI` + `framev_7aWo-8NBoUvb5orH`; Glazing `rec2zQ0SQr7eSVd01` + `glazingv_7iNV7z_KfZjWxOM0`; net-new Material `recSD1AXmSiGU7NKE` + `matv_5sZTytMtxZGuDVqr`. All three IDs match `^rec[A-Za-z0-9]{14}$`; all three catalogs reach their pages with zero console errors.
Verification: `docker compose up -d db`; `cd backend && uv run alembic upgrade head` (applied `20260514_0008` and `20260514_0009`); `cd backend && uv run ruff format --check .`; `cd backend && uv run ruff check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest` (90 passed: +3 shared id helper tests, +8 frame contract tests, +9 glazing contract tests on top of TB-07 baseline); `cd frontend && npm run format`; `cd frontend && npm run lint`; `cd frontend && npm test -- --run` (66 passed including updated catalogQueryKeys + App.test routing both new catalogs); `cd frontend && npm run build`; `make seed-dev-user`; `cd frontend && npm run test:e2e` (2 passed); in-app Playwright browser smoke for `/catalog/frame-types`, `/catalog/glazing-types`, `/catalog/materials` — record ids matched `^rec[A-Za-z0-9]{14}$` for all three catalogs; zero console errors across the three pages.
Follow-up: TB-08.b extends `ProjectDocumentV1` with `tables.window_types[]` and registers the table contract — no frontend work in that slice. The minimal Windows UI with bookshelf picker lands in TB-08.c. The new catalog routes are reachable from the editor `Catalogs` dropdown; viewer-only access for catalogs is still deferred (catalogs require sign-in for both reads and writes — ACL hardening remains the same post-MVP item flagged in TB-07). Catalog browser smoke could not use accessibility snapshots reliably during modal-open transitions; future browser tests for these pages should use `browser_evaluate` with a small delay or wait on `[role=dialog]` to be present before snapshotting.
```

### TB-08.b

```text
Slice: TB-08.b
Date: 2026-05-14
What changed: Added typed Window Types models to `features/project_document/document.py`: `CatalogOrigin` (catalog_table Literal['materials','frame_types','glazing_types'], catalog_record_id pattern `^rec[A-Za-z0-9]{14}$`, catalog_version_id pattern `^(matv|framev|glazingv)_[A-Za-z0-9_-]+$`, catalog_schema_version >= 1, synced_at datetime, local_overrides defaulting to []); `FrameRef` and `GlazingRef` mirroring the TB-08.a catalog public field sets plus nullable `catalog_origin`; `WindowElementFrames` with nullable top/right/bottom/left; `WindowElement` with `id` (`winel_<ULID>`), `row_span`/`column_span` tuples validated at field level (non-negative, start<=end) and at the parent `WindowTypeEntry` for in-bounds; `WindowTypeEntry` with `id` (`win_<ULID>`), trimmed name, `row_heights_mm`/`column_widths_mm` min_length=1 + all >0, `elements` min_length=1, duplicate-element-id guard. `ProjectDocumentTables.window_types` widened from `list[dict[str, object]]` to `list[WindowTypeEntry]`. Document-level validator enforces unique window-type names per version using the same trim + case-insensitive comparison as Rooms options/numbers. New `features/project_document/tables/window_types.py` registers the table contract (schema_slug `window-type`); `tables/registry.py` adds it to `_TABLES`; `tables/__init__.py` widens `RegisteredTableResponse` to `RoomsSliceResponse | WindowTypesSliceResponse` and re-exports both. New schema endpoint at `/api/v1/schemas/window-type/v1.json`. New test module `tests/test_project_document_window_types.py` (7 tests); updated the two existing supported-tables assertions in `tests/test_project_document.py` and `tests/test_mcp.py`.
Why: TB-08.c needs a real backend table contract for `window_types` before the minimal Windows frontend can draft/save window-type entries with bookshelf-copied catalog values. TB-08.b also exercises the P1-01 table-registry boundary against its second customer.
What we tried: Reused the Rooms contract shape and the existing document-level model_validator instead of growing a separate window-types validator. Spans modeled as `tuple[int, int]` so Pydantic-level field validation can guard non-negative + ordered ranges before the parent model checks in-bounds. Catalog values modeled as plain data (no live FK / join) per the slice spec.
What did not work: First test pass left `clean_document_tables` imported from `tests.test_project_document` and reused as a function parameter — ruff F811 flagged that as a redefinition because pytest fixtures used cross-file look like duplicate names. Adding `# noqa: F811` on the parameter line keeps the fixture working without copying it into a conftest. First diff assertion used `diff.json()["changes"]` instead of `["tables"]` because the structured diff endpoint returns `tables: [TableDiffSummary]` (per `features/project_document/diff.py`); the test now asserts on `change_count`/`changed_paths`. First catalog_origin negative tests used direct subscript writes into a `dict[str, object]` literal which `ty` rejected because the inferred value type was the union of all field types; the helper `origin(**overrides)` was easier to type and easier to read.
What worked: The P1-01 table-registry boundary held for the second customer — no service-layer special cases, no route branches. The whole new typed shape lives behind one new file plus a one-line registration. `RegisteredTableResponse` union widening was the only `__init__.py` change. `tables/contracts.py:TableContract` already exposed everything window-types needed (build_response, apply_replace, extract_rows, extract_diff_value, schema_model, replace_request_model) — the only thing that diverges from Rooms is that window-types has no document-level option lists to thread through.
Verification: `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest --no-cov` (97 passed; +7 in `tests/test_project_document_window_types.py`).
Follow-up: TB-08.c implements the minimal Windows route, picker, bookshelf-copy stamping, and the `u_value_w_m2k` override tracer using these models. `WindowElement` currently omits `name` and `operation` from the data-model.md §6.2 sketch — both were deferred per the TB-08 plan (operation editor = US-WIN-5; element name = post-MVP). `FrameRef` / `GlazingRef` also omit V1 frame fields like `use`, `location`, `mull_type`, `source`, `datasheet_url`, `link`, `comments` (the V1 ref §2.5 set) because they are not in the TB-08.a catalog row shape; if TB-08.c needs them inline they should be added to both the catalog and `FrameRef` together, not just one side.
```

### TB-08 (consolidated: TB-08.a–.d)

```text
Slice: TB-08 (close-out across TB-08.a–.d)
Date: 2026-05-14
What changed: TB-08.a stood up Frame and Glazing catalogs as siblings of Materials with uniform `rec`-format catalog record IDs and table-prefixed `framev_` / `glazingv_` version IDs (Materials rebadged from `mat_` to `rec` in the same drop), so AirTable / V1 imports can land as literal INSERTs with no remapping table. TB-08.b extended `ProjectDocumentV1` with typed `tables.window_types[]` (`WindowTypeEntry` → `WindowElement` → `FrameRef` / `GlazingRef` → `CatalogOrigin`), registered the `window_types` table contract, served `/api/v1/schemas/window-type/v1.json`, and made the unique-name + span / grid validators behave like Rooms — no frontend in that slice. TB-08.c shipped the minimal `/projects/:id/windows` route with a sidebar list, plain HTML `<select>` pickers fed by the two new catalogs, bookshelf copy of typed values + stamping of `catalog_origin` ({ catalog_table, catalog_record_id, catalog_version_id, catalog_schema_version, synced_at, local_overrides: [] }), and the U-value override tracer that toggles `local_overrides: ["u_value_w_m2k"]` on local edits; all writes go through the existing whole-table replace-slice path with `If-Match` ETag and refresh the document draft summary. TB-08.d closed the slice with a new Playwright e2e spec, a small docs-pass on `data-model.md` §6.2 + `api.md` §9.12, and local + staging acceptance.
Why: TB-07 proved the bookshelf-copy data model with one catalog row type (Materials). TB-08 had to (1) generalize that to two more catalogs, (2) prove the table-registry boundary holds for a second project-document table, and (3) make at least one end-to-end picker flow real before TB-09 layers refresh-from-catalog and TB-10/TB-11 introduce assembly-side material picking.
What we tried: Per-catalog backend submodule split (`features/catalogs/materials/`, `.../frame_types/`, `.../glazing_types/`) plus shared primitives in `_shared.py`; one Alembic migration to rebadge Materials IDs and a second to add Frame + Glazing tables together so the deferred `current_version_id` FK pattern only had to be re-tested across types, not across drops; raw-SQL repository / in-place edit / soft-delete pattern reused verbatim from TB-07; `ProjectDocumentV1` extended with typed Pydantic models rather than dict-shaped JSON; a single new table contract (`features/project_document/tables/window_types.py`) registered through the existing `_TABLES` registry; minimal Windows frontend feature module mirroring `equipment/` (types, api, hooks, query-keys, lib, route) plus plain HTML pickers; one generic `CatalogPickerSlot<TRow, TRef>` instead of separate `FrameSlot` / `GlazingSlot`; one `applyUValueOverride` helper that stamps `local_overrides` only when an origin exists; Playwright MCP for interactive browser verification and a CLI Playwright spec for repeatable e2e.
What did not work: First catalog migration helper typed columns as `list[sa.Column[object]]`, which `ty` rejected against `sa.Uuid()` / friends — passing columns positionally via `*value_columns` cleared 23 diagnostics. First TB-08.c code-review pass flagged that the Add defaults drifted from US-WIN-1 §8 (was `"Untitled"` + bare numeric suffix + `row_heights_mm: []`) — fixed to `"Unnamed Window Type"` + ` (2)` / ` (3)` suffix + `row_heights_mm: [1000]`; same review caught `useFrameTypesQuery` / `useGlazingTypesQuery` firing authenticated catalog fetches in Viewer / locked contexts — added an `enabled` arg and gated on `canEdit`. First e2e attempt picked frame and glazing back-to-back and hit a stale-ETag conflict ("The draft changed before this table update was applied") because the second whole-table replace fired before the first response — fixed by waiting on the catalog badge between picks. First `make e2e` run after adding the new spec broke because `fullyParallel: true` + default workers ran files in parallel and TB-01's single-active-session policy collided; setting `fullyParallel: false` and `workers: 1` in `playwright.config.ts` fixed it (the seed user is shared and per-user single-session is the auth contract). Pre-existing `health.spec.ts` then failed because the diff dialog now contains two `0 changed paths` lines (Rooms + Window Types) since TB-08.b — fixed by scoping the assertion to `.first()`. Playwright MCP browser_snapshot reliably misses transient React commit states for newly opened modals — confirmed again on staging where my eval-based setter + dispatchEvent loop populated only the *last* field on the New Project form, so the proper Playwright tools (`browser_fill_form`, `browser_type`+`browser_press_key Tab`) are the right path whenever a controlled input must round-trip through React state. Same issue showed up for catalog seeding on staging — the first frame/glazing rows landed with `name = "0.95" / "0.5"` and all other typed fields `null`; I PATCHed the rows via direct API instead of re-running the form.
What worked: The TB-07 catalog primitives generalized to two more row types with no service-layer special cases — `_shared.py` covers id generation (`new_catalog_record_id` returns `rec` + 14 base62, asserted unique across 1000 calls in `test_catalogs_shared.py`), base validators, and audit hooks; per-catalog submodules differ only in their typed field lists. The P1-01 table-registry boundary held perfectly for its second customer: TB-08.b added one new file and one line in `tables/registry.py`, the only `__init__.py` change was widening `RegisteredTableResponse` to a union, and downloads / diff / `get_table` (REST + MCP) all read the new shape through the same contract. Catalog values are validated as data only — no live FK or join from project documents back into `catalog_*` tables — which keeps inactive catalog rows readable for refresh-from-catalog later. Frontend feature module reuse worked cleanly: `useReplaceWindowTypesSliceMutation` follows the Rooms pattern, and the existing draft / version / Save / Discard / Lock chrome lit up for Windows without any header changes. The override tracer is the right shape — `stampCatalogOrigin` always sets `local_overrides: []` at pick time, `trackLocalOverride` only appends a field key when a catalog_origin exists (so hand-entered refs stay unchanged), and the override badge surfaces it without a server round-trip. Plain HTML `<select>` is sufficient for one-frame-per-side picking — shadcn Combobox / Command and manufacturer filter (US-WIN-8) are correctly deferred.
Verification: Local: `make lint`; `make typecheck`; `make test` (backend 97 passed, frontend 74 passed including 8 in `features/windows/lib.test.ts`); `make e2e` (3 chromium tests, including the new `tests/e2e/windows-tb-08c.spec.ts` that drives sign-in, catalog seed, project create, Windows tab add → pick frame → pick glazing → edit frame U → Save → reload, with the final `local_overrides` round-trip confirmed via API fetch from the page context). In-app Playwright MCP browser smoke at `http://127.0.0.1:5173/projects/52761c30-147e-4737-ba45-98855256b384/windows` confirmed identical behavior with zero console errors. Staging acceptance against `https://ph-navigator-v2-staging.onrender.com`: signed in as `ed@example.com`, PATCHed Frame `reczYtOnQwBVZ06tf` → "Skyline Ridge SR-3" (U=0.95) and Glazing `rec6Gu9YFjZP5uSdD` → "Triple-Pane LowE Argon" (U=0.6, g=0.5), created project `f4b7db40-b79f-47f4-8a90-b00b809f0103`, added a window type, picked frame top and glazing, edited frame U to 0.85 (override badge appeared), Save; after reload all badges + override + U-values persisted, Clean indicator visible, draft banner gone, zero console errors; saved-version slice round-trip returned `source=version` with frame.top `u_value_w_m2k=0.85` + `local_overrides=["u_value_w_m2k"]` + `catalog_table=frame_types` and glazing `u_value_w_m2k=0.6` + `local_overrides=[]` + `catalog_table=glazing_types`. Docs-pass: `context/technical-requirements/api.md` §9.12 now lists `/api/v1/schemas/window-type/v1.json` as shipped (TB-08.b) and tightened the deferred-schemas note to call out Catalogs + Envelope as the remaining table contracts; `context/technical-requirements/data-model.md` §6.2 now names FrameRef/GlazingRef inline fields and points at the schema endpoint as the authoritative source.
Follow-up: TB-09 owns refresh-from-catalog: detect drift between a project's `FrameRef` / `GlazingRef` values and the current catalog row (joined on `catalog_record_id`, comparing pinned `catalog_version_id` to current), render a per-entry review dialog, and apply per-field Keep mine vs Update from catalog while preserving `local_overrides`. Before TB-09 starts, extract a shared `useTableSliceQuery` / `useReplaceTableSliceMutation` factory so Rooms and Windows stop duplicating the slice API shape — copying into a third table will entrench the duplication. Windows still lacks BroadcastChannel cross-tab sync and a draft-stale / version-locked reconciliation banner; both should land as a parallel to `useRoomsDraftBroadcast` / Equipment `editBlocker` before MCP write tools in TB-17 add a second editor surface. Hand-enter path, U-value calc (US-WIN-6), copy/paste (US-WIN-7), element merge/split (US-WIN-3), operation editor (US-WIN-5), dimensions panel + parser (US-WIN-10), SVG canvas (US-WIN-9), manufacturer filter (US-WIN-8), and inline overrides for fields other than `u_value_w_m2k` are all still deferred per the TB-08 plan. The Playwright e2e auth model (single seed user + one-session-per-user) now forces single-worker e2e — when MCP writes or HBJSON uploads expand the suite materially, consider seeding per-spec users instead.
```
