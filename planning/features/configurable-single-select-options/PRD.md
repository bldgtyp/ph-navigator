---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Product and schema contract for user-configurable single-select options.
RELATED:
  - ./README.md
  - ./decisions.md
  - ./PLAN.md
  - ./STATUS.md
  - ./reviews/2026-07-02-critical-feature-review.md
  - planning/features_v1.1/catalog-manage-options-modal/PRD.md
---

# PRD - Configurable Single-Select Options

## Problem

Spaces / Rooms includes `Floor` and `Zone` single-select fields, but users cannot
configure the allowed values. These are project-specific vocabularies. A room
schedule must be able to reflect project floors and ventilation/thermal zones
without forcing a developer-defined fixed option list.

At the same time, not every single-select should be user-configurable. System
fields such as `STATUS` are controlled app vocabulary and should remain locked.

## Desired Behavior

- Field definitions can declare whether their single-select option list is
  user-configurable.
- Rooms `Floor` and `Zone` are configurable.
- System-owned single-selects such as `STATUS` are not configurable.
- The same configurability rule applies to every option mutation entry point:
  manage-options, inline create from the cell picker, and paste/type-to-create.
- Users can add, rename, reorder, and delete/merge options through an existing
  or shared manage-options modal.
- Records with existing option values remain valid or receive an explicit merge
  path when an option is removed.
- The capability is implemented as a general field contract, not a one-off
  Rooms-only UI patch.

## Acceptance Criteria

- Rooms `Floor` and `Zone` expose a manage-options affordance.
- `STATUS` does not expose a manage-options affordance.
- Add option: the new option becomes available in Rooms cells.
- Rename option: existing records update or continue to resolve correctly.
- Reorder options: option order persists across reload.
- Delete in-use nullable Rooms option: referenced cells clear to `null` unless a
  later replacement UX supplies an explicit replacement.
- Protected/system single-selects reject option-list edits even if a frontend bug
  attempts to dispatch one.
- Protected/system single-selects do not offer inline "+ Create" or accept pasted
  unknown labels as new options.
- Tests cover allowlisted vs protected fields, option mutation persistence, and
  existing values during rename/delete.

## Non-Goals

- No global editability for every single-select.
- No per-user personal option lists; this is project/document schema.
- No expansion to catalog single-selects unless it falls out naturally from the
  same shared modal contract. Catalog option cleanup remains tracked in
  `planning/features_v1.1/catalog-manage-options-modal/`.

## Decisions

See `decisions.md`.

- Option mutability is an explicit shared capability:
  `option_mutability = "editable" | "locked"`.
- Frontend `FieldDef.locked: ["options"]` remains the render hint, with
  `FieldDef.optionMutability` as the shared editor capability.
- Backend `TableFieldRegistry.option_editable_builtin_field_keys` is the
  enforcement allowlist for built-in single-select option edits.
- Rooms `Floor` and `Zone` are editable built-ins.
- Built-in `status` fields remain locked.
- Rooms manage-options uses typed `editFieldBundle.nextOptions` /
  `apply_edit_options`, not new `legacyOptions` wiring.
