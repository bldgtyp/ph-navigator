---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Product and validation contract for aperture frame compatibility rules.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
---

# PRD - Aperture Frame Compatibility Rules

## Problem

Frame dropdowns in Apertures can expose options that do not match the selected
operation or side. A slider element currently shows fixed frame options in a way
that appears inconsistent with Swing behavior. Catalog frame types also include
`Location` values `Mull-H` and `Mull-V`, but the aperture-side assignment rules
need to treat them as compatible with the appropriate physical sides.

## Desired Behavior

- Slider operation frame dropdowns filter out incompatible fixed frame options
  when operation filtering is enabled, matching the intent of Swing filtering.
- `Mull-H` means horizontal mullion and is compatible with aperture `Head` and
  `Sill` sides.
- `Mull-V` means vertical mullion and is compatible with aperture `Jamb` sides
  (`Left Frame` and `Right Frame` assignments).
- Compatibility should be enforced through a central predicate or shared rule,
  not patched only in a single dropdown.

## Acceptance Criteria

- Slider frame dropdowns no longer show incompatible fixed frame options when
  operation filtering is enabled.
- Existing Swing filtering remains unchanged except where centralization removes
  duplicate behavior.
- Head and sill frame dropdowns include valid `Mull-H` frame types.
- Left and right jamb dropdowns include valid `Mull-V` frame types.
- Incompatible `Mull-H`/`Mull-V` side assignments remain excluded.
- Tests cover operation filtering and side/location compatibility.
- Browser smoke verifies Apertures / Apertures frame dropdown behavior against a
  project/catalog with fixed, sliding, `Mull-H`, and `Mull-V` frame types.

## Non-Goals

- No catalog schema migration.
- No rename of catalog `Location` values.
- No change to aperture builder flip behavior; that is tracked in
  `planning/archive/dated/2026-07-02/aperture-builder-workflow/`.

## Resolved Decisions

- Resolved 2026-07-02: slider frame pickers exclude catalog rows whose
  operation is `Fixed` when operation compatibility filtering is enabled. The
  current aperture element model has only element-level `slide` operation and
  no segment role (`FX-to-FX`, `OP-to-FX`, `OP-to-OP`), so the picker cannot
  safely infer a stationary-panel exception.
- Resolved 2026-07-02: stationary-panel fixed-frame exceptions are out of
  scope until the model exposes segment role metadata at frame-pick time.
- Resolved 2026-07-02: this refactor bases compatibility on catalog frame
  metadata plus aperture side/element operation only, not on segment role.
