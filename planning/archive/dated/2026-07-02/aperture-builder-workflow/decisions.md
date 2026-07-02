---
DATE: 2026-07-02
TIME: 18:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Accepted implementation decisions for Aperture Builder workflow.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
---

# Decisions - Aperture Builder Workflow

## Phase 02 - Flip Left/Right Remapping

Accepted for Phase 03 implementation:

- Add a backend aperture command, `flipLeftRight`, with `aperture_type_id`.
  Keep the data transform in the backend; the frontend only dispatches the
  command and reflects pending/disabled state.
- Match Envelope Builder command semantics: the command is semantic, preserves
  stable row/element IDs, and transforms the ordered geometry. For audit
  details, follow the richer aperture-command `build_audit(...)` pattern rather
  than Envelope Builder's generic command-kind audit payload.
- Reverse `column_widths_mm`.
- For each `ApertureElement`, with `cols = len(column_widths_mm)` before
  reversal, remap inclusive `column_span` from `(c0, c1)` to
  `(cols - 1 - c1, cols - 1 - c0)`.
- Preserve `row_span`, `id`, `name`, `glazing_id`, and any catalog-origin
  metadata on referenced frames/glazings.
- Swap side frame assignments: `left <-> right`. Preserve vertical frame
  assignments: `top` stays top and `bottom` stays bottom.
- Mirror operation handing because this is a persisted geometric mirror, not a
  view transform: each operation direction `left <-> right`; `up` and `down`
  stay unchanged.
- Preserve the existing `View from Exterior` / `View from Interior` behavior.
  That view-only path can continue deriving interior rendering via
  `mirrorApertureForInterior`; the new command changes the canonical document.
- Re-run existing document validation at the dispatcher seam so aperture
  coverage invariants catch invalid transforms.
- Expected audit payload keys: `aperture_type_id`, `flipped_element_ids`,
  `column_count`, and `affects_u_value: true`.

Implementation notes:

- Existing frontend precedent: `flipColumnForInterior` in
  `frontend/src/features/apertures/aperture-geometry.ts` already expresses the
  view-only column-span and frame-slot mapping.
- Existing backend command precedent:
  `backend/features/envelope/commands/assemblies.py` implements
  `flip_segments` / `flip_layers` as backend semantic transforms.
- Expected tests:
  - Backend command test for a single-column aperture.
  - Backend command test for two or more columns, confirming column widths,
    `column_span`, frame side slots, and operation directions.
  - Frontend dispatch/toolbar test confirming the Aperture Builder command
    posts `flipLeftRight` and is disabled while pick/paste is active or another
    command is pending.
