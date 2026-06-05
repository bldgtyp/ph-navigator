---
DATE: 2026-06-05
TIME: 17:30 EDT
STATUS: Planned - PRD refined; 13-phase implementation plan drafted; Phase 01 ready to start.
AUTHOR: Codex
SCOPE: Current state, decisions, and next steps for the Apertures / Aperture Builder build-out.
RELATED:
  - planning/features/apertures/PRD.md
  - planning/features/apertures/PLAN.md
  - planning/features/apertures/README.md
  - planning/features/apertures/phases/
---

# Apertures Feature Status

## Current State

- `PRD.md` drafted from the V1 Window Builder reference, Windows user
  stories, V1 screenshot set, save/versioning requirements, MCP/schema
  requirements, and current TB-08/TB-09 implementation state.
- Existing app foundation includes `tables.window_types[]`, the
  frontend Windows tab, frame/glazing catalog pickers, bookshelf-copy
  `catalog_origin`, U-value override tracking for `u_value_w_m2k`, and
  refresh-from-catalog review/report plumbing.
- PRD review decisions (initial pass) are folded in: canonical
  terminology is `Apertures`, semantic `ApertureCommand` is the
  recommended mutation seam, default frame/glazing refs remove normal
  missing-assignment states, HBJSON export is core scope, and
  manufacturer filters can follow the core canvas.
- PRD review decisions (2026-06-05 PM refinement pass, decisions
  7–21) close V1-parity gaps: V1 Frame Types / Glazing Types sub-tabs
  removed in favor of a read-only project-refs view; per-side picker
  filtering by FrameRef `location` / `use` / `operation`;
  click-on-canvas-region scoped pickers; on-canvas element-name pill;
  selection model (single / shift / cmd-ctrl + ESC); no-direct-delete
  invariant; display-unit format selector and total-dim caption;
  operation presets; datasheet PDF link as a first-class card
  affordance; drift detection (version-id mismatch OR field-delta);
  `catalog_origin.catalog_schema_version: 1` hook; deterministic
  HBJSON identifier escaping; Save / Save As in the global project
  header. Several entries explicitly supersede US-WIN-1 / US-WIN-3 /
  US-WIN-11 leans in `context/user-stories/10-windows.md`.
- `PLAN.md` plus 13 phase files under `phases/` capture the
  full implementation sequence (terminology / schema cutover →
  shell + sidebar → canvas substrate → overlay + pill + selection
  → dimensions + parser → cards + pickers + badges → operations
  → merge/split + copy/paste → U-Value service → HBJSON export →
  manufacturer filters → drift / refresh / refs view → semantic
  MCP tools). Each phase file is a self-contained P0–P7 plan
  matching the `planning/archive/assembly-builder/phases/`
  precedent.
- Full Builder work is not started. Phase 01 is the unblocker —
  no other phase can begin until the schema rename, default
  frame / glazing seeding, and `ApertureCommand` seam land.

## Next Step

Begin implementation of `phases/phase-01-terminology-schema-command-seam.md`.
Six commits over the schema rename, table contract, default-refs
seed + factory, `ApertureCommand` dispatcher, frontend type
extension, and Alembic migration. Existing Windows tracer-bullet
UI must keep working through this phase; the frontend route
cutover lands in Phase 02.

## Blockers

- None currently blocking the start of Phase 01.
- Phase 01 PR must answer one open question before merge: the
  catalog manager's `Show PHN defaults` toggle (R-01-4) is named
  but not yet implemented in the catalog feature — Phase 01
  ships the seed rows visibly in the picker as a transitional
  state, which is acceptable but worth a heads-up to the
  catalog-feature owner.

## Verification

Docs-only planning pass. No code gates run. Each phase file's
P5.Tests section enumerates the specific tests that will gate
its PR.
