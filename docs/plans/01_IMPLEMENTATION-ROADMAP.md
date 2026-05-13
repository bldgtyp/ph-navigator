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
| Status | [ ] Not started |
| Goal | Make project header/version chrome table-neutral. |
| References | `context/user-stories/00-foundation-shell.md`; `context/technical-requirements/save-versioning.md`; `context/technical-requirements/frontend-viewer-units.md`; `docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md`. |
| Includes | Document-level draft summary state; table-neutral Save, Save As, Discard, Lock/Unlock, diff, and dirty/clean indicators; remove direct Rooms/Equipment coupling from project shell controls. |
| Tests | Backend draft-summary behavior; frontend header states for clean, dirty, locked, Viewer, and public read. |
| Browser check | Edit Rooms, confirm header detects draft, Save/Discard works, lock/read-only states remain clear. |
| Lessons | Record the table-neutral document chrome contract. |

### P1-03 - Read-Safe-Mode Completion

| Field | Plan |
|---|---|
| Type | HITL for acceptance-scope decision if full fallback is larger than expected |
| Status | [ ] Not started |
| Goal | Close or explicitly re-scope the older/invalid document recovery story. |
| References | `context/user-stories/00-foundation-shell.md` (US-Errors-SchemaFallback); `context/technical-requirements/llm-mcp-schema.md`; `docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md`. |
| Includes | Decide full read-safe envelope vs download-only recovery; implement or document the accepted Phase 1 behavior; ensure raw JSON remains recoverable. |
| Tests | Invalid/unsupported saved body test; frontend recovery-state test if UI lands. |
| Browser check | Opening an invalid/unsupported version renders a recoverable read-only path or the roadmap records the explicit deferral. |
| Lessons | Record the schema-fallback decision before broader document tables ship. |

### P1-04 - BLDGTYP Design-System Foundation

| Field | Plan |
|---|---|
| Type | AFK; design review if the visual direction is uncertain |
| Status | [ ] Not started |
| Goal | Move the Phase 1 app from scaffold styling to the BLDGTYP V2 product language. |
| References | `context/UI_UX.md`; BLDGTYP branding tokens; `context/technical-requirements/stack-auth-migration.md`. |
| Includes | Tailwind/shadcn token alignment; fonts; shared app primitives for buttons, dialogs, popovers, toasts, tabs, table chrome, badges, banners, and empty states; project shell polish. |
| Tests | Frontend lint/format/build; targeted tests only for non-trivial state. |
| Browser check | Desktop and narrow-tablet screenshots for sign-in, dashboard, project shell, Status, Equipment/Rooms, settings, and version dialogs show consistent styling with no broken layout. |
| Lessons | Record token/component decisions so later feature slices do not restart styling. |

### P1-05 - Dashboard And Project Shell Completion

| Field | Plan |
|---|---|
| Type | HITL only if pin/reorder is re-scoped |
| Status | [ ] Not started |
| Goal | Finish the Phase 1 shell stories enough that later tabs land inside a stable frame. |
| References | `context/user-stories/00-foundation-shell.md`; `context/UI_UX.md`; `context/technical-requirements/api.md`. |
| Includes | Dashboard row metadata; New Project modal polish; Catalogs dropdown routing without full catalog management; workspace header, breadcrumbs, tab routing, Viewer/read-only separation; no AirTable affordance. |
| Tests | Project create/list/open contracts; frontend route/header behavior; write rejection for Viewer/public mode. |
| Browser check | Sign in, create/open project, navigate tabs, return dashboard, reopen same URL as Viewer on local and staging. |
| Lessons | Record any dashboard pin/reorder or shell-scope deferrals. |

### P1-06 - Status Tab Full MVP

| Field | Plan |
|---|---|
| Type | HITL only if drag reorder remains deferred |
| Status | [ ] Not started |
| Goal | Move Status from tracer feature to complete Phase 1 workflow. |
| References | `context/user-stories/00-foundation-shell.md` (US-Status); `context/UI_UX.md` (Status tab); `context/technical-requirements/data-model.md`. |
| Includes | Empty state; populated vertical timeline; current-step visual; add/edit/delete/state/date/description behavior; Markdown decision; reorder decision; public Viewer rendering; MCP-readable status posture. |
| Tests | Status API transitions; date behavior; reorder; frontend state helpers where non-trivial. |
| Browser check | Empty state, template apply, edit, reorder, delete, Viewer read-only, and current-step visual on local and staging. |
| Lessons | Record Status MVP criteria checked off and any deliberate deferrals. |

### P1-07 - Project Settings And MCP Token UI

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Make settings and MCP token administration user-accessible. |
| References | `context/user-stories/50-settings-ops-llm.md`; `context/technical-requirements/llm-mcp-schema.md`; `context/technical-requirements/stack-auth-migration.md`; `context/UI_UX.md`. |
| Includes | Project Settings modal; editable Phase 1 metadata; MCP token issue/list/revoke UI; one-time token display; revoked-token feedback; no project delete in settings. |
| Tests | Settings metadata behavior; token issue/list/revoke; revoked token rejection; Viewer access rejection. |
| Browser check | Editor issues and revokes a token from Settings; Viewer cannot open Settings; revoked token fails on next MCP request. |
| Lessons | Record settings/token UX decisions before MCP write work. |

### P1-08 - Shared DataTable Extraction

| Field | Plan |
|---|---|
| Type | AFK; design review if POC parity regresses |
| Status | [ ] Not started |
| Goal | Replace the tracer table with the real reusable table primitive. |
| References | `context/technical-requirements/data-table.md`; `context/user-stories/30-tables-equipment.md`; `context/UI_UX.md` §1.7; `research/poc-plans/grid-spike-results.md`; `research/poc-plans/poc-evaluation.md`; `research/poc-plans/poc-lessons-for-real-build.md`. |
| Includes | TanStack/shadcn table path; stable row-id state; keyboard navigation; frozen identifier column; row gutter; selection/copy/paste; stacked sort/filter/group; read-only mode; a11y baseline. |
| Tests | Targeted helper tests for brittle POC behaviors: selection, copy/paste planning, coercion, toolbar state, and read-only behavior. |
| Browser check | Compare extracted table against POC workflows: selection/copy, paste with overflow, single-select paste, grouping/sorting, and fill/undo if included. |
| Lessons | Record any intentional POC behavior cuts before Rooms migrates. |

### P1-09 - Single-Select Field And Option Manager

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Finish the user-defined single-select behavior Rooms depends on. |
| References | `context/user-stories/30-tables-equipment.md` (US-Builder-Tables criteria 16-17); `context/technical-requirements/data-table.md`; `research/poc-plans/poc-evaluation.md`. |
| Includes | Shared single-select field display/edit/paste/sort/filter behavior; option colors; duplicate prevention; missing-option warnings; header option manager for rename, reorder, recolor, delete, and merge/replace decisions. |
| Tests | Option validation; paste match/create; option-order sorting; missing-option recovery; delete/merge impact behavior. |
| Browser check | Rooms floor/building-zone options can be created, pasted, reordered, recolored, and used for sorting without data loss. |
| Lessons | Record the table field behavior pattern for future tables. |

### P1-10 - Rooms Full MVP On Shared DataTable

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Complete US-EQ-2 on top of the shared table path. |
| References | `context/user-stories/30-tables-equipment.md` (US-EQ-2); `context/technical-requirements/data-model.md`; `context/technical-requirements/save-versioning.md`; `context/technical-requirements/data-table.md`. |
| Includes | Default Rooms columns; validation; natural sort; add row; row-detail modal; inline edit where appropriate; delete; notes; JSON download; locked/Viewer behavior; iCFA factor handling; explicit no-sync-from-HBJSON posture. |
| Tests | Rooms validation; number uniqueness; single-select references; JSON download; locked/public write rejection. |
| Browser check | Rooms edit/save/save-as/discard/lock/download/diff flows still work after migrating off the stub; Viewer can sort/filter/copy without edit affordances. |
| Lessons | Record the first complete project-document table pattern. |

### P1-11 - Draft, Version, And Concurrency UX Completion

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
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
| Status | [ ] Not started |
| Goal | Finish the inspectability surface expected by Phase 1. |
| References | `context/technical-requirements/api.md`; `context/technical-requirements/llm-mcp-schema.md`; `context/technical-requirements/save-versioning.md`; `context/user-stories/00-foundation-shell.md` (US-Versions-Lifecycle). |
| Includes | Project/table JSON downloads across normal and recovery states; version-vs-version and version-vs-draft diff UX at the planned stub level; OpenAPI and project/table schema baseline or explicit deferral; request-id/structured-error visibility. |
| Tests | Download validation; diff behavior; schema/OpenAPI endpoint checks if included; structured error/request-id checks. |
| Browser check | Download raw project JSON, table JSON, and open a useful diff from normal and recovery states. |
| Lessons | Record schema/OpenAPI readiness before MCP write tools. |

### P1-13 - Phase 1 Hardening, Docs, And Release Gate

| Field | Plan |
|---|---|
| Type | AFK with HITL for final scope acceptance |
| Status | [ ] Not started |
| Goal | Mark Phase 1 done with evidence. |
| References | `docs/plans/2026-05-13/phase-1-full-buildout-plan.md`; `context/README.md`; `context/TECHNICAL_REQUIREMENTS.md`; `context/USER_STORIES.md`; `context/UI_UX.md`. |
| Includes | Complete requirements matrix; update roadmap ledger; focused docs-pass; move unresolved questions to the open-question router or later roadmap slices. |
| Tests | `make lint`; `make typecheck`; `make test`; `make e2e`; staging browser smoke for all Phase 1 paths. |
| Browser check | Full Phase 1 staging smoke: sign in, dashboard, project shell, Status, Settings/token UI, Rooms table, Save/Save As/Discard/Lock, public Viewer, downloads/diff/recovery if included. |
| Lessons | Record final Phase 1 evidence and remaining post-MVP work. |

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
| Status | [ ] Not started |
| Goal | One catalog can be managed in the app and read by downstream pickers. |
| References | `context/technical-requirements/data-model.md` (catalogs / bookshelf copy); `context/user-stories/10-windows.md` (downstream picker shape). |
| Includes | Relational catalog schema for the first envelope/window catalog row type; catalog list/create/edit/deactivate API; dashboard Catalogs entry; catalog table UI; `catalog_schema_version: 1` hook only, no migration tooling. |
| Tests | Catalog validation; active/inactive filtering; bookshelf copy metadata shape; no live project mutation when catalog row changes. |
| Browser check | Add/edit/deactivate one catalog row, refresh, confirm the row appears in picker-ready API output. |
| Lessons | Record the catalog scope intentionally kept out of MVP. |

### TB-08 - Window Type Pick From Catalog

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Windows proves the bookshelf model against a non-Rooms project table. |
| References | `context/user-stories/10-windows.md`; `context/technical-requirements/data-model.md` (bookshelf copy, `catalog_origin`). |
| Includes | Window Types table/document shape; frame/glazing pick from catalog; field-level `catalog_origin`; Save/reload through existing draft/version system; minimal Windows UI. |
| Tests | Catalog copy does not live-join; local override tracking; basic window-type validation; targeted units parser tests if dimension input ships here. |
| Browser check | Pick frame/glazing into a Window Type, edit a local field, Save, reload, confirm origin and override state. |
| Lessons | Record any V1 window-builder behavior adopted or deferred. |

### TB-09 - Window Refresh-From-Catalog

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Explicit catalog drift review works for one Window Type field group. |
| References | `context/user-stories/10-windows.md` (refresh-from-catalog); `context/technical-requirements/data-model.md` (drift / override rules). |
| Includes | Drift detection; per-entry refresh dialog; Review all report with per-entry action only; no bulk auto-apply. |
| Tests | Drift detection; Keep mine vs Update from catalog; override persistence. |
| Browser check | Change a source catalog row, open project Window Type, review drift, update one field, keep one local override. |
| Lessons | Record why refresh is explicit and per-entry in v1. |

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
| P1 | P1-02 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice; required before TB-07. |
| P1 | P1-03 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice; required before TB-07. |
| P1 | P1-04 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| P1 | P1-05 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| P1 | P1-06 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| P1 | P1-07 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| P1 | P1-08 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice; DataTable extraction gate required before TB-07 unless explicitly re-scoped. |
| P1 | P1-09 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| P1 | P1-10 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| P1 | P1-11 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| P1 | P1-12 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| P1 | P1-13 | Not started | 2026-05-13 | Accepted Phase 1 full-buildout slice. |
| 02 | TB-07 | Not started | 2026-05-12 | - |
| 02 | TB-08 | Not started | 2026-05-12 | - |
| 02 | TB-09 | Not started | 2026-05-12 | - |
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
