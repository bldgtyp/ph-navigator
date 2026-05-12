---
DATE: 2026-05-12
TIME: 10:30 EDT
STATUS: Active implementation roadmap. Update as slices land.
AUTHOR: Ed May (with Codex)
SCOPE: Vertical-slice implementation plan for PH-Navigator V2 MVP.
RELATED: context/README.md, context/PRD.md, context/TECH_STACK.md,
         context/ENVIRONMENT.md, context/USER_STORIES.md,
         context/technical-requirements/
---

# PH-Navigator V2 - Implementation Roadmap

## Purpose

Use this as the active execution tracker for PH-Navigator V2. The PRD
and technical requirements remain the source of truth for product and
architecture. This file sequences the work into thin tracer-bullet
slices that can be built, tested, and verified in the browser.

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
| MCP transport | TB-04b | Both stdio and HTTP/SSE |
| Project version name uniqueness | TB-05 | Enforce unique per project |
| Diff UI scope | TB-05 | Structured text summary in v1 |
| Draft GC threshold and warning timing | TB-05 | 30-day GC; warnings can tune later |
| Multi-editor concurrency scope | TB-06 | MVP supports single-active-editor per project; cross-editor conflict UX deferred to v1.1 |
| HBJSON file-size cap | TB-14 | Start with 50 MB unless real files exceed it |

## Tracer-Bullet Slices

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
| Status | [ ] Not started |
| Goal | Align the frontend with the feature-first/TanStack Query shape before TB-04 adds document-editing server state. |
| References | `context/CODING_STANDARDS.md` (frontend shape/server state); `context/TECH_STACK.md`; `docs/plans/2026-05-12/tb-03-code-review.md` (H1/M4/M5/M6). |
| Includes | `QueryClientProvider` and query defaults; feature-local API/types/hooks for project shell and project status; split `StatusTab` into route, components, and shared helpers; shared local-calendar date formatter; pure helper tests for status state cycle, order-index movement, and date-only formatting. |
| Tests | `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; targeted browser smoke for dashboard -> Status tab load and template display. |
| Browser check | Open a project Status tab as editor and public viewer after the split; confirm the existing status happy path still renders with no console warnings/errors. |
| Lessons | Record whether Query provider and feature modules are sufficient before repeating the pattern for Rooms/DataTable in TB-04. |

### TB-04 - Minimal Project Document And Rooms Draft

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | First project-document edit path works through Rooms without version-save polish. Not user-visible on its own: drafts created here have no terminal action until TB-05 ships Save/Discard. |
| References | `context/technical-requirements/data-model.md` (ProjectDocumentV1); `context/technical-requirements/save-versioning.md` (draft lifecycle); `context/technical-requirements/data-table.md`; `context/user-stories/30-tables-equipment.md` (Rooms). |
| Includes | `ProjectDocumentV1` minimal body with empty tables; Rooms and single-select option structures; draft row created on first edit; table-slice read; guarded draft patch; minimal Equipment -> Rooms UI using the shared DataTable path. |
| Tests | Pydantic document validation; golden empty document; guarded patch rules; Rooms row validation; single-select duplicate/missing-option rules. |
| Browser check | Add a room, edit floor level and building zone options, reload, restore draft, confirm row remains in draft. |
| Lessons | Record document-shape decisions and any DataTable scope cut made to keep the slice thin; verify `expires_at`/keepalive behavior before relying on long-lived editable draft state. |

### TB-04b - MCP Read-Only Tracer

| Field | Plan |
|---|---|
| Type | HITL for MCP transport decision and local client setup |
| Status | [ ] Not started |
| Goal | Claude can authenticate via MCP and read project + draft state through a real local client. De-risks transport, token, and access-check choices before TB-05 introduces version semantics. |
| References | `context/technical-requirements/llm-mcp-schema.md`; `context/user-stories/50-settings-ops-llm.md`; `context/technical-requirements/api.md` (shared access-check). |
| Includes | MCP server scaffold with chosen transport(s); token schema and hashing; project-scoped read-only scopes; list/get tools for projects, status items, and document slices; shared access-check dependency reuse; structured MCP error shape. |
| Tests | Token scope validation and revocation; read-only enforcement (write attempt is rejected, not silently no-op); MCP and REST share the access-check dependency; targeted tool I/O contract tests. |
| Browser check | Run MCP list/get against a project from a local MCP client; cross-check that the same data appears in the browser dashboard for the same user. |
| Lessons | Record MCP transport and ergonomics decisions, and what was deliberately deferred to the write-path slice (TB-17). |

### TB-05 - Save, Save As, Lock, Diff Stub, Downloads

| Field | Plan |
|---|---|
| Type | HITL for version-name uniqueness and diff scope confirmation |
| Status | [ ] Not started |
| Goal | File-app-style version workflow is usable on the Rooms slice. |
| References | `context/technical-requirements/save-versioning.md`; `context/technical-requirements/api.md` (version endpoints, ETag); `context/user-stories/00-foundation-shell.md` (version dropdown). |
| Includes | Save, Save As, Discard, Lock; version dropdown behavior; denormalized save metadata; project JSON download; Rooms table JSON download; structured diff endpoint with v1 UI stub; locked-version read-only behavior. |
| Tests | Save/version service; ETag conflicts; locked-version write rejection; JSON round-trip validation; table download validation; draft discard and restore paths. |
| Browser check | Edit Rooms draft, Save, Save As, lock old version, try blocked edit, download project JSON and Rooms JSON, open diff stub. |
| Lessons | Record how much diff UX was deferred and why. |

### TB-06 - Same-Editor Tabs And Stale Draft Boundaries

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Basic concurrency rules are visible before more editors are built on top. |
| References | `context/technical-requirements/save-versioning.md` (stale-draft + ETag rules); `context/user-stories/00-foundation-shell.md`. |
| Includes | Same-editor tab coordination; stale ETag handling; dirty-draft warning; restore/discard prompt; read-safe-mode fallback for older or invalid schema bodies. |
| Tests | Same-editor disjoint edit path; same-scope stale conflict; schema fallback raw-body download; draft age metadata if present. |
| Browser check | Open two tabs to one project, edit in one, verify the other handles stale state without silent overwrite. |
| Lessons | Record UX tradeoffs around force-reload vs merge, and revisit session-row locking/touch behavior under same-editor multi-tab traffic. |

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

| Slice | Status | Last updated | Verification evidence |
|---|---|---|---|
| TB-00 | Complete | 2026-05-12 11:58 EDT | `make smoke`; `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e`; Browser check at `http://127.0.0.1:5173/` passed with live `/api/v1` health/version and no console warnings/errors. |
| TB-01 | Complete | 2026-05-12 12:46 EDT | `make migrate`; `make seed-dev-user`; `cd backend && uv run ruff check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e`; Browser check at `http://127.0.0.1:5173/` passed for root sign-in redirect, editor sign-in, dashboard reload/session persistence, and signed-out protected-route redirect. |
| TB-02 | Complete | 2026-05-12 17:13 EDT | Local path complete: `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make e2e`. Staging Render deploy verified at `https://ph-navigator-v2-staging.onrender.com`: sign in as seeded editor, create `Staging Smoke Test`, open `/projects/e5365d5e-a2b0-4059-9c7a-a212600a0574/status`, sign out, reopen the project URL, and confirm read-only public shell with edit controls hidden. |
| TB-03 | Complete | 2026-05-12 16:04 EDT | `make migrate`; `cd backend && uv run ruff check .`; `cd backend && uv run ruff format --check .`; `cd backend && uv run ty check`; `cd backend && uv run pytest`; `cd frontend && npm run lint`; `cd frontend && npm run format:check`; `cd frontend && npm test`; `cd frontend && npm run build`; `make seed-dev-user`; `make e2e`; in-app Browser at `http://127.0.0.1:5173/projects/e64eb07f-d37b-4350-896d-63287df0220c/status` showed the populated editor status timeline with no console warnings/errors after sign-in/navigation. |
| TB-03.5 | Not started | 2026-05-12 | Frontend structure follow-up recorded from TB-03 review; no implementation yet. |
| TB-04 | Not started | 2026-05-12 | - |
| TB-04b | Not started | 2026-05-12 | - |
| TB-05 | Not started | 2026-05-12 | - |
| TB-06 | Not started | 2026-05-12 | - |
| TB-07 | Not started | 2026-05-12 | - |
| TB-08 | Not started | 2026-05-12 | - |
| TB-09 | Not started | 2026-05-12 | - |
| TB-10 | Not started | 2026-05-12 | - |
| TB-11 | Not started | 2026-05-12 | - |
| TB-12 | Not started | 2026-05-12 | - |
| TB-13 | Not started | 2026-05-12 | - |
| TB-14 | Not started | 2026-05-12 | - |
| TB-15 | Not started | 2026-05-12 | - |
| TB-16 | Not started | 2026-05-12 | - |
| TB-17 | Not started | 2026-05-12 | - |
| TB-18 | Not started | 2026-05-12 | - |
| TB-19 | Not started | 2026-05-12 | - |

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
