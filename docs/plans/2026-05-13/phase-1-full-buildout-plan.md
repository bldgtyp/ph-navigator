---
DATE: 2026-05-13
TIME: 10:30 EDT
STATUS: Planning artifact. No implementation started from this plan.
AUTHOR: Ed May (with Codex)
SCOPE: Full build-out plan for the Phase 1 tracer-bullet surfaces after
       TB-00 through TB-06 proved the architecture.
RELATED:
  - context/PRD.md
  - context/TECHNICAL_REQUIREMENTS.md
  - context/USER_STORIES.md
  - context/UI_UX.md
  - context/technical-requirements/data-table.md
  - context/user-stories/00-foundation-shell.md
  - context/user-stories/30-tables-equipment.md
  - context/user-stories/50-settings-ops-llm.md
  - docs/plans/01_IMPLEMENTATION-ROADMAP.md
  - docs/code-reviews/2026-05-13/phase-1-code-review-synthesis.md
  - research/poc-plans/grid-spike-results.md
  - research/poc-plans/poc-evaluation.md
  - research/poc-plans/poc-lessons-for-real-build.md
---

# Phase 1 Full Build-Out Plan

## Purpose

TB-00 through TB-06 proved the vertical architecture: auth, project shell,
public read-only access, relational Status, versioned JSONB project
documents, draft ETags, Rooms as the first editable table, Save / Save As /
Discard / Lock, JSON downloads, same-editor tab coordination, and MCP
read access.

This plan turns those tracer bullets into the full Phase 1 product surface
before the project clones the pattern into catalogs, Windows, Envelope,
Model, broader equipment tables, or MCP writes.

## Scope Interpretation

For this plan, "Phase 1" means the surfaces exercised by TB-00 through
TB-06 and their directly referenced story requirements:

- foundation app shell, auth/session behavior, dashboard, project create/open;
- project workspace shell, header, version controls, public read-only mode;
- Status tab as the default project lifecycle surface;
- Project Settings modal items needed by current Phase 1 workflows, including
  project metadata and MCP token issue/list/revoke;
- `ProjectDocumentV1` draft/version lifecycle for one editable table surface;
- Equipment -> Rooms as the first real project-document table;
- shared table UI extraction needed so Rooms is not left on the tracer stub;
- read-safe-mode fallback for older or invalid saved documents;
- MCP read/token administration already introduced by TB-04b.

Out of scope for this plan unless explicitly pulled forward:

- full Catalog Manager build-out;
- Windows, Envelope, Model viewer, assets, imports, exports, ERVs, Fans, Pumps,
  Thermal Bridges, and MCP write tools;
- public-share management, strict project ACL, real-time collaboration, and
  named/shareable table views.

## Planning Principles

- Preserve the architecture that worked. The JSONB document body remains the
  Phase 1 source of truth; do not add relational shadows for project tables.
- Close tracer debt before feature expansion. Rooms should become the proving
  case for the reusable table/draft/version path, not a special case copied
  into later tabs.
- Work in browser-verifiable vertical slices. Each slice should have a local
  and staging happy path before it is marked done.
- Keep implementation authors responsible for detailed code shape. This plan
  names boundaries, gates, and user-visible outcomes; it does not prescribe
  contracts, schemas, or code snippets.
- Treat the Table POC as binding UX precedent. Phase 1 table completion is not
  just "rows render"; it must preserve the AirTable-like interaction feel that
  the POC validated.

## Definition Of Done

Phase 1 is fully built out when all of these are true:

- TB-06 has staging browser evidence and no remaining "local complete only"
  status.
- The Phase 1 code-review P0 items are resolved or explicitly re-scoped in the
  roadmap with a named owner slice.
- Project document table routes, draft/version state, and header controls are
  table-neutral from the user's perspective.
- Rooms uses the real shared table primitive, not `TablePrimitiveStub`.
- Rooms satisfies the relevant US-Builder-Tables and US-EQ-2 acceptance
  criteria that are in Phase 1 scope.
- Status satisfies the MVP US-Status criteria or records deliberate deferrals.
- Project Settings exposes the Phase 1 metadata and MCP-token workflows, with
  Viewer/edit affordance separation.
- Read-safe-mode renders a recoverable read-only UI for invalid/unsupported
  saved project documents, or the roadmap explicitly downgrades Phase 1 to
  download-only recovery and names the follow-up.
- BLDGTYP brand tokens, fonts, colors, radii, shell components, dialogs,
  toasts, and table styling are wired enough that the app no longer reads as
  an unstyled scaffold.
- Technical requirements touched by Phase 1 have tests, browser checks, and
  staging evidence recorded in `docs/plans/01_IMPLEMENTATION-ROADMAP.md`.

## Workstream Map

| Workstream | Goal | Main source docs |
|---|---|---|
| A. Close tracer gates | Finish TB-06 staging evidence and align roadmap state. | Roadmap TB-06, code review synthesis |
| B. Architecture cleanup | Make document/draft/table/version boundaries reusable. | Code review P0, PRD §§6-10, technical requirements |
| C. Product shell completion | Finish dashboard, header, settings, Status, read-only mode. | `00-foundation-shell.md`, `50-settings-ops-llm.md`, `UI_UX.md` |
| D. Design-system pass | Apply BLDGTYP tokens and shadcn/Tailwind component language. | `UI_UX.md`, BLDGTYP branding tokens |
| E. DataTable extraction | Build the real shared table surface from the POC lessons. | `data-table.md`, `30-tables-equipment.md`, POC docs |
| F. Rooms completion | Move Rooms onto the shared table and finish its story criteria. | US-EQ-2, save/versioning, data model |
| G. Version/draft UX completion | Restore/discard, dirty-switch, diff/download, stale-draft UX. | save-versioning, API, US-Versions, US-Concurrency |
| H. Hardening and traceability | Matrix requirements to tests/browser checks/staging evidence. | all Phase 1 docs |

## Sequenced Slices

### P1-00 - Phase 1 Baseline And Gap Matrix

Goal: create the working inventory before changing code.

Includes:

- rerun the current local smoke/test path and capture TB-06 staging status;
- inventory Phase 1 user-story criteria against current implementation;
- inventory Phase 1 technical requirements against tests and browser checks;
- classify each gap as "must finish now", "explicit Phase 1 deferral", or
  "later phase".

Completion gate:

- a short requirements matrix is appended to this plan or linked from the
  roadmap;
- TB-06 staging check is either complete or the exact blocker is recorded.

### P1-01 - Code-Review P0 Architecture Close-Out

Goal: resolve the review issues that would otherwise be copied into Phase 2.

Includes:

- split project-document responsibilities enough that draft, version, diff,
  download, table-read, and table-write behavior are reviewable separately;
- add a table registry boundary so generic table routes are not Rooms-only in
  disguise;
- make unsupported table behavior registry-owned;
- keep public URLs and behavior stable.

Completion gate:

- existing Rooms, draft, save/version, download, and MCP-read behavior still
  pass;
- adding the next table would be a registration task, not a route/service
  fork;
- no user-visible behavior changes beyond clearer error handling.

### P1-02 - Document Summary And Header Decoupling

Goal: make project header/version chrome table-neutral.

Includes:

- document-level draft summary state for the header;
- Save, Save As, Discard, Lock/Unlock, diff, and clean/dirty indicators based
  on document state rather than Rooms query state;
- frontend feature ownership for document/version chrome;
- removal of direct Rooms/Equipment coupling from project shell controls.

Completion gate:

- the header detects a dirty draft no matter which table creates it;
- current Rooms workflows still save, discard, lock, unlock, diff, and download;
- browser smoke covers clean, dirty, locked, Viewer, and public read states.

### P1-03 - Read-Safe-Mode Completion

Goal: finish the older/invalid document recovery story.

Includes:

- explicit decision on full fallback envelope versus Phase 1 download-only
  recovery;
- if implemented now, a read-only workspace fallback with raw JSON download,
  diagnostic copy for editors, and write controls disabled;
- if deferred, roadmap and technical requirements updated so the acceptance
  downgrade is visible.

Completion gate:

- opening an invalid/unsupported saved body never traps the user in a broken
  tab;
- raw project JSON remains downloadable;
- tests and browser check cover the recovery path.

### P1-04 - BLDGTYP Design-System Foundation

Goal: move the app from scaffold styling to the V2 product language.

Includes:

- Tailwind/shadcn setup aligned to BLDGTYP CSS tokens;
- Outfit and JetBrains Mono usage where the UI narrative calls for them;
- shared app primitives for buttons, dialogs, popovers, toasts, tabs, table
  chrome, badges, status pills, read-only banners, and empty states;
- project workspace shell polish: global header, project header, tab bar,
  version picker, Save status, IP/SI toggle placement, Viewer pill;
- light/dark token posture if cheap, without making dark mode a separate
  feature goal.

Completion gate:

- sign-in, dashboard, project shell, Status, Equipment/Rooms, settings, and
  version dialogs use one consistent visual language;
- no Phase 1 feature adds new one-off global CSS when a shared primitive fits;
- desktop and narrow-tablet browser screenshots show no overlapping text or
  broken controls.

### P1-05 - Dashboard And Project Shell Completion

Goal: finish the Phase 1 shell stories enough that later tabs land inside a
stable frame.

Includes:

- dashboard project rows with the MVP metadata called out in the stories;
- pin/reorder behavior if still considered Phase 1 MVP after the gap matrix;
- New Project modal polish and validation feedback;
- Catalogs dropdown routing without building full catalog management;
- workspace header, breadcrumbs, tab routing, Viewer/read-only separation;
- no AirTable affordance.

Completion gate:

- editor can sign in, create/open projects, navigate tabs, return to dashboard,
  and open the same URL as a Viewer;
- all write affordances are server-gated, not only hidden in the frontend;
- staging browser path records the same flow.

### P1-06 - Status Tab Full MVP

Goal: move Status from tracer feature to complete Phase 1 workflow.

Includes:

- default empty state with the three expected actions;
- populated vertical timeline with current-step visual;
- full add/edit/delete/state/date/description behavior;
- sanitized Markdown display and preview/edit path if kept in Phase 1;
- drag reorder plus keyboard fallback, or an explicit deferral if drag remains
  intentionally cut;
- public Viewer read-only rendering;
- MCP-callable status endpoints aligned with current MCP read scope.

Completion gate:

- US-Status criteria are checked off or deliberately deferred in the gap
  matrix;
- local and staging browser checks cover empty state, template apply, edit,
  reorder, delete, Viewer read-only, and current-step visual.

### P1-07 - Project Settings And MCP Token UI

Goal: make settings/token administration user-accessible, not backend-only.

Includes:

- Project Settings modal from the project header overflow menu;
- editable Phase 1 project metadata;
- MCP token issue/list/revoke UI with plaintext token shown once;
- token scope/status clarity and revoked-token behavior surfaced;
- no project delete in settings, consistent with the story decision.

Completion gate:

- editor can create and revoke a project-scoped MCP token without admin scripts;
- revoked token fails on the next MCP request with structured feedback;
- Viewer cannot open settings or issue tokens.

### P1-08 - Shared DataTable Extraction

Goal: replace the tracer table with the real reusable table primitive.

Includes:

- TanStack Table plus virtualization path from the POC decision;
- stable row-id based selection/editing state;
- active cell, keyboard navigation, frozen identifier column, row gutter;
- rectangular selection, copy as TSV and HTML, and paste planning;
- fill handle and bounded local undo if kept in Phase 1 scope;
- stacked sort/filter/group toolbar, local view state, and reset action;
- read-only mode that preserves sort/filter/group/copy but hides edit actions;
- accessibility baseline from the UI narrative.

Completion gate:

- POC carry-forward behaviors have targeted helper tests where brittle;
- browser checks compare the extracted table against the POC workflows:
  selection/copy, paste with overflow, single-select paste, grouping/sorting,
  fill/undo if included;
- implementation authors record any intentional POC behavior cuts before Rooms
  migrates.

### P1-09 - Single-Select Field And Option Manager

Goal: finish the user-defined single-select behavior Rooms depends on.

Includes:

- shared single-select field behavior for display, edit, paste coercion, sort,
  filter, option colors, missing-option warnings, and duplicate prevention;
- header option-management modal for rename, reorder, recolor, delete, and
  merge/replace decisions;
- paste match-or-create behavior from the POC, with all-or-nothing validation;
- option-order sorting for `floor_level`.

Completion gate:

- Rooms `floor_level` and `building_zone` use the same shared field behavior;
- option reorder visibly changes single-select sort order;
- bad/missing option references block save and show recoverable UI.

### P1-10 - Rooms Full MVP On Shared DataTable

Goal: complete US-EQ-2 on top of the shared table path.

Includes:

- default Rooms columns, validation, natural sort, add row, row-detail modal,
  inline edit where appropriate, delete, notes, JSON download, locked/Viewers;
- required/nullable single-select handling;
- uniqueness behavior for room numbers;
- iCFA factor clamp and numeric input handling;
- ERV assignment field represented in a forward-compatible way until full ERV
  rows land;
- explicit no-sync-from-HBJSON copy and workflow posture.

Completion gate:

- US-EQ-2 criteria are checked off or intentionally deferred;
- Rooms edit/save/save-as/discard/lock/download/diff flows still work after
  migrating off the stub;
- public Viewer can sort/filter/copy Rooms without edit affordances.

### P1-11 - Draft, Version, And Concurrency UX Completion

Goal: make the file-app lifecycle safe enough for real Phase 1 use.

Includes:

- restore/discard prompt on project/version open when a draft exists;
- dirty-draft prompt before version switch;
- beforeunload warning for dirty draft state;
- stale draft and ETag conflict UI;
- same-editor tab conflict behavior generalized enough for future tables;
- live lock downgrade behavior;
- clear local undo invalidation rules around Save, Save As, Discard, refetch,
  ETag mismatch, and other-tab changes.

Completion gate:

- no silent overwrite path exists in normal browser use;
- conflicts preserve local unsaved edits until the user chooses an action;
- browser checks include two tabs, locked version, stale write, restore, and
  discard.

### P1-12 - Diff, Downloads, Schemas, And API Docs Baseline

Goal: finish the inspectability surface expected by Phase 1.

Includes:

- project JSON and table JSON downloads for the current version/draft posture;
- version-vs-version and version-vs-draft diff UX at the planned stub level;
- OpenAPI and project/table schema endpoints that Phase 1 tools can rely on;
- request IDs and structured errors visible enough for user support.

Completion gate:

- users can download raw project JSON from normal and recovery states;
- diff is good enough to explain what changed in Rooms/Status-related flows;
- schema/OpenAPI endpoints exist or are explicitly deferred before MCP writes.

### P1-13 - Phase 1 Hardening, Docs, And Release Gate

Goal: mark Phase 1 done with evidence, not vibes.

Includes:

- requirements matrix completed;
- roadmap ledger updated with local and staging evidence;
- targeted backend/frontend/e2e tests for every Phase 1 behavior that can
  regress silently;
- docs-pass over `context/` only where implementation changed decisions;
- unresolved questions moved to the open-question router or later roadmap
  slices.

Completion gate:

- `make lint`, `make typecheck`, `make test`, `make e2e`, and staging browser
  checks pass for Phase 1 paths;
- no active Phase 1 item remains "local complete; staging pending";
- next-phase work can start without inheriting tracer-only table or document
  coupling.

## Table POC Carry-Forward Checklist

The Phase 1 DataTable work should explicitly account for these POC decisions:

- TanStack Table v8, not AG Grid Community.
- Stable row IDs are the canonical identity for active/edit/selection state.
- Row gutter is table chrome, not schema data.
- Column definitions stay display/field oriented; table chrome owns focus,
  selection, editing state, and overlays.
- Field definitions drive render, edit, clipboard coercion, sort, filter, and
  validation.
- Native copy/paste events are preferred for reliable clipboard behavior.
- Paste is planned as one gesture and commits all-or-nothing.
- Single-select paste creates options and cell writes as one undoable gesture.
- Focus ring, selection outline, sticky/frozen columns, and popovers need
  separate styling/layering channels.
- The toolbar owns sort/filter/group/hide/color state; table body receives
  visual tints and grouped accordion output.
- POC `window.confirm` shortcuts must become real dialogs.
- Runtime schema editing remains out of Phase 1 unless the gap matrix proves
  it is necessary.

## Code-Review Flag Mapping

| Review flag | Plan slice |
|---|---|
| `project_document` workflow coupling | P1-01 |
| Generic table routes are Rooms-specific | P1-01 |
| Header/version chrome coupled to Rooms | P1-02 |
| TB-06 read-safe-mode acceptance gap | P1-03 |
| Shared table draft broadcast is Rooms-specific | P1-11 |
| `TablePrimitiveStub` is temporary | P1-08 through P1-10 |
| Styling stack drift from Tailwind/shadcn/tokens | P1-04 |
| OpenAPI/schema endpoint timing | P1-12 |
| MCP should remain a thin facade over services | P1-07, P1-12, later MCP write slices |
| Idempotency support before repeated mutating clients | P1-11 or later MCP-write gate |

## Technical Requirements Coverage Map

| Technical requirement file | Phase 1 coverage |
|---|---|
| `data-model.md` | P1-01 keeps project tables in JSONB without relational shadows; P1-09/P1-10 complete Rooms and single-select document behavior; P1-07 covers MCP token metadata already introduced in TB-04b. |
| `save-versioning.md` | P1-02 makes draft/version state table-neutral; P1-03 closes read-safe recovery; P1-11 completes restore/discard, dirty-switch, stale-write, same-editor tab, and lock-downgrade UX. |
| `api.md` | P1-01/P1-02 align generic table and draft summary endpoints with the public route shape; P1-12 covers downloads, diff, OpenAPI/schema baseline, structured errors, and request IDs. |
| `llm-mcp-schema.md` | P1-07 exposes token administration in the UI; P1-12 makes schema/OpenAPI availability explicit before write-capable MCP work; later MCP write tools stay out of this Phase 1 close-out. |
| `frontend-viewer-units.md` | P1-04/P1-05 finish the app shell and display posture; P1-11 completes the three-layer editor-state UX for the Phase 1 document surface. |
| `data-table.md` | P1-08 extracts the shared table; P1-09 completes single-select behavior; P1-10 proves the real table against Rooms. |
| `stack-auth-migration.md` | P1-05/P1-07 complete visible auth/session-adjacent workflows for Phase 1; P1-13 verifies the raw-SQL, lint/test/typecheck, and staging gates remain intact. |

## User Story Coverage Map

| Story area | Phase 1 coverage |
|---|---|
| US-0 Sign in | P1-05 confirms sign-in/session behavior remains stable after shell/design work. |
| US-1 Dashboard | P1-05 covers project list, metadata, create/open, Catalogs routing, and optional pin/reorder decision. |
| US-1.5 Access checks | P1-05 and P1-13 verify server-side editor/viewer gates across Phase 1 routes. |
| US-3 Workspace shell | P1-04/P1-05 finish header, tabs, breadcrumbs, version controls, read-only shell, and no-AirTable posture. |
| US-3.1 / US-Versions-Lifecycle | P1-02, P1-11, and P1-12 finish table-neutral header state, dirty-switch prompts, diff, downloads, lock/unlock, Save, Save As, and Discard. |
| US-Concurrency | P1-11 completes same-editor browser-tab behavior and named deferrals for MCP write leases. |
| US-Errors-SchemaFallback | P1-03 closes or explicitly re-scopes read-safe-mode. |
| US-Status | P1-06 completes timeline, template, edit, reorder, Markdown, Viewer, and MCP-read/list posture. |
| US-Builder-Tables | P1-08 and P1-09 extract the shared table and field behavior from the POC. |
| US-Builder-Equipment / US-EQ-2 Rooms | P1-10 completes the Rooms sub-tab on the shared table. |
| US-Settings | P1-07 adds the Project Settings modal and MCP token workflows. |
| C-1 Action logging | P1-07/P1-13 verify Phase 1 token/status/version actions record enough audit context where already implemented. |
| C-2 Header consistency | P1-04/P1-05 align the global and project headers. |
| NEW-LLM-API-1 | P1-07/P1-12 cover Phase 1 read/token surfaces; write-capable MCP remains a later slice. |

## UI / UX Coverage Map

| UI area | Phase 1 coverage |
|---|---|
| BLDGTYP tokens, fonts, colors, radius, motion | P1-04 |
| Global header, breadcrumb, Catalogs menu, account menu | P1-04/P1-05 |
| Modals, popovers, toasts, empty states, session-expiry pattern | P1-04, then applied in P1-05 through P1-11 |
| Project header, version dropdown, save status, overflow menu, IP/SI toggle placement | P1-02/P1-04/P1-05/P1-11 |
| Dashboard row layout and New Project flow | P1-05 |
| Status timeline | P1-06 |
| Equipment/Rooms table workbench | P1-08/P1-10 |
| Viewer public read mode | P1-05/P1-10/P1-13 |

## HITL / Decision Points

These should be resolved deliberately, not hidden inside implementation PRs:

1. Whether Phase 1 implements full read-safe-mode now or explicitly accepts
   download-only recovery until a later hardening slice.
2. Whether Status drag reorder remains Phase 1 scope or the explicit up/down
   controls are accepted as the MVP reorder surface.
3. Whether dashboard pin/reorder remains Phase 1 scope after the gap matrix.
4. Whether DataTable fill handle and bounded undo are required for Phase 1
   Rooms, or land immediately after table extraction.
5. Whether OpenAPI/schema endpoints must land before declaring Phase 1
   complete, or only before MCP write tools.
6. Whether idempotency-key support is needed before Phase 1 close-out or can
   wait until repeated MCP/browser mutating flows.

## Recommended Execution Order

1. P1-00: baseline and gap matrix.
2. P1-01 through P1-03: architecture and recovery gates.
3. P1-04: design-system foundation before large UI polish.
4. P1-05 through P1-07: shell, Status, Settings.
5. P1-08 and P1-09: shared table and single-select core.
6. P1-10: Rooms migration/completion.
7. P1-11 and P1-12: lifecycle, concurrency, diff/download/schema hardening.
8. P1-13: final evidence pass.

This order keeps the riskiest reusable boundaries ahead of the most visible
feature polish, while still producing browser-verifiable user-facing progress
throughout the work.

## Suggested Roadmap Integration

After this plan is accepted:

- add P1-00 through P1-13 as a new "Phase 1 Full Build-Out" block in
  `docs/plans/01_IMPLEMENTATION-ROADMAP.md`;
- leave TB-00 through TB-06 as the historical tracer-bullet ledger;
- do not start TB-07 catalog work until P1-01, P1-02, P1-03, and the DataTable
  extraction gate have either landed or been explicitly re-scoped.
