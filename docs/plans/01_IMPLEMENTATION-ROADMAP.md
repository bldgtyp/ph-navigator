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
| Repo split: one repo or two | TB-00 | Confirm before scaffold starts |
| Generated OpenAPI/TS client in CI from day 1 | TB-02 or TB-04 | Lean yes, keep client thin |
| V2 staging URL | TB-02 | Render staging from TB-02; custom domain post-MVP |
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
| Type | HITL for repo-split confirmation; otherwise AFK |
| Status | [ ] Not started |
| Goal | Backend, DB, and frontend boot; the browser can display backend health/version. |
| Includes | Minimal repo scaffold; Docker Postgres path; backend settings; Alembic baseline; `/api/v1/health` and `/api/v1/version`; frontend route that reads and displays service status; initial Make recipes for setup/dev/smoke; CI workflow (GitHub Actions) running lint + tests + build on push and PR, no deploy yet. |
| Tests | Backend health/version contract; DB connectivity smoke; frontend service-status fetch only if state is non-trivial. |
| Browser check | Start dev stack, open the frontend, see live backend health/version from `/api/v1`. |
| Lessons | Record scaffold choices, tooling friction, and any command naming that did not work. |

### TB-01 - Sign-In To Empty Dashboard

| Field | Plan |
|---|---|
| Type | AFK after seed credentials are agreed |
| Status | [ ] Not started |
| Goal | Editor signs in and lands on an empty dashboard. |
| Includes | Users/session schema; password hashing; seed user command; login/logout/session API; dashboard shell; auth guard; request IDs and structured errors. |
| Tests | Password/session rules; single-active-session behavior; auth dependency; login/logout API. |
| Browser check | Sign in as seed editor, refresh, remain signed in, sign out, protected dashboard redirects to sign-in. |
| Lessons | Record auth/session decisions and any dev-login shortcuts explicitly accepted or rejected. |

### TB-02 - Create And Open Project Shell

| Field | Plan |
|---|---|
| Type | HITL for staging URL and deploy credentials; otherwise AFK |
| Status | [ ] Not started |
| Goal | Editor creates a project, opens `/projects/{id}/status`, and sees the workspace shell; the same shell is reachable on staging. |
| Includes | Project and initial version metadata; owner dashboard query; project create/list/open API; access-check dependency; shell header, tab bar, version dropdown placeholder, settings menu placeholder; public read route with edit controls hidden; first staging deploy (Render) for backend + frontend so subsequent slices can be verified end-to-end against a real environment. |
| Tests | `bt_number` uniqueness; project create/list/open contracts; view vs edit access dependency; public write rejection for one representative mutating route. |
| Browser check | Create project from dashboard, open Status tab, copy URL into signed-out context, confirm read-only shell. Re-run the same happy path against the staging URL. |
| Lessons | Record URL/access assumptions, shell navigation choices, and any deploy/staging friction. |

### TB-03 - Status Tab Lifecycle

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | Status tab has the default cert-agnostic tracker and editable item state. |
| Includes | `project_status_items` relational table; apply default template; add/edit/reorder/delete item workflow as scoped for v1; current-step visual; read-only public display. |
| Tests | State enum and completion-date rules; default template creation; reorder/delete behavior; API tests for non-trivial transitions. |
| Browser check | Apply default template, mark an item done, edit completion date, delete one item, reload, confirm public viewer can read but not edit. |
| Lessons | Record why Status stays relational and outside `ProjectDocumentV1`. |

### TB-04 - Minimal Project Document And Rooms Draft

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | First project-document edit path works through Rooms without version-save polish. Not user-visible on its own: drafts created here have no terminal action until TB-05 ships Save/Discard. |
| Includes | `ProjectDocumentV1` minimal body with empty tables; Rooms and single-select option structures; draft row created on first edit; table-slice read; guarded draft patch; minimal Equipment -> Rooms UI using the shared DataTable path. |
| Tests | Pydantic document validation; golden empty document; guarded patch rules; Rooms row validation; single-select duplicate/missing-option rules. |
| Browser check | Add a room, edit floor level and building zone options, reload, restore draft, confirm row remains in draft. |
| Lessons | Record document-shape decisions and any DataTable scope cut made to keep the slice thin. |

### TB-04b - MCP Read-Only Tracer

| Field | Plan |
|---|---|
| Type | HITL for MCP transport decision and local client setup |
| Status | [ ] Not started |
| Goal | Claude can authenticate via MCP and read project + draft state through a real local client. De-risks transport, token, and access-check choices before TB-05 introduces version semantics. |
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
| Includes | Same-editor tab coordination; stale ETag handling; dirty-draft warning; restore/discard prompt; read-safe-mode fallback for older or invalid schema bodies. |
| Tests | Same-editor disjoint edit path; same-scope stale conflict; schema fallback raw-body download; draft age metadata if present. |
| Browser check | Open two tabs to one project, edit in one, verify the other handles stale state without silent overwrite. |
| Lessons | Record UX tradeoffs around force-reload vs merge. |

### TB-07 - Catalog Manager Tracer

| Field | Plan |
|---|---|
| Type | AFK |
| Status | [ ] Not started |
| Goal | One catalog can be managed in the app and read by downstream pickers. |
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
| Includes | Final smoke script; OpenAPI/schema docs generated from code; one V1 import script path; performance/bundle sanity against the TB-15 baseline; unresolved question triage; docs cleanup. |
| Tests | Full `make test`, lint/format gates, Playwright e2e smoke, import fixture validation, public read/write-negative smoke. |
| Browser check | On staging, sign in, open seed project, import/open one V1 project, edit/save one table, upload/view HBJSON, verify public read-only URL. |
| Lessons | Record deployment friction, import assumptions, and remaining post-MVP work. |

## Progress Ledger

| Slice | Status | Last updated | Verification evidence |
|---|---|---|---|
| TB-00 | Not started | 2026-05-12 | - |
| TB-01 | Not started | 2026-05-12 | - |
| TB-02 | Not started | 2026-05-12 | - |
| TB-03 | Not started | 2026-05-12 | - |
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

- Pending.
