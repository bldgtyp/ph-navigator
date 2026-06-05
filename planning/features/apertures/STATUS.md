---
DATE: 2026-06-05
TIME: 16:35 EDT
STATUS: In progress — Phase 01 shipped as an additive variant; renames + route + migration deferred into Phase 02.
AUTHOR: Claude
SCOPE: Current state, decisions, and next steps for the Apertures / Aperture Builder build-out.
RELATED:
  - planning/features/apertures/PRD.md
  - planning/features/apertures/PLAN.md
  - planning/features/apertures/README.md
  - planning/features/apertures/phases/
---

# Apertures Feature Status

## Current State

- **Phase 01 — additive variant shipped.** The schema cutover was
  scoped down: rather than renaming `WindowTypeEntry` /
  `WindowElement` / `tables.window_types` and shipping legacy
  aliases, the new `Aperture*` classes and `tables.apertures[]` field
  landed **side-by-side** with the existing `Window*` types. This
  unblocks every later phase (the canonical aperture model exists
  with the coverage invariant, default-refs factory,
  `ApertureCommand` seam, and table contract) without the
  rename's risk surface (live-document migration, alias-import
  leakage, dispatcher cutover in one PR). See the phase-01 file's
  "Implementation note" for the full delta.
- **What's live now:**
  - `backend/features/project_document/document.py` —
    `ApertureOperation`, `ApertureElementFrames`, `ApertureElement`
    (with `name` + `operation`), `ApertureTypeEntry` (with coverage
    validator), default-name constants, `tables.apertures` field,
    document-level uniqueness on aperture id/name.
  - `backend/features/project_document/apertures/{coverage,factories}.py`
    — pure coverage check + default-aperture factory with
    `DefaultsCatalogReader` Protocol seam.
  - `backend/features/project_document/aperture_commands/` — full
    16-command discriminated union, dispatcher, 6 live handlers
    (create / rename / duplicate / delete / setElementName /
    setElementOperation); the rest raise
    `aperture_command_not_implemented` so the wire shape is stable
    for later phases and MCP.
  - `backend/features/project_document/tables/apertures.py` —
    table contract registered in the document table registry.
  - `backend/tests/test_project_document_apertures.py` — 24 unit
    tests covering validation, factory, and dispatcher.
  - Full `make ci` green (525 backend tests, 1118 frontend tests,
    build successful).
- **Existing TB-08/TB-09 Windows tracer-bullet keeps working
  unmodified.** Nothing in the existing tracer-bullet path was
  touched.

## Deferred from Phase 01 (folded into Phase 02)

Phase 02 should bundle the route cutover with the items below
because the existing tracer-bullet UI is being replaced in the same
PR anyway:

- Rename `WindowTypeEntry` / `WindowElement` / `WindowElementFrames`
  → `Aperture*` and re-export the legacy names as aliases for one
  release window.
- Document-load migration shim in
  `backend/features/project_document/validation.py` that rewrites
  `win_` / `winel_` ids to `apt_` / `aptel_`.
- Rename `body.tables.window_types` → `body.tables.apertures` with a
  `@computed_field` alias.
- Alembic migration that munges existing JSON documents in Postgres.
- Alembic seed of the two default catalog rows
  (`PHN-Default-Frame`, `PHN-Default-Glazing`) — the factory exists
  and is unit-tested with a stub catalog; the real
  `DefaultsCatalogReader` adapter lands when the route is wired.
- `POST /projects/{id}/versions/{vid}/apertures/command` REST route
  + `apply_aperture_command_to_draft` service wrapper (ETag
  preflight, draft creation, audit-log persistence).
- Frontend `types.ts` / `api.ts` extensions (`ApertureOperation`,
  `name` on `WindowElement`, `applyApertureCommand` helper) — also
  bundled with the route cutover.

## Next Step

Begin Phase 02 (`phases/phase-02-shell-sidebar.md`). Treat the
"Deferred from Phase 01" list above as Phase 02 P0 prereqs that ship
in the first commit before the shell + sidebar work begins.

## Blockers

- None blocking Phase 02 start. The `Show PHN defaults` catalog-
  manager toggle (originally R-01-4) remains a follow-up for the
  catalog-feature owner once the seed rows actually land in
  Postgres (currently the factory only knows the names; the seed
  Alembic migration is part of Phase 02's prereq batch).

## Verification

- Phase 01: `make ci` green at HEAD; see commit
  `Phase 01 (additive): Aperture model, coverage, factory,
  command seam`. 525 backend tests, 1118 frontend tests, build
  successful.
