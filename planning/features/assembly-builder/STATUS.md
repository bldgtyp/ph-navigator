---
DATE: 2026-05-27
TIME: 22:30 EDT
STATUS: Active progress and next-steps tracker. Phases 9-12 added as a
       foundation refactor bundle ahead of UI/UX polish.
AUTHOR: Codex / Claude (Opus 4.7)
SCOPE: Assembly Builder implementation progress after Phases 1-3 were
       flattened into main, plus the foundation refactor bundle informed
       by the 2026-05-27 code review.
RELATED:
  - planning/features/assembly-builder/PRD.md
  - planning/features/assembly-builder/README.md
  - planning/features/assembly-builder/phases/phase-04-materials-picker-specifications.md
  - planning/features/assembly-builder/phases/phase-09-backend-service-split.md
  - planning/features/assembly-builder/phases/phase-10-frontend-page-dialog-split.md
  - planning/features/assembly-builder/phases/phase-11-shared-constants-helpers.md
  - planning/features/assembly-builder/phases/phase-12-docs-and-test-reorg.md
  - planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md
---

# Assembly Builder Progress And Next Steps

## Current State

Assembly Builder Phases 1-3 are flattened into `main` as commit
`5c687c9` (`Add assembly builder phases 1-3`). The phase worktrees and
remote phase branches were removed after the squash merge.

Phases 4-8 are implemented on Assembly Builder feature branches after
the Phase 1-3 flatten. The active branch is
`codex/assembly-builder-phase-07`.

Completed implementation surface:

- typed backend envelope document/read contracts;
- registered envelope table/read models for `assemblies[]` and
  `project_materials[]`;
- read-only Envelope route, Assemblies canvas, sidebar, and
  Specifications scaffolds;
- semantic `POST /draft/envelope/commands` endpoint;
- assembly create/rename/type/duplicate/delete commands;
- layer and segment add/update/delete commands with guard behavior;
- orientation/layer-order flip commands;
- copy/paste material-assignment command;
- editor dialogs and unit-aware length inputs for layer thickness,
  segment width, and stud spacing;
- in-modal IP/SI preference toggle that keeps active numeric draft
  strings stable until submit;
- project-material catalog copy-in, shared material editing,
  detach-to-custom, and unused cleanup;
- backend thermal overlays and saved-version-only HBJSON construction
  export;
- datasheet and site-photo evidence attachment workflows in
  Specifications;
- project-material catalog drift report, drift badges, review summary,
  and explicit per-material refresh command/dialog.
- MCP envelope read/report tools and a semantic envelope command write
  tool that shares the browser command boundary and tags drafts as
  `updated_via='mcp'`.

## Verified Gates

Latest flatten verification from `main`:

- `git diff --cached --check`
- `cd backend && uv run ruff check features/envelope tests/test_envelope_phase03.py`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase03.py`
- `cd backend && uv run pytest tests/test_envelope_phase01.py tests/test_envelope_phase03.py`
- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm run lint`
- `cd frontend && pnpm run check:shape && pnpm run build`

Browser smoke completed before flatten on the Phase 03 worktree:

- opened seeded AB-02 assembly project;
- restored draft;
- renamed an assembly;
- edited layer thickness;
- toggled IP/SI while a modal was open;
- copy/pasted a segment assignment;
- saved and reloaded to a clean saved state.

## Known Caveats

- Full backend `uv run ty check` remains blocked by the pre-existing
  custom-field / project-document baseline noted during Phase 1. Use
  scoped envelope Ty gates until that baseline is reconciled.
- Full frontend `pnpm exec tsc --noEmit` is currently dominated by
  unrelated equipment/custom-field transition errors in the dirty
  worktree. Use filtered Envelope/Catalog type output plus targeted
  Envelope tests until that branch is reconciled.
- `make smoke` remains blocked locally when another worktree owns the
  shared Docker container name `phn-v2-postgres`.
- Main still has unrelated local worktree dirt outside Assembly Builder
  tracking (`.claude/worktrees/` and the Plan 31 file move). Do not fold
  that into Assembly Builder commits unless explicitly asked.

## Phase 4 Active Progress

Implemented on `codex/assembly-builder-phase-04` so far:

- backend command DTOs and service handling for
  `pick_project_material`, `pick_catalog_material`,
  `hand_enter_material`, `update_project_material`,
  `update_segment_use_site_notes`, `detach_segment_material`, and
  `remove_unused_project_materials`;
- backend catalog copy-in from the current Materials catalog record,
  with project-material de-dupe by catalog record id and explicit
  ambiguity rejection when multiple project materials share the same
  origin;
- shared material update behavior with catalog-origin
  `local_overrides` tracking against canonical SI values;
- detach-to-custom behavior that copies product values, datasheets,
  status, and notes, clears `catalog_origin`, and leaves segment
  use-site notes/photos on the segment;
- frontend Segment Properties material picker for existing project
  materials, catalog materials, hand-entered materials, detach, and the
  shared material value editor;
- frontend Specifications editing for status, product values, notes,
  segment-owned use-site notes, and unused-material cleanup;
- lazy Materials catalog query only while the editable Segment
  Properties dialog is open, so normal Envelope reads do not add an
  unrelated catalog dependency;
- simplify pass extracted the shared project-material editor and modal
  unit toggle into dedicated components, moved catalog-origin typing to
  a shared project-document type, and replaced the segment dialog's
  partial-command cast with explicit material callbacks;
- simplify pass changed Specifications editing to mount material and
  use-site note editors on demand instead of mounting controlled forms
  for every visible material/use-site;
- simplify pass added frontend dirty guards for material and use-site
  note edits and a backend no-op guard for project-material table
  replacement.

Verified on this branch:

- `cd backend && uv run ruff check features/envelope tests/test_envelope_phase04.py`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase04.py`
- `cd backend && uv run pytest tests/test_envelope_phase04.py`
- `cd frontend && pnpm exec prettier --write src/features/catalogs/hooks.ts src/features/envelope/components/EnvelopeEditorDialogs.tsx src/features/envelope/components/SpecificationsPanel.tsx src/features/envelope/components/ProjectMaterialEditor.tsx src/features/envelope/components/ModalUnitToggle.tsx src/features/envelope/routes/EnvelopePage.tsx src/features/envelope/types.ts src/features/windows/types.ts src/features/project_document/catalog-origin.ts`
- `cd frontend && pnpm exec eslint src/features/envelope src/features/catalogs/hooks.ts src/features/windows/types.ts src/features/project_document/catalog-origin.ts`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/features/catalogs/hooks|src/features/project_document/catalog-origin|src/features/windows/types" || true`

Remaining before Phase 4 closure:

- add direct frontend tests for material pick/catalog pick/hand-enter,
  Specifications value editing, IP/SI material editor submission, and
  use-site note commands;
- browser-smoke the Phase 4 checklist against a seeded project;
- reconcile or isolate unrelated frontend typecheck failures enough to
  run the full build gate;
- decide whether picker catalog grouping/search needs a richer widget
  before Phase 4 is marked complete.

## Next Implementation Target

Continue Phase 8 from
`planning/features/assembly-builder/phases/phase-08-mcp-hardening-release.md`.

Primary goal:

- harden scale/performance behavior, accessibility, browser workflows,
  docs, and release readiness across the accumulated Assembly Builder
  slices.

Phase 5 implemented so far on `codex/assembly-builder-phase-05`:

- `GET /envelope/assemblies/{assembly_id}/thermal` over draft or saved
  source with SI canonical R/U values, input hash, warnings, and
  unfinished flags;
- construction-only PH-average thermal calculation for assigned valid
  segments, with null material segments flagged but not blocking the
  preview value when remaining assigned layers are valid;
- `GET /envelope/export/hbjson` that reads the saved version body only,
  rejects incomplete assemblies with structured 422 paths, and exports
  project-material ids, catalog origin, datasheet asset ids, and
  `ref_status` metadata;
- shared thermal issue records used by preview status, selectors, and
  HBJSON export errors;
- Envelope header thermal label that switches between SI U-value and IP
  R-value using shared unit helpers;
- shared frontend/backend download helpers for HBJSON blob delivery and
  JSON attachment responses;
- assembly-scoped thermal query invalidation for local envelope commands
  with broad invalidation retained for shared material or assembly-list
  changes;
- dirty-draft warning before HBJSON download.

Verified on this branch:

- `cd backend && uv run ruff check features/envelope tests/test_envelope_phase04.py tests/test_envelope_phase05.py`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase05.py`
- `cd backend && uv run pytest tests/test_envelope_phase04.py tests/test_envelope_phase05.py`
- `cd backend && uv run ruff check features/envelope features/shared features/project_document/routes.py tests/test_envelope_phase05.py`
- `cd backend && uv run ty check features/envelope features/shared/responses.py tests/test_envelope_phase05.py`
- `cd frontend && pnpm exec prettier --write src/shared/api/client.ts src/features/envelope/api.ts src/features/envelope/hooks.ts src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm exec eslint src/features/envelope src/features/catalogs/hooks.ts src/features/project_document/catalog-origin.ts src/features/windows/types.ts`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- `cd frontend && pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/features/catalogs/hooks|src/features/project_document/catalog-origin|src/features/windows/types" || true`

Remaining before Phase 5 closure:

- add steel-stud equivalent-conductivity regression once the exact AISI
  helper dependency/fixture is available in V2 or replaced with a
  documented deterministic local implementation;
- browser-smoke the full Phase 5 checklist, including downloaded HBJSON
  inspection;
- decide whether the current hand-authored Honeybee-compatible JSON
  shape is enough for V1 export parity or whether V2 should add a
  Honeybee package dependency for stricter object serialization.

## Phase 6 Progress - Evidence Attachments And Site Photos

Implementation target:
`planning/features/assembly-builder/phases/phase-06-evidence-attachments-site-photos.md`.

Phase 6 is active on `codex/assembly-builder-phase-06`, based on the
Phase 5 branch tip.

Current implementation notes, verification commands, and closure
checklist live in
`planning/features/assembly-builder/phases/phase-06-evidence-attachments-site-photos.md`.

Headline status: Specifications evidence UI is wired to the generic
asset attach/detach backbone with backend/frontend tests. Browser smoke,
Save As / prior-version resolution proof, and destructive photo-count
dialogs remain before Phase 6 closure.

## Phase 7 Progress - Catalog Refresh And Drift

Implementation target:
`planning/features/assembly-builder/phases/phase-07-catalog-refresh-drift.md`.

Phase 7 is implemented on `codex/assembly-builder-phase-07`.

Implemented:

- `GET /envelope/material-catalog-drift` over draft or saved source;
- drift states for `in_sync`, `customized`, `drifted`,
  `source_deactivated`, and `source_missing`;
- drift predicate for catalog-version mismatch, same-version field
  deltas, local overrides, and deactivated/missing source rows;
- `refresh_project_material_from_catalog` semantic command with
  field-level `keep_mine`, `take_catalog`, and `use_value` choices;
- refresh command updates synced catalog metadata while preserving
  `local_overrides` verbatim;
- Assemblies drift banner, segment/card badges, Specifications review
  summary, and per-material refresh dialog;
- unit-aware physical-value diff display with SI canonical writes;
- batched material source-row lookup for drift reports;
- frontend drift query gated to catalog-origin project materials with
  material-only drift invalidation.

Verified:

- `cd backend && uv run ruff check features/catalogs/materials/repository.py features/envelope tests/test_envelope_phase07.py`
- `cd backend && uv run ty check features/catalogs/materials/repository.py features/envelope tests/test_envelope_phase07.py`
- `cd backend && uv run pytest tests/test_envelope_phase04.py tests/test_envelope_phase07.py`
- `cd frontend && pnpm exec eslint src/features/envelope`
- `cd frontend && pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/features/catalogs|src/lib/units" || true`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`

Remaining before Phase 7 closure:

- browser-smoke the Phase 7 checklist;
- verify locked/viewer read-only drift visibility in-browser;
- decide during Phase 8 whether to extract shared drift helpers across
  Windows and Assembly Builder;
- decide during Phase 8 whether drift belongs in the Envelope read model
  or remains a separately gated catalog-origin query.

## Phase 8 Progress - MCP, Hardening, And Release

Implementation target:
`planning/features/assembly-builder/phases/phase-08-mcp-hardening-release.md`.

Phase 8 is active on `codex/assembly-builder-phase-07`.

Implemented:

- MCP read/report tools for assemblies, project materials, unfinished
  work, material catalog drift, and missing evidence;
- MCP `apply_envelope_command` write tool routed through the same
  backend `EnvelopeCommandRequest` DTO and envelope command service as
  the browser;
- envelope command service `updated_via="mcp"` support so MCP writes
  tag the persisted draft while retaining ETag and locked-version
  protections;
- MCP smoke script updated to require the Assembly Builder read tools;
- backend tests for read reports, unfinished counts, semantic command
  writes, `updated_via='mcp'`, stale draft rejection, and FastMCP tool
  discovery.

Verified:

- `cd backend && uv run ruff check features/envelope/service.py features/mcp/tools.py features/mcp/server.py tests/test_mcp.py scripts/smoke_mcp_read.py`
- `cd backend && uv run ty check features/envelope/service.py features/mcp/tools.py features/mcp/server.py tests/test_mcp.py scripts/smoke_mcp_read.py`
- `cd backend && uv run pytest tests/test_mcp.py`

Remaining before Phase 8 closure:

- realistic scale fixture and performance/browser evidence;
- accumulated Phase 4-7 browser smoke workflows;
- locked/viewer verification across all envelope sub-surfaces;
- full IP/SI smoke across layer, segment, material, drift, thermal, and
  MCP surfaces;
- V1 parity audit closeout and final PRD lessons;
- full repo gates once unrelated local blockers are isolated.

## Foundation Refactor - Phases 9-12

A foundation code review on 2026-05-27 confirmed the feature has good
bones (strict Pydantic v2 discriminated commands, SI-canonical
persistence, correct ETag protocol, pure thermal layer, targeted query
invalidation, no silent failures) but flagged three module-size /
dispatch-shape issues plus a tail of named-constant and documentation
gaps. The review and its prioritized recommendations live at:

- `planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md`

The fixes are organized into four phases that should land **before**
serious UI/UX polish begins. Each phase is independent of the others
and can ship as one focused PR.

| Phase | Plan | Primary Goal | Code Review Items |
|---|---|---|---|
| 9 | `phase-09-backend-service-split.md` | Split the 1061-line `backend/features/envelope/service.py` along workflow lines and replace the `_apply_command` `isinstance` cascade with a typed dispatch registry. Thread the catalog-rows transaction through the drift report. | H1, H2, M3 |
| 10 | `phase-10-frontend-page-dialog-split.md` | Decompose `EnvelopeEditorDialogs.tsx` (665), `EnvelopePage.tsx` (509), and `SpecificationsPanel.tsx` (389). Extract `useLengthDraft`, `useEnvelopeAttachmentMutation`, and the envelope subpath/redirect helper. Reuse the `EnvelopeReadSource` named type in query keys. | H3, H4, M5 |
| 11 | `phase-11-shared-constants-helpers.md` | Name the canvas calibration values (`BASE_PX_PER_MM` etc.), share an `argbColor` parser, dedupe the "next free name" loops, name the default ARGB color, introduce a shared `downloadBlob` helper, and align the `hbjson_export` status-import style. | M1, M2, M4, L2, L3, L7, L8 |
| 12 | `phase-12-docs-and-test-reorg.md` | Add "why"-bearing docstrings to the public service entry points and the thermal math, and rename `tests/test_envelope_phase01.py` through `_phase07.py` to topic-organized files. | L1, L4, L5, M6 |

### Why This Sequence

Phases 9 and 10 are the highest-leverage changes — they target the three
files past the documented size limits in
`context/CODING_STANDARDS.md` and the dispatch shape that will fight
every future command addition. They are independent of each other and
can land in parallel; together they unlock the natural module homes
that Phase 11 names and Phase 12 documents.

Phase 11 introduces shared helpers without migrating every caller.
Catalog editors keep their hand-rolled `argb_color` inputs until
opportunistically touched; envelope adopts the new helpers immediately.

Phase 12 lands last on purpose: every docstring and renamed test gets
to reference the post-refactor module layout, so the documented
contract matches the implementation.

### Open Decisions

- **Test renaming scope.** Phase 12 renames the envelope test files
  only. The parallel `test_project_document_custom_fields_phase_*.py`
  files have the same problem but are out of scope for the Assembly
  Builder bundle. Decide separately whether to fold the project-document
  rename into Phase 12 or treat it as its own project-wide cleanup.
- **Shared `downloadBlob` helper colocation.** Phase 11 will grep the
  repo for an existing `URL.createObjectURL` helper before writing a
  new one; if one exists, adopt it instead. Confirm at implementation
  time.

### Sequencing Against Phase 8

Phase 8 (`MCP, hardening, release`) is still active on
`codex/assembly-builder-phase-07` and owes the scale fixture, browser
smoke catch-up, and PRD lessons closeout. Phases 9-12 do not block
Phase 8 closure and Phase 8 does not block Phases 9-12. Practical
suggestion: land Phase 9 first (it touches the same backend service file
that Phase 8 may want to add MCP-test hooks to). Phase 10 can land any
time; Phase 11 prefers to land after 9 and 10 so it touches only the
post-refactor file layout; Phase 12 lands last.

### Active Branch

Phase 9 is implemented on `codex/assembly-builder-phase-09`. The
backend envelope split is verified with:

- `cd backend && uv run ruff check features/envelope`
- `cd backend && uv run ty check features/envelope tests/test_envelope_phase0*.py tests/test_mcp.py`
- `cd backend && DATABASE_URL="postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test" uv run alembic upgrade head && uv run pytest tests/test_envelope_phase0*.py tests/test_mcp.py`

Repo-level `make lint` passed. Repo-level `make test` and
`make typecheck` are blocked by unrelated project-document custom-field
test drift (`ROOMS_CORE_FIELD_KEYS`, stale `compute_table_schema_fingerprint`
call shape, and old `RoomsTableEnvelope` / `RoomRow` field assumptions).

Phase 10 is implemented on `assembly-builder`. The frontend foundation
split is verified with:

- `cd frontend && pnpm run format`
- `cd frontend && pnpm exec eslint src/features/envelope src/shared/ui/DialogActions.tsx`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx src/features/envelope/__tests__/useLengthDraft.test.tsx`
- `cd frontend && pnpm exec tsc --noEmit --pretty false 2>&1 | rg "src/features/envelope|src/shared/ui/DialogActions" || true`

The full `cd frontend && pnpm run build` gate remains blocked by
unrelated equipment/project-document/windows/shared table type drift.

Phases 11-12 remain proposed. Each remaining phase should begin on a
fresh branch off `main` once the current phase branch has landed.
