---
DATE: 2026-06-05
TIME: 13:40 EDT
STATUS: Planned - PRD updated with review decisions; phase planning not started.
AUTHOR: Codex
SCOPE: Current state, decisions, and next steps for the Apertures / Aperture Builder build-out.
RELATED:
  - planning/features/apertures/PRD.md
  - planning/features/apertures/README.md
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
- PRD review decisions are folded in: canonical terminology is
  `Apertures`, semantic `ApertureCommand` is the recommended mutation
  seam, default frame/glazing refs remove normal missing-assignment
  states,
  HBJSON export is core scope, and manufacturer filters can follow the
  core canvas.
- Full Builder work is not started: terminology/schema rename,
  proportional canvas, dimensions, operation editor, merge/split,
  copy/paste, live ISO 10077-1 U-Value, sidebar actions, HBJSON export,
  and MCP semantic write helpers still need phase plans and
  implementation.

## Next Step

Draft phase plans under `phases/`, starting with the terminology,
schema, default-frame/default-glazing, and `ApertureCommand` boundary
before the canvas implementation.

## Blockers

- None currently blocking PRD acceptance.
- Phase 01 must still specify the concrete target names for table keys,
  frontend route labels, and id prefixes.

## Verification

Docs-only planning pass. No code gates run.
